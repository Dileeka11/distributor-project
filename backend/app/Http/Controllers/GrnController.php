<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGrnRequest;
use App\Models\Grn;
use App\Models\Item;
use App\Models\ItemBatch;
use App\Models\Supplier;
use App\Services\NumberService;
use App\Services\SettlementService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $type = trim((string) $request->input('type'));

        $rows = Grn::query()
            ->with(['supplier:id,code,name,address', 'lines'])
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('supplier', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->when(in_array($type, ['cash', 'credit']), fn ($qb) => $qb->where('type', $type))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Grn $grn): JsonResponse
    {
        return response()->json([
            'data' => $grn->load(['supplier', 'lines.item:id,code,name', 'cheques']),
        ]);
    }

    public function store(StoreGrnRequest $request): JsonResponse
    {
        $data = $request->validated();
        $taxRate = $this->allowedTaxRate($request, $data);

        $grn = DB::transaction(function () use ($data, $taxRate, $request) {
            $grn = new Grn([
                'no' => NumberService::next(Grn::class, 'GRN-'),
                'date' => now()->toDateString(),
                'created_by' => optional($request->user())->id,
            ]);

            $this->applyGrnData($grn, $data, $taxRate);
            app(StockService::class)->projectMany(collect($data['lines'])->pluck('item_id')->all());

            return $grn;
        });

        return response()->json([
            'data' => $grn->fresh(['supplier', 'lines']),
        ], 201);
    }

    public function update(StoreGrnRequest $request, Grn $grn): JsonResponse
    {
        abort_if((bool) $grn->cancelled_at, 422, 'This GRN is cancelled and can no longer be edited.');

        // Editing re-applies the GRN from scratch (paid resets to the advance),
        // which would wipe any payments / cleared cheques recorded against it.
        // Block it once money has been collected beyond the up-front advance.
        abort_if(
            round((float) $grn->paid - (float) $grn->advance, 2) > 0,
            422,
            'This GRN has recorded payments or cleared cheques. Reverse them (un-clear its cheques and delete its payments) before editing.'
        );

        $data = $request->validated();
        $taxRate = $this->allowedTaxRate($request, $data);

        DB::transaction(function () use ($grn, $data, $taxRate) {
            $ids = $grn->lines()->pluck('item_id')->all();
            // Undo the old GRN's effects, then re-apply from the edited data.
            $this->reverseGrnEffects($grn);
            $grn->lines()->delete();
            $grn->cheques()->delete();
            $this->applyGrnData($grn, $data, $taxRate);
            app(StockService::class)->projectMany(array_merge($ids, collect($data['lines'])->pluck('item_id')->all()));
        });

        return response()->json([
            'data' => $grn->fresh(['supplier', 'lines']),
        ]);
    }

    /**
     * Cancel a GRN: remove the received stock + reverse the payable (and any
     * payments posted against it), but keep the record marked cancelled.
     * Blocked if any received stock was already sold on an invoice.
     */
    public function cancel(Grn $grn, SettlementService $posting): JsonResponse
    {
        abort_if((bool) $grn->cancelled_at, 422, 'This GRN is already cancelled.');

        DB::transaction(function () use ($grn, $posting) {
            $ids = $grn->lines()->pluck('item_id')->all();
            $posting->purgeSettlementsForGrn($grn);
            $grn->refresh();
            $this->reverseGrnEffects($grn); // removes received stock + batches, reverses payable
            $grn->cheques()->delete();      // record-only cheques no longer apply
            $grn->fill([
                'cancelled_at' => now(),
                'paid' => 0,
                'advance' => 0,
                'status' => 'unpaid',
            ])->save();
            app(StockService::class)->projectMany($ids);
        });

        return response()->json(['data' => $grn->fresh(['supplier', 'lines'])]);
    }

    /**
     * Delete a cancelled GRN from the database entirely.
     */
    public function destroy(Grn $grn): JsonResponse
    {
        abort_unless((bool) $grn->cancelled_at, 422, 'Only cancelled GRNs can be deleted.');

        DB::transaction(function () use ($grn) {
            $ids = $grn->lines()->pluck('item_id')->all();
            // Cancelling already removed them, but never leave a batch orphaned:
            // a NULL grn_id would detach that stock from its cost lot.
            ItemBatch::query()->where('grn_id', $grn->id)->delete();
            $grn->delete(); // lines cascade; stock/payable already reversed at cancel
            app(StockService::class)->projectMany($ids);
        });

        return response()->json(['message' => 'GRN deleted successfully']);
    }

    /**
     * Tax may only be charged by a user granted the "tax_control" capability
     * (admins always). Everyone else bills at 0% whatever the client sends.
     */
    private function allowedTaxRate(Request $request, array $data): float
    {
        $user = $request->user();

        return ($user && $user->can_use('tax_control')) ? (float) ($data['tax_rate'] ?? 0) : 0.0;
    }

    /**
     * Compute totals from the request, persist the GRN + lines + cheques,
     * increment item stock, create cost-batches and apply the credit payable.
     * Shared by store/update.
     */
    private function applyGrnData(Grn $grn, array $data, float $taxRate): void
    {
        $itemIds = collect($data['lines'])->pluck('item_id')->unique();
        $items = Item::query()->whereIn('id', $itemIds)->lockForUpdate()->get()->keyBy('id');

        $subtotal = 0;
        $linesOut = [];
        foreach ($data['lines'] as $line) {
            /** @var Item $item */
            $item = $items[$line['item_id']];
            $qty = (float) $line['qty'];
            $unitPrice = (float) $line['unit_price'];
            $discount = (float) ($line['discount'] ?? 0);
            $unitCost = round($unitPrice * (1 - $discount / 100), 2);
            $total = round($qty * $unitCost, 2);
            $subtotal += $total;
            $linesOut[] = [
                'item_id' => $item->id,
                'name' => $item->name,
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'discount' => $discount,
                'price' => $unitCost,
                'total' => $total,
            ];
        }

        $taxAmount = round($subtotal * $taxRate / 100, 2);
        $total = round($subtotal + $taxAmount, 2);

        $type = $data['type'];
        $paid = $type === 'cash' ? $total : min((float) ($data['paid'] ?? 0), $total);
        $balance = round($total - $paid, 2);
        $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

        $grn->fill([
            'type' => $type,
            'supplier_id' => $data['supplier_id'],
            'subtotal' => $subtotal,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'paid' => $paid,
            // Up-front amount from the form; unaffected by later cheque clearing / payments.
            'advance' => $paid,
            'status' => $status,
        ]);
        $grn->save();

        foreach ($linesOut as $row) {
            $grn->lines()->create($row);
            $items[$row['item_id']]->increment('stock', (int) $row['qty']);
            // Each receipt becomes a cost-batch that invoices can sell from.
            ItemBatch::query()->create([
                'item_id' => $row['item_id'],
                'grn_id' => $grn->id,
                'unit_price' => $row['unit_price'],
                'discount' => $row['discount'],
                'unit_cost' => $row['price'],
                'qty_in' => (int) $row['qty'],
                'qty_remaining' => (int) $row['qty'],
            ]);
        }

        // Cheque details (record-only — they do not affect the paid/payable amounts).
        foreach ($data['cheques'] ?? [] as $chq) {
            $grn->cheques()->create([
                'cheque_no' => $chq['no'] ?? null,
                'cheque_date' => $chq['date'] ?? null,
                'amount' => (float) ($chq['amount'] ?? 0),
            ]);
        }

        if ($type === 'credit' && $balance > 0) {
            Supplier::query()->whereKey($data['supplier_id'])->increment('payable', $balance);
        }
    }

    /**
     * Undo a GRN's side effects: remove the received stock, drop its cost-batches
     * and reverse the credit payable. Blocked if any received stock was already
     * sold, since that stock can no longer be cleanly pulled back.
     */
    private function reverseGrnEffects(Grn $grn): void
    {
        $grn->loadMissing('lines');

        $batches = ItemBatch::query()->where('grn_id', $grn->id)->lockForUpdate()->get();
        foreach ($batches as $batch) {
            abort_if(
                (int) $batch->qty_remaining < (int) $batch->qty_in,
                422,
                'Cannot modify this GRN — some received stock has already been sold. Reverse those invoices first.'
            );
        }

        foreach ($grn->lines as $line) {
            Item::query()->whereKey($line->item_id)->decrement('stock', (int) $line->qty);
        }

        // Drop the cost-batches this GRN created (none have been sold from).
        ItemBatch::query()->where('grn_id', $grn->id)->delete();

        if ($grn->type === 'credit') {
            $outstanding = round((float) $grn->total - (float) $grn->paid, 2);
            if ($outstanding > 0) {
                Supplier::query()->whereKey($grn->supplier_id)->decrement('payable', $outstanding);
            }
        }
    }
}
