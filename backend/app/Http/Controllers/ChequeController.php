<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Grn;
use App\Models\GrnCheque;
use App\Models\Invoice;
use App\Models\InvoiceCheque;
use App\Models\SettlementCheque;
use App\Models\Supplier;
use App\Services\SettlementService;
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

    public function grnIndex(): JsonResponse
    {
        $rows = GrnCheque::query()
            ->with(['grn:id,no,supplier_id,total,paid', 'grn.supplier:id,code,name'])
            ->orderBy('cleared_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (GrnCheque $c) => [
                'id' => $c->id,
                'grn_id' => $c->grn_id,
                'grn_no' => $c->grn?->no,
                'supplier_id' => $c->grn?->supplier_id,
                'supplier_name' => $c->grn?->supplier?->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'grn_total' => (float) ($c->grn?->total ?? 0),
                'grn_paid' => (float) ($c->grn?->paid ?? 0),
                'cleared' => (bool) $c->cleared_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Tick / untick a GRN cheque as "passed". Clearing applies it as a payment
     * to the supplier (grn paid += value, supplier payable -= value).
     */
    public function grnToggle(GrnCheque $grnCheque): JsonResponse
    {
        DB::transaction(function () use ($grnCheque) {
            /** @var Grn $grn */
            $grn = Grn::query()->whereKey($grnCheque->grn_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $grnCheque->amount;

            if ($grnCheque->cleared_at) {
                $grn->paid = round((float) $grn->paid - $amount, 2);
                Supplier::query()->whereKey($grn->supplier_id)->increment('payable', $amount);
                $grnCheque->cleared_at = null;
            } else {
                $grn->paid = round((float) $grn->paid + $amount, 2);
                Supplier::query()->whereKey($grn->supplier_id)->decrement('payable', $amount);
                $grnCheque->cleared_at = now();
            }

            $balance = round((float) $grn->total - (float) $grn->paid, 2);
            $grn->status = $balance <= 0 ? 'paid' : ((float) $grn->paid > 0 ? 'partial' : 'unpaid');
            $grn->save();
            $grnCheque->save();
        });

        return response()->json(['data' => $grnCheque->fresh()]);
    }

    /**
     * Cheques captured while settling an outstanding (the Collect / Pay flow).
     * Referenced by the settlement receipt code (e.g. RCP-001 / PAY-001).
     */
    public function settlementIndex(): JsonResponse
    {
        $rows = SettlementCheque::query()
            ->with([
                'settlement:id,code,side,customer_id,supplier_id,amount',
                'settlement.customer:id,name',
                'settlement.supplier:id,name',
            ])
            ->orderBy('cleared_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (SettlementCheque $c) => [
                'id' => $c->id,
                'settlement_id' => $c->settlement_id,
                'settlement_code' => $c->settlement?->code,
                'side' => $c->settlement?->side,
                'customer_id' => $c->settlement?->customer_id,
                'supplier_id' => $c->settlement?->supplier_id,
                'party_name' => $c->settlement?->customer?->name ?? $c->settlement?->supplier?->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'settlement_amount' => (float) ($c->settlement?->amount ?? 0),
                'cleared' => (bool) $c->cleared_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Tick / untick a settlement cheque as "passed". A cheque receipt/payment
     * posts nothing until it clears: passing it applies the value to the party's
     * outstanding (and invoice/GRN paid); unticking reverses it exactly.
     */
    public function settlementToggle(SettlementCheque $settlementCheque, SettlementService $posting): JsonResponse
    {
        DB::transaction(function () use ($settlementCheque, $posting) {
            $settlement = $settlementCheque->settlement()->lockForUpdate()->firstOrFail();

            if ($settlementCheque->cleared_at) {
                // Reverse the posting recorded when it was passed.
                $applied = $settlementCheque->applied ?? [];
                if ($settlement->side === 'receivable' && $settlement->customer_id) {
                    $customer = Customer::query()->whereKey($settlement->customer_id)->lockForUpdate()->firstOrFail();
                    $posting->reverseReceivable($customer, $applied);
                } elseif ($settlement->supplier_id) {
                    $supplier = Supplier::query()->whereKey($settlement->supplier_id)->lockForUpdate()->firstOrFail();
                    $posting->reversePayable($supplier, $applied);
                }
                $settlementCheque->applied = null;
                $settlementCheque->cleared_at = null;
            } else {
                // Post the cheque value now that it has cleared.
                $amount = (float) $settlementCheque->amount;
                if ($settlement->side === 'receivable' && $settlement->customer_id) {
                    $customer = Customer::query()->whereKey($settlement->customer_id)->lockForUpdate()->firstOrFail();
                    $settlementCheque->applied = $posting->applyReceivable($customer, $amount);
                } elseif ($settlement->supplier_id) {
                    $supplier = Supplier::query()->whereKey($settlement->supplier_id)->lockForUpdate()->firstOrFail();
                    $settlementCheque->applied = $posting->applyPayable($supplier, $amount);
                }
                $settlementCheque->cleared_at = now();
            }

            $settlementCheque->save();
        });

        return response()->json(['data' => $settlementCheque->fresh()]);
    }
}
