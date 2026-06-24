<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceCheque;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ChequeController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = InvoiceCheque::query()
            ->with(['invoice:id,no,customer_id,total,paid', 'invoice.customer:id,code,name'])
            ->orderBy('cleared_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (InvoiceCheque $c) => [
                'id' => $c->id,
                'invoice_id' => $c->invoice_id,
                'invoice_no' => $c->invoice?->no,
                'customer_id' => $c->invoice?->customer_id,
                'customer_name' => $c->invoice?->customer?->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'invoice_total' => (float) ($c->invoice?->total ?? 0),
                'invoice_paid' => (float) ($c->invoice?->paid ?? 0),
                'cleared' => (bool) $c->cleared_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Tick / untick a cheque as "passed". Clearing applies the cheque value as a
     * payment (paid += value, customer balance -= value); unticking reverses it.
     */
    public function toggle(InvoiceCheque $cheque): JsonResponse
    {
        DB::transaction(function () use ($cheque) {
            /** @var Invoice $invoice */
            $invoice = Invoice::query()->whereKey($cheque->invoice_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $cheque->amount;

            if ($cheque->cleared_at) {
                $invoice->paid = round((float) $invoice->paid - $amount, 2);
                Customer::query()->whereKey($invoice->customer_id)->increment('balance', $amount);
                $cheque->cleared_at = null;
            } else {
                $invoice->paid = round((float) $invoice->paid + $amount, 2);
                Customer::query()->whereKey($invoice->customer_id)->decrement('balance', $amount);
                $cheque->cleared_at = now();
            }

            $balance = round((float) $invoice->total - (float) $invoice->paid, 2);
            $invoice->status = $balance <= 0 ? 'paid' : ((float) $invoice->paid > 0 ? 'partial' : 'unpaid');
            $invoice->save();
            $cheque->save();
        });

        return response()->json(['data' => $cheque->fresh()]);
    }
}
