<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceReturnCredit;
use App\Models\SalesReturn;

/**
 * Return credit: what a customer is owed for goods they handed back.
 *
 * It is never refunded in cash and never rewrites the bill the goods were sold
 * on. It sits against the customer until their next invoice, which draws it
 * down — after discount and tax, because the returned money was already
 * discounted on the invoice it came from.
 */
class ReturnCreditService
{
    /** Credit this customer still has to spend. */
    public function availableFor(int $customerId): float
    {
        $returns = SalesReturn::query()
            ->where('customer_id', $customerId)
            ->withSum('allocations as used', 'amount')
            ->get();

        return round($returns->sum(fn ($r) => (float) $r->total - (float) ($r->used ?? 0)), 2);
    }

    /**
     * Spend up to `$wanted` of the customer's credit on this invoice, oldest
     * return first, and record which return each part came from.
     *
     * Returns the amount actually taken — never more than is available, and
     * never more than the bill.
     */
    public function apply(Invoice $invoice, float $wanted): float
    {
        $this->release($invoice);

        $remaining = round(max(0.0, $wanted), 2);
        if ($remaining <= 0) {
            return 0.0;
        }

        $returns = SalesReturn::query()
            ->where('customer_id', $invoice->customer_id)
            ->withSum('allocations as used', 'amount')
            ->orderBy('date')->orderBy('id')
            ->lockForUpdate()
            ->get();

        $taken = 0.0;
        foreach ($returns as $return) {
            if ($remaining <= 0) {
                break;
            }
            $free = round((float) $return->total - (float) ($return->used ?? 0), 2);
            if ($free <= 0) {
                continue;
            }

            $use = min($free, $remaining);
            InvoiceReturnCredit::query()->create([
                'invoice_id' => $invoice->id,
                'sales_return_id' => $return->id,
                'amount' => $use,
            ]);

            $taken = round($taken + $use, 2);
            $remaining = round($remaining - $use, 2);
        }

        return $taken;
    }

    /** Hand back everything this invoice had taken — for an edit or a cancel. */
    public function release(Invoice $invoice): void
    {
        InvoiceReturnCredit::query()->where('invoice_id', $invoice->id)->delete();
    }
}
