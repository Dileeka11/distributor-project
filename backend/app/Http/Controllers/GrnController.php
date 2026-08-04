<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGrnRequest;
use App\Models\Grn;
use App\Models\Item;
use App\Models\ItemBatch;
use App\Models\StockAdjustment;
use App\Models\Supplier;
use App\Services\NumberService;
use App\Services\ReturnStockService;
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
            $grn->returnLines()->delete();  // the goods go back into the return pool
            $grn->fill([
                'cancelled_at' => now(),
                'return_deduction' => 0,
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
            // a NULL grn_id would detach that stock from its cost lot. Same for
            // adjustments left behind by a GRN cancelled before that was fixed.
            $batchIds = ItemBatch::query()->where('grn_id', $grn->id)->pluck('id')->all();
            StockAdjustment::query()->where('grn_id', $grn->id)
                ->when($batchIds, fn ($q) => $q->orWhereIn('batch_id', $batchIds))->delete();
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

    /** Returned goods still waiting to go back to a supplier. */
    public function returnStock(Request $request): JsonResponse
    {
        $editing = $request->filled('grn_id') ? (int) $request->input('grn_id') : null;

        return response()->json(['data' => app(ReturnStockService::class)->available($editing)]);
    }

    /**
     * Record the returned goods this GRN hands back, and total what they are
     * worth. Replaces whatever the GRN claimed before, so an edit re-draws from
     * a pool that has its old claim released.
     */
    private function applyReturnHandBack(Grn $grn, array $rows): float
    {
        $grn->returnLines()->delete();
        if (! $rows) {
            return 0.0;
        }

        $pool = app(ReturnStockService::class)->availableById($grn->id);
        // Drawn down as the rows are read, so two rows on the same cost lot
        // cannot both spend what only one of them can have.
        $left = $pool->map(fn ($r) => (int) $r['qty_available']);

        $deduction = 0.0;
        foreach ($rows as $row) {
            $lineId = (int) ($row['sales_return_line_id'] ?? 0);
            $qty = (int) ($row['qty'] ?? 0);
            if ($qty <= 0) {
                continue;
            }

            $avail = $pool[$lineId] ?? null;
            abort_if(! $avail, 422, 'That returned item is no longer available to send back.');
            abort_if(
                $qty > ($left[$lineId] ?? 0),
                422,
                "Only {$left[$lineId]} of {$avail['name']} is left to send back."
            );
            $left[$lineId] -= $qty;

            $total = round($qty * (float) $avail['unit_cost'], 2);
            $grn->returnLines()->create([
                'sales_return_line_id' => $lineId,
                'item_id' => $avail['item_id'],
                'name' => $avail['name'],
                'qty' => $qty,
                'unit_cost' => $avail['unit_cost'],
                'total' => $total,
            ]);
            $deduction = round($deduction + $total, 2);
        }

        return $deduction;
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
        $billed = round($subtotal + $taxAmount, 2);

        $type = $data['type'];

        // Saved without the return deduction first: the hand-back rows need a
        // GRN id to hang off before the deduction can be worked out.
        $grn->fill([
            'type' => $type,
            'supplier_id' => $data['supplier_id'],
            'subtotal' => $subtotal,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'return_deduction' => 0,
            'total' => $billed,
            'paid' => 0,
            'advance' => 0,
            'status' => 'unpaid',
        ]);
        $grn->save();

        // Customer-returned goods going back to the supplier come off this bill
        // at what we paid for them.
        $deduction = $this->applyReturnHandBack($grn, $data['return_lines'] ?? []);
        $total = round(max(0, $billed - $deduction), 2);

        $paid = $type === 'cash' ? $total : min((float) ($data['paid'] ?? 0), $total);
        $balance = round($total - $paid, 2);
        $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

        $grn->fill([
            'return_deduction' => $deduction,
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

        // Heal first: a lot wrongly restored into opening stock by an older
        // cancel is pulled back into its own cost batch, so the quantities
        // below reflect what these lots really hold.
        app(StockService::class)->reconcileMany($grn->lines->pluck('item_id')->all());

        $batches = ItemBatch::query()->where('grn_id', $grn->id)->lockForUpdate()->get();
        $batchIds = $batches->pluck('id')->all();

        if ($batchIds) {
            // A sale is the one thing we cannot undo from here — that stock has
            // left on an invoice. Adjustments we clean up ourselves, below.
            $sold = DB::table('invoice_lines')
                ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
                ->join('items', 'items.id', '=', 'invoice_lines.item_id')
                ->whereNull('invoices.cancelled_at')
                ->whereIn('invoice_lines.batch_id', $batchIds)
                ->get(['invoices.no', 'items.name']);

            if ($sold->isNotEmpty()) {
                $refs = $sold->pluck('no')->unique()->implode(', ');
                $names = $sold->pluck('name')->unique()->implode(', ');
                abort(
                    422,
                    "Cannot cancel or edit this GRN — stock it received ({$names}) has already been sold on {$refs}. Cancel {$refs} first."
                );
            }

            // Manual adjustments belong to the lots they were made against, so
            // they go with them — their quantity must not linger in opening stock.
            StockAdjustment::query()->whereIn('batch_id', $batchIds)->delete();
        }

        // What a lot currently holds is exactly what this GRN still contributes
        // to item stock: received, less anything the adjustments just dropped.
        foreach ($batches as $batch) {
            Item::query()->whereKey($batch->item_id)->decrement('stock', (int) $batch->qty_remaining);
        }

        // Drop the cost-batches this GRN created (none have been sold from / all covered).
        ItemBatch::query()->where('grn_id', $grn->id)->delete();

        if ($grn->type === 'credit') {
            $outstanding = round((float) $grn->total - (float) $grn->paid, 2);
            if ($outstanding > 0) {
                Supplier::query()->whereKey($grn->supplier_id)->decrement('payable', $outstanding);
            }
        }
    }
}
