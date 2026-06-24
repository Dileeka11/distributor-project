<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvoiceRequest;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\ItemBatch;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $type = trim((string) $request->input('type'));

        $rows = Invoice::query()
            ->with(['customer:id,code,name,address', 'lines'])
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->when(in_array($type, ['cash', 'credit']), fn ($qb) => $qb->where('type', $type))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json([
            'data' => $invoice->load(['customer', 'lines.item:id,code,name', 'cheques']),
        ]);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $taxRate = (float) ($data['tax_rate'] ?? 0);

        $invoice = DB::transaction(function () use ($data, $taxRate, $request) {
            $invoice = new Invoice([
                'no' => NumberService::next(Invoice::class, NumberService::invoicePrefix()),
                'date' => now()->toDateString(),
                'created_by' => optional($request->user())->id,
            ]);

            $this->applyInvoiceData($invoice, $data, $taxRate);

            return $invoice;
        });

        return response()->json([
            'data' => $invoice->fresh(['customer', 'lines', 'cheques']),
        ], 201);
    }

    public function update(StoreInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validated();
        $taxRate = (float) ($data['tax_rate'] ?? 0);

        DB::transaction(function () use ($invoice, $data, $taxRate) {
            // Undo the old invoice's effects, then re-apply from the edited data.
            $this->reverseInvoiceEffects($invoice);
            $invoice->lines()->delete();
            $invoice->cheques()->delete();
            $this->applyInvoiceData($invoice, $data, $taxRate);
        });

        return response()->json([
            'data' => $invoice->fresh(['customer', 'lines', 'cheques']),
        ]);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        DB::transaction(function () use ($invoice) {
            $this->reverseInvoiceEffects($invoice);
            $invoice->delete(); // lines + cheques cascade
        });

        return response()->json(['message' => 'Invoice deleted']);
    }

    /**
     * Compute totals from the request, persist the invoice + lines + cheques,
     * decrement item stock and apply the credit receivable. Shared by store/update.
     */
    private function applyInvoiceData(Invoice $invoice, array $data, float $taxRate): void
    {
        $customer = Customer::query()->findOrFail($data['customer_id']);

        // Lock items + the chosen cost-batches
        $itemIds = collect($data['lines'])->pluck('item_id')->unique();
        $items = Item::query()->whereIn('id', $itemIds)->lockForUpdate()->get()->keyBy('id');
        $batchIds = collect($data['lines'])->pluck('batch_id')->filter()->unique();
        $batches = ItemBatch::query()->whereIn('id', $batchIds)->lockForUpdate()->get()->keyBy('id');

        $subtotal = 0;
        $linesOut = [];
        foreach ($data['lines'] as $line) {
            /** @var Item $item */
            $item = $items[$line['item_id']];
            $qty = (int) $line['qty'];
            $price = (float) $line['price'];
            $batchId = $line['batch_id'] ?? null;

            if ($batchId) {
                $batch = $batches[$batchId] ?? null;
                abort_if(! $batch || (int) $batch->item_id !== (int) $item->id, 422, "Invalid batch for {$item->name}");
                abort_if($batch->qty_remaining < $qty, 422, "Only {$batch->qty_remaining} left in the selected batch for {$item->name}");
            } else {
                abort_if($item->stock < $qty, 422, "Insufficient stock for {$item->name}");
            }

            $total = round($qty * $price, 2);
            $subtotal += $total;
            $linesOut[] = [
                'item_id' => $item->id,
                'batch_id' => $batchId,
                'name' => $item->name,
                'qty' => $qty,
                'price' => $price,
                'total' => $total,
            ];
        }

        // Cash / cheque discounts applied independently. Rates come from the
        // customer record (not the client); each tick toggles its own discount.
        $cashRate = ! empty($data['cash_discount']) ? (float) $customer->cash_discount : 0.0;
        $chequeRate = ! empty($data['cheque_discount']) ? (float) $customer->cheque_discount : 0.0;
        $discountAmount = round(round($subtotal * $cashRate / 100, 2) + round($subtotal * $chequeRate / 100, 2), 2);
        $taxable = round($subtotal - $discountAmount, 2);
        $taxAmount = round($taxable * $taxRate / 100, 2);
        $total = round($taxable + $taxAmount, 2);

        $type = $data['type'];
        $paid = $type === 'cash' ? $total : min((float) ($data['paid'] ?? 0), $total);
        $balance = round($total - $paid, 2);
        $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

        $invoice->fill([
            'type' => $type,
            'customer_id' => $data['customer_id'],
            'subtotal' => $subtotal,
            'cash_discount' => $cashRate,
            'cheque_discount' => $chequeRate,
            'discount_amount' => $discountAmount,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'paid' => $paid,
            'status' => $status,
        ]);
        $invoice->save();

        foreach ($linesOut as $row) {
            $invoice->lines()->create($row);
            $items[$row['item_id']]->decrement('stock', (int) $row['qty']);
            if ($row['batch_id'] && isset($batches[$row['batch_id']])) {
                $batches[$row['batch_id']]->decrement('qty_remaining', (int) $row['qty']);
            }
        }

        // Cheque details (record-only — they do not affect the paid/outstanding amounts).
        foreach ($data['cheques'] ?? [] as $chq) {
            $invoice->cheques()->create([
                'cheque_no' => $chq['no'] ?? null,
                'cheque_date' => $chq['date'] ?? null,
                'amount' => (float) ($chq['amount'] ?? 0),
            ]);
        }

        if ($type === 'credit' && $balance > 0) {
            Customer::query()->whereKey($data['customer_id'])->increment('balance', $balance);
        }
    }

    /**
     * Undo an invoice's side effects: restore item stock and reverse the credit receivable.
     */
    private function reverseInvoiceEffects(Invoice $invoice): void
    {
        $invoice->loadMissing('lines');

        foreach ($invoice->lines as $line) {
            Item::query()->whereKey($line->item_id)->increment('stock', (int) $line->qty);
            if ($line->batch_id) {
                ItemBatch::query()->whereKey($line->batch_id)->increment('qty_remaining', (int) $line->qty);
            }
        }

        if ($invoice->type === 'credit') {
            $outstanding = round((float) $invoice->total - (float) $invoice->paid, 2);
            if ($outstanding > 0) {
                Customer::query()->whereKey($invoice->customer_id)->decrement('balance', $outstanding);
            }
        }
    }
}
