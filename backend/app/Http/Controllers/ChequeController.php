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
                'invoice_no' => optional($c->invoice)->no,
                'customer_id' => optional($c->invoice)->customer_id,
                'customer_name' => optional(optional($c->invoice)->customer)->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'invoice_total' => (float) (optional($c->invoice)->total ?? 0),
                'invoice_paid' => (float) (optional($c->invoice)->paid ?? 0),
                'cleared' => (bool) $c->cleared_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Tick / untick a cheque as "passed". Clearing applies the cheque value as a
     * payment (paid += value, customer balance -= value); unticking reverses it.
     */
    public function toggle(InvoiceCheque $cheque, SettlementService $posting): JsonResponse
    {
        DB::transaction(function () use ($cheque, $posting) {
            /** @var Invoice $invoice */
            $invoice = Invoice::query()->whereKey($cheque->invoice_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $cheque->amount;
            $customerId = (int) $invoice->customer_id;

            if ($cheque->cleared_at) {
                // Take back exactly what was put on the invoice, then undo the
                // surplus wherever it went. Cheques cleared before the snapshot
                // existed have no record, so the whole value comes off here.
                $applied = is_array($cheque->applied) ? $cheque->applied : null;
                $onInvoice = $applied ? (float) ($applied['invoice'] ?? 0) : $amount;
                $invoice->paid = round((float) $invoice->paid - $onInvoice, 2);
                $this->saveInvoiceStatus($invoice);

                if ($applied && ! empty($applied['spill']) && $customerId) {
                    $customer = Customer::query()->whereKey($customerId)->lockForUpdate()->firstOrFail();
                    $posting->reverseReceivable($customer, $applied['spill']);
                }
                $cheque->applied = null;
                $cheque->cleared_at = null;
                $cheque->save();
            } else {
                // A cheque may be worth more than the invoice still owes — the
                // rest of the bill was already collected by a receipt. Only the
                // due part goes on the invoice; the surplus is real money too,
                // so it settles the customer's other invoices and opening due
                // instead of being lost to the overpayment clamp below.
                $due = round((float) $invoice->total - (float) $invoice->paid, 2);
                $onInvoice = max(0.0, min($amount, $due));
                $invoice->paid = round((float) $invoice->paid + $onInvoice, 2);
                $this->saveInvoiceStatus($invoice);

                $surplus = round($amount - $onInvoice, 2);
                $spill = null;
                if ($surplus > 0 && $customerId) {
                    // Reconcile first so the spill is spread over what the
                    // customer actually still owes right now.
                    $this->reconcileCustomerBalance($customerId);
                    $customer = Customer::query()->whereKey($customerId)->lockForUpdate()->firstOrFail();
                    $spill = $posting->applyReceivable($customer, $surplus);
                }

                $cheque->applied = ['invoice' => $onInvoice, 'spill' => $spill];
                $cheque->cleared_at = now();
                $cheque->save();
            }

            // Recompute the customer's running outstanding from the invoices instead
            // of nudging it by the cheque value — over/under-applied cheques then
            // can't drift it (an overpaid invoice contributes 0, never negative).
            $this->reconcileCustomerBalance($customerId);
        });

        return response()->json(['data' => $cheque->fresh()]);
    }

    private function saveInvoiceStatus(Invoice $invoice): void
    {
        $balance = round((float) $invoice->total - (float) $invoice->paid, 2);
        $invoice->status = $balance <= 0 ? 'paid' : ((float) $invoice->paid > 0 ? 'partial' : 'unpaid');
        $invoice->save();
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
                'grn_no' => optional($c->grn)->no,
                'supplier_id' => optional($c->grn)->supplier_id,
                'supplier_name' => optional(optional($c->grn)->supplier)->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'grn_total' => (float) (optional($c->grn)->total ?? 0),
                'grn_paid' => (float) (optional($c->grn)->paid ?? 0),
                'cleared' => (bool) $c->cleared_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Tick / untick a GRN cheque as "passed". Clearing applies it as a payment
     * to the supplier (grn paid += value, supplier payable -= value).
     */
    public function grnToggle(GrnCheque $grnCheque, SettlementService $posting): JsonResponse
    {
        DB::transaction(function () use ($grnCheque, $posting) {
            /** @var Grn $grn */
            $grn = Grn::query()->whereKey($grnCheque->grn_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $grnCheque->amount;
            $supplierId = (int) $grn->supplier_id;

            if ($grnCheque->cleared_at) {
                $applied = is_array($grnCheque->applied) ? $grnCheque->applied : null;
                $onGrn = $applied ? (float) ($applied['grn'] ?? 0) : $amount;
                $grn->paid = round((float) $grn->paid - $onGrn, 2);
                $this->saveGrnStatus($grn);

                if ($applied && ! empty($applied['spill']) && $supplierId) {
                    $supplier = Supplier::query()->whereKey($supplierId)->lockForUpdate()->firstOrFail();
                    $posting->reversePayable($supplier, $applied['spill']);
                }
                $grnCheque->applied = null;
                $grnCheque->cleared_at = null;
                $grnCheque->save();
            } else {
                // Same as the invoice side: only what this GRN still owes goes
                // on it, the surplus pays down the supplier's other GRNs.
                $due = round((float) $grn->total - (float) $grn->paid, 2);
                $onGrn = max(0.0, min($amount, $due));
                $grn->paid = round((float) $grn->paid + $onGrn, 2);
                $this->saveGrnStatus($grn);

                $surplus = round($amount - $onGrn, 2);
                $spill = null;
                if ($surplus > 0 && $supplierId) {
                    $this->reconcileSupplierPayable($supplierId);
                    $supplier = Supplier::query()->whereKey($supplierId)->lockForUpdate()->firstOrFail();
                    $spill = $posting->applyPayable($supplier, $surplus);
                }

                $grnCheque->applied = ['grn' => $onGrn, 'spill' => $spill];
                $grnCheque->cleared_at = now();
                $grnCheque->save();
            }

            // Recompute the supplier's payable from the GRNs (same anti-drift rule).
            $this->reconcileSupplierPayable($supplierId);
        });

        return response()->json(['data' => $grnCheque->fresh()]);
    }

    private function saveGrnStatus(Grn $grn): void
    {
        $balance = round((float) $grn->total - (float) $grn->paid, 2);
        $grn->status = $balance <= 0 ? 'paid' : ((float) $grn->paid > 0 ? 'partial' : 'unpaid');
        $grn->save();
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
                'settlement_code' => optional($c->settlement)->code,
                'side' => optional($c->settlement)->side,
                'customer_id' => optional($c->settlement)->customer_id,
                'supplier_id' => optional($c->settlement)->supplier_id,
                'party_name' => optional(optional($c->settlement)->customer)->name ?? optional(optional($c->settlement)->supplier)->name,
                'cheque_no' => $c->cheque_no,
                'cheque_date' => optional($c->cheque_date)->toDateString(),
                'amount' => (float) $c->amount,
                'settlement_amount' => (float) (optional($c->settlement)->amount ?? 0),
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

            if ($settlement->side === 'receivable' && $settlement->customer_id) {
                $this->reconcileCustomerBalance((int) $settlement->customer_id);
            } elseif ($settlement->supplier_id) {
                $this->reconcileSupplierPayable((int) $settlement->supplier_id);
            }
        });

        return response()->json(['data' => $settlementCheque->fresh()]);
    }

    /**
     * A customer's running balance is the sum of their unpaid credit invoices
     * (opening dues live separately in credit_limit). Recomputing it from the
     * invoices keeps it exact; GREATEST(.,0) means an overpaid invoice contributes
     * 0 so the outstanding can never be pushed below the opening.
     */
    private function reconcileCustomerBalance(int $customerId): void
    {
        $unpaid = (float) Invoice::query()
            ->where('customer_id', $customerId)
            ->where('type', 'credit')
            ->whereNull('cancelled_at')
            ->selectRaw('COALESCE(SUM(GREATEST(total - paid, 0)), 0) AS v')
            ->value('v');
        Customer::query()->whereKey($customerId)->update(['balance' => round($unpaid, 2)]);
    }

    /** Supplier payable is the sum of unpaid credit GRNs (same anti-drift rule). */
    private function reconcileSupplierPayable(int $supplierId): void
    {
        $unpaid = (float) Grn::query()
            ->where('supplier_id', $supplierId)
            ->where('type', 'credit')
            ->whereNull('cancelled_at')
            ->selectRaw('COALESCE(SUM(GREATEST(total - paid, 0)), 0) AS v')
            ->value('v');
        Supplier::query()->whereKey($supplierId)->update(['payable' => round($unpaid, 2)]);
    }
}
