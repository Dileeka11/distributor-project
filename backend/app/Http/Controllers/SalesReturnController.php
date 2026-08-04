<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Services\NumberService;
use App\Services\ReturnCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesReturnController extends Controller
{
    public function __construct(private readonly ReturnCreditService $credits)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));

        $rows = SalesReturn::query()
            ->with(['customer:id,code,name', 'invoice:id,no', 'lines'])
            ->withSum('allocations as used', 'amount')
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$q}%"))
                    ->orWhereHas('invoice', fn ($i) => $i->where('no', 'like', "%{$q}%"));
            }))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(SalesReturn $salesReturn): JsonResponse
    {
        return response()->json([
            'data' => $salesReturn->load([
                'customer', 'invoice:id,no,date', 'lines.item:id,code,name',
            ]),
        ]);
    }

    /** Invoices this customer has, for picking the one being returned against. */
    public function customerInvoices(Request $request): JsonResponse
    {
        $customerId = (int) $request->input('customer_id');
        abort_if($customerId <= 0, 422, 'Pick a customer first.');

        $rows = Invoice::query()
            ->where('customer_id', $customerId)
            ->whereNull('cancelled_at')
            ->select(['id', 'no', 'date', 'type', 'subtotal', 'discount_amount', 'total'])
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * The invoice as the returns screen needs it: every line priced the way it
     * was billed — the invoice's discount worked back into each unit — and what
     * is still left to return after earlier returns.
     */
    public function returnableInvoice(Invoice $invoice): JsonResponse
    {
        abort_if((bool) $invoice->cancelled_at, 422, 'This invoice is cancelled.');

        $invoice->load(['customer:id,code,name,phone,address', 'lines.item:id,code,name']);

        $rate = $this->discountRate($invoice);

        // How much of each line has already gone back.
        $returnedByLine = $this->returnedQtyByLine($invoice->id);

        $lines = $invoice->lines->map(function ($line) use ($rate, $returnedByLine) {
            $returned = (int) ($returnedByLine[$line->id] ?? 0);
            $unitNet = round((float) $line->price * (1 - $rate / 100), 2);

            return [
                'invoice_line_id' => (int) $line->id,
                'item_id' => (int) $line->item_id,
                'batch_id' => $line->batch_id ? (int) $line->batch_id : null,
                'code' => $line->item->code ?? null,
                'name' => $line->name,
                'qty' => (int) $line->qty,
                'price' => (float) $line->price,
                'discount_rate' => $rate,
                // What one unit is worth back, discount included.
                'unit_net' => $unitNet,
                'line_total' => (float) $line->total,
                'returned_qty' => $returned,
                'returnable_qty' => max(0, (int) $line->qty - $returned),
            ];
        });

        return response()->json([
            'data' => [
                'invoice' => $invoice->only(['id', 'no', 'date', 'type', 'subtotal', 'discount_amount', 'total']),
                'customer' => $invoice->customer,
                'discount_rate' => $rate,
                'lines' => $lines,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invoice_id' => ['required', 'integer', 'exists:invoices,id'],
            'note' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.invoice_line_id' => ['required', 'integer', 'exists:invoice_lines,id'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $return = DB::transaction(function () use ($data, $request) {
            /** @var Invoice $invoice */
            $invoice = Invoice::query()->with('lines')->lockForUpdate()->findOrFail($data['invoice_id']);
            abort_if((bool) $invoice->cancelled_at, 422, 'This invoice is cancelled — nothing can be returned against it.');

            $rate = $this->discountRate($invoice);
            $byId = $invoice->lines->keyBy('id');

            // Everything already returned off this invoice, so a line cannot go
            // back twice.
            $already = $this->returnedQtyByLine($invoice->id);

            $return = SalesReturn::query()->create([
                'no' => NumberService::next(SalesReturn::class, 'SR-'),
                'date' => now()->toDateString(),
                'customer_id' => $invoice->customer_id,
                'invoice_id' => $invoice->id,
                'total' => 0,
                'note' => $data['note'] ?? null,
                'created_by' => optional($request->user())->id,
            ]);

            $total = 0.0;
            foreach ($data['lines'] as $row) {
                $line = $byId[$row['invoice_line_id']] ?? null;
                abort_if(! $line, 422, 'That item is not on this invoice.');

                $qty = (int) $row['qty'];
                $left = (int) $line->qty - (int) ($already[$line->id] ?? 0);
                abort_if(
                    $qty > $left,
                    422,
                    "Only {$left} of {$line->name} left to return on this invoice."
                );

                $lineTotal = round($qty * (float) $line->price * (1 - $rate / 100), 2);

                $return->lines()->create([
                    'invoice_line_id' => $line->id,
                    'item_id' => $line->item_id,
                    'batch_id' => $line->batch_id,
                    'name' => $line->name,
                    'qty' => $qty,
                    'price' => $line->price,
                    'discount_rate' => $rate,
                    'total' => $lineTotal,
                ]);

                // Deliberately no stock movement: the goods are recorded on the
                // return and nowhere else, so item quantities and cost lots stay
                // exactly as the sale left them.

                $total = round($total + $lineTotal, 2);
            }

            $return->update(['total' => $total]);

            return $return;
        });

        return response()->json([
            'data' => $return->fresh(['customer', 'invoice:id,no', 'lines.item:id,code,name']),
        ], 201);
    }

    /**
     * Delete a return and the credit it made — but only while none of that
     * credit has been billed against. Nothing to undo in stock: a return never
     * moved any.
     */
    public function destroy(SalesReturn $salesReturn): JsonResponse
    {
        $used = (float) $salesReturn->allocations()->sum('amount');
        abort_if(
            $used > 0,
            422,
            'This return has already been credited on a later invoice. Edit that invoice first.'
        );

        DB::transaction(function () use ($salesReturn) {
            $salesReturn->lines()->delete();
            $salesReturn->delete();
        });

        return response()->json(['message' => 'Sales return deleted']);
    }

    /** Credit a customer has waiting, for the invoice screen to offer. */
    public function credit(Request $request): JsonResponse
    {
        $customerId = (int) $request->input('customer_id');
        abort_if($customerId <= 0, 422, 'Pick a customer first.');

        return response()->json([
            'data' => ['available' => $this->credits->availableFor($customerId)],
        ]);
    }

    /**
     * Qty already returned off each line of an invoice, keyed by invoice line id.
     * The sum needs its own alias — plucking a raw expression has nothing to
     * name the column by.
     */
    private function returnedQtyByLine(int $invoiceId): \Illuminate\Support\Collection
    {
        return DB::table('sales_return_lines')
            ->join('sales_returns', 'sales_returns.id', '=', 'sales_return_lines.sales_return_id')
            ->where('sales_returns.invoice_id', $invoiceId)
            ->whereNotNull('sales_return_lines.invoice_line_id')
            ->groupBy('sales_return_lines.invoice_line_id')
            ->selectRaw('sales_return_lines.invoice_line_id AS line_id, SUM(sales_return_lines.qty) AS qty')
            ->pluck('qty', 'line_id');
    }

    /** The invoice's own discount, as one rate — cash + cheque + credit. */
    private function discountRate(Invoice $invoice): float
    {
        return round(
            (float) $invoice->cash_discount
            + (float) $invoice->cheque_discount
            + (float) $invoice->credit_discount,
            2
        );
    }
}
