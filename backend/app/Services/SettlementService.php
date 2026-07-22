<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\Settlement;
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
        $restore = (float) ($applied['balance'] ?? 0);
        foreach (($applied['invoices'] ?? []) as $id => $amt) {
            $inv = Invoice::query()->find($id);
            if (! $inv) {
                // Invoice deleted since — its share has no outstanding to return to.
                $restore = round($restore - (float) $amt, 2);
                continue;
            }
            $newPaid = round((float) $inv->paid - (float) $amt, 2);
            $inv->update([
                'paid' => max($newPaid, 0),
                'status' => $newPaid <= 0 ? 'unpaid' : ($newPaid >= (float) $inv->total ? 'paid' : 'partial'),
            ]);
        }

        if ($restore > 0) {
            $customer->increment('balance', $restore);
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
        $restore = (float) ($applied['payable'] ?? 0);
        foreach (($applied['grns'] ?? []) as $id => $amt) {
            $g = Grn::query()->find($id);
            if (! $g) {
                // GRN deleted since — its share has no outstanding to return to.
                $restore = round($restore - (float) $amt, 2);
                continue;
            }
            $newPaid = round((float) $g->paid - (float) $amt, 2);
            $g->update([
                'paid' => max($newPaid, 0),
                'status' => $newPaid <= 0 ? 'unpaid' : ($newPaid >= (float) $g->total ? 'paid' : 'partial'),
            ]);
        }

        if ($restore > 0) {
            $supplier->increment('payable', $restore);
        }
    }

    /**
     * Undo everything a settlement posted: cheque settlements reverse each
     * cleared cheque from its own snapshot; cash-like settlements reverse the
     * settlement snapshot.
     */
    public function reverseSettlementPosting(Settlement $settlement): void
    {
        $settlement->loadMissing('cheques');

        if ($settlement->mode === 'Cheque') {
            foreach ($settlement->cheques as $cheque) {
                if ($cheque->cleared_at && is_array($cheque->applied)) {
                    $this->reverseSnapshot($settlement, $cheque->applied);
                }
            }
        } elseif (is_array($settlement->applied)) {
            $this->reverseSnapshot($settlement, $settlement->applied);
        }
    }

    /**
     * A GRN is being deleted: reverse and remove every payment (settlement)
     * that was applied to it, so no orphaned transactions stay in history.
     */
    public function purgeSettlementsForGrn(Grn $grn): void
    {
        Settlement::query()
            ->where('side', 'payable')
            ->where('supplier_id', $grn->supplier_id)
            ->with('cheques')
            ->lockForUpdate()
            ->get()
            ->each(function (Settlement $s) use ($grn) {
                if (! $this->snapshotTouches($s, 'grns', (int) $grn->id)) {
                    return;
                }
                $this->reverseSettlementPosting($s);
                $s->delete(); // cheques cascade
            });
    }

    /** Same cleanup for the customer side when an invoice is deleted. */
    public function purgeSettlementsForInvoice(Invoice $invoice): void
    {
        Settlement::query()
            ->where('side', 'receivable')
            ->where('customer_id', $invoice->customer_id)
            ->with('cheques')
            ->lockForUpdate()
            ->get()
            ->each(function (Settlement $s) use ($invoice) {
                if (! $this->snapshotTouches($s, 'invoices', (int) $invoice->id)) {
                    return;
                }
                $this->reverseSettlementPosting($s);
                $s->delete(); // cheques cascade
            });
    }

    /** Did this settlement (or any of its cleared cheques) apply to the given row? */
    private function snapshotTouches(Settlement $s, string $key, int $id): bool
    {
        if (is_array($s->applied) && isset($s->applied[$key][$id])) {
            return true;
        }
        foreach ($s->cheques as $c) {
            if (is_array($c->applied) && isset($c->applied[$key][$id])) {
                return true;
            }
        }

        return false;
    }

    private function reverseSnapshot(Settlement $settlement, array $applied): void
    {
        if ($settlement->side === 'receivable' && $settlement->customer_id) {
            $customer = Customer::query()->whereKey($settlement->customer_id)->lockForUpdate()->firstOrFail();
            $this->reverseReceivable($customer, $applied);
        } elseif ($settlement->supplier_id) {
            $supplier = Supplier::query()->whereKey($settlement->supplier_id)->lockForUpdate()->firstOrFail();
            $this->reversePayable($supplier, $applied);
        }
    }
}
