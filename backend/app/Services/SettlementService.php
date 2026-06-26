<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\Supplier;

/**
 * Posts settlements (receipts / payments) against a party's outstanding.
 *
 * Cash-like settlements post immediately; cheque settlements post only when the
 * cheque is marked passed. Each apply* returns a snapshot so the matching
 * reverse* can undo it exactly when a cheque is unticked.
 */
class SettlementService
{
    /**
     * Collect from a customer: clear invoice balance first, then opening
     * outstanding (credit_limit); spread the invoice part across credit invoices
     * oldest-first.
     */
    public function applyReceivable(Customer $customer, float $amount): array
    {
        $total = (float) $customer->credit_limit + (float) $customer->balance;
        $amount = min(round($amount, 2), $total);

        $fromBalance = min($amount, (float) $customer->balance);
        $fromOpening = round($amount - $fromBalance, 2);
        $invoices = [];

        if ($fromBalance > 0) {
            $customer->decrement('balance', $fromBalance);

            $remaining = $fromBalance;
            Invoice::query()
                ->where('customer_id', $customer->id)
                ->where('type', 'credit')
                ->whereRaw('total - paid > 0')
                ->orderBy('date')->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->each(function (Invoice $inv) use (&$remaining, &$invoices) {
                    if ($remaining <= 0) {
                        return;
                    }
                    $due = (float) $inv->total - (float) $inv->paid;
                    $pay = min($due, $remaining);
                    $remaining -= $pay;
                    $newPaid = round((float) $inv->paid + $pay, 2);
                    $inv->update([
                        'paid' => $newPaid,
                        'status' => $newPaid >= (float) $inv->total ? 'paid' : 'partial',
                    ]);
                    $invoices[$inv->id] = round($pay, 2);
                });
        }

        if ($fromOpening > 0) {
            $customer->decrement('credit_limit', $fromOpening);
            // Collected against opening outstanding — surfaced in the Paid bar.
            $customer->increment('opening_collected', $fromOpening);
        }

        return ['balance' => round($fromBalance, 2), 'opening' => $fromOpening, 'invoices' => $invoices];
    }

    public function reverseReceivable(Customer $customer, array $applied): void
    {
        foreach (($applied['invoices'] ?? []) as $id => $amt) {
            $inv = Invoice::query()->find($id);
            if (! $inv) {
                continue;
            }
            $newPaid = round((float) $inv->paid - (float) $amt, 2);
            $inv->update([
                'paid' => max($newPaid, 0),
                'status' => $newPaid <= 0 ? 'unpaid' : ($newPaid >= (float) $inv->total ? 'paid' : 'partial'),
            ]);
        }

        if (! empty($applied['balance'])) {
            $customer->increment('balance', (float) $applied['balance']);
        }
        if (! empty($applied['opening'])) {
            $customer->increment('credit_limit', (float) $applied['opening']);
            $customer->decrement('opening_collected', (float) $applied['opening']);
        }
    }

    /**
     * Pay a supplier: reduce payable and spread across credit GRNs oldest-first.
     */
    public function applyPayable(Supplier $supplier, float $amount): array
    {
        $amount = min(round($amount, 2), (float) $supplier->payable);
        if ($amount <= 0) {
            return ['payable' => 0, 'grns' => []];
        }

        $supplier->decrement('payable', $amount);

        $grns = [];
        $remaining = $amount;
        Grn::query()
            ->where('supplier_id', $supplier->id)
            ->where('type', 'credit')
            ->whereRaw('total - paid > 0')
            ->orderBy('date')->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->each(function (Grn $g) use (&$remaining, &$grns) {
                if ($remaining <= 0) {
                    return;
                }
                $due = (float) $g->total - (float) $g->paid;
                $pay = min($due, $remaining);
                $remaining -= $pay;
                $newPaid = round((float) $g->paid + $pay, 2);
                $g->update([
                    'paid' => $newPaid,
                    'status' => $newPaid >= (float) $g->total ? 'paid' : 'partial',
                ]);
                $grns[$g->id] = round($pay, 2);
            });

        return ['payable' => round($amount, 2), 'grns' => $grns];
    }

    public function reversePayable(Supplier $supplier, array $applied): void
    {
        foreach (($applied['grns'] ?? []) as $id => $amt) {
            $g = Grn::query()->find($id);
            if (! $g) {
                continue;
            }
            $newPaid = round((float) $g->paid - (float) $amt, 2);
            $g->update([
                'paid' => max($newPaid, 0),
                'status' => $newPaid <= 0 ? 'unpaid' : ($newPaid >= (float) $g->total ? 'paid' : 'partial'),
            ]);
        }

        if (! empty($applied['payable'])) {
            $supplier->increment('payable', (float) $applied['payable']);
        }
    }
}
