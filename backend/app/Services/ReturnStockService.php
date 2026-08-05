<?php

namespace App\Services;

use App\Models\SalesReturnLine;
use Illuminate\Support\Collection;

/**
 * The pool of customer-returned goods still sitting with us.
 *
 * A sales return records goods coming back without touching stock, so they are
 * not on the shelf to sell — they wait here until a GRN hands them back to the
 * supplier. Each hand-back draws its line down, and what is left is what the
 * next GRN can offer.
 */
class ReturnStockService
{
    /**
     * Returned goods still to be sent back, one row per sales return line, at
     * the cost they were bought on.
     *
     * `$includeGrnId` keeps the quantities an existing GRN already claimed in
     * the pool, so editing that GRN can still see its own lines.
     */
    public function available(?int $includeGrnId = null): Collection
    {
        return SalesReturnLine::query()
            ->with([
                'item:id,code,name,distributor_price',
                'salesReturn:id,no,date,customer_id',
                'salesReturn.customer:id,name',
            ])
            // The cost lot the goods were sold from is what we paid for them.
            ->leftJoin('item_batches', 'item_batches.id', '=', 'sales_return_lines.batch_id')
            ->leftJoin('items', 'items.id', '=', 'sales_return_lines.item_id')
            ->withSum(['grnReturnLines as sent' => function ($q) use ($includeGrnId) {
                if ($includeGrnId) {
                    $q->where('grn_id', '!=', $includeGrnId);
                }
            }], 'qty')
            ->selectRaw('sales_return_lines.*, COALESCE(item_batches.unit_cost, items.distributor_price, 0) AS cost_basis')
            ->orderBy('sales_return_lines.id')
            ->get()
            ->map(function (SalesReturnLine $l) {
                $left = (int) $l->qty - (int) ($l->sent ?? 0);

                return [
                    'sales_return_line_id' => (int) $l->id,
                    'item_id' => (int) $l->item_id,
                    'code' => $l->item->code ?? null,
                    'name' => $l->name,
                    'return_no' => $l->salesReturn->no ?? null,
                    // `optional()` rather than `?->`, which PHP 7.4 cannot parse.
                    'return_date' => optional(optional($l->salesReturn)->date)->toDateString(),
                    'customer' => $l->salesReturn->customer->name ?? null,
                    'returned_qty' => (int) $l->qty,
                    'sent_qty' => (int) ($l->sent ?? 0),
                    'qty_available' => max(0, $left),
                    'unit_cost' => round((float) $l->cost_basis, 2),
                ];
            })
            ->filter(fn ($row) => $row['qty_available'] > 0)
            ->values();
    }

    /** Same pool keyed by line id, for validating a save. */
    public function availableById(?int $includeGrnId = null): Collection
    {
        return $this->available($includeGrnId)->keyBy('sales_return_line_id');
    }
}
