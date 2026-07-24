<?php

namespace App\Services;

use App\Models\ItemBatch;
use App\Models\Stock;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the `stocks` ledger (one row per item + GRN lot, plus a grn_id = 0
 * opening row) in sync with the authoritative item stock and cost-batches.
 *
 * The GRN / invoice / product controllers already maintain items.stock and
 * item_batches.qty_remaining inside their transactions; after those updates
 * they call project() so the stocks table always reflects the new position.
 */
class StockService
{
    /** Rebuild the stock rows for one item from its batches + opening remainder. */
    public function project(int $itemId): void
    {
        $item = DB::table('items')->where('id', $itemId)->first(['id', 'stock']);
        if (! $item) {
            Stock::query()->where('item_id', $itemId)->delete();

            return;
        }

        $batches = ItemBatch::query()
            ->where('item_id', $itemId)
            ->where('qty_remaining', '>', 0)
            ->get(['grn_id', 'qty_remaining']);

        $rows = [];
        $held = 0;
        foreach ($batches as $b) {
            $rows[(int) $b->grn_id] = ($rows[(int) $b->grn_id] ?? 0) + (int) $b->qty_remaining;
            $held += (int) $b->qty_remaining;
        }
        $opening = (int) $item->stock - $held;
        if ($opening > 0) {
            $rows[0] = ($rows[0] ?? 0) + $opening;
        }

        // Replace this item's rows with the freshly computed set.
        Stock::query()->where('item_id', $itemId)->delete();
        $now = now();
        $insert = [];
        foreach ($rows as $grnId => $qty) {
            if ($qty <= 0) {
                continue;
            }
            $insert[] = ['item_id' => $itemId, 'grn_id' => $grnId, 'qty' => $qty, 'created_at' => $now, 'updated_at' => $now];
        }
        if ($insert) {
            Stock::query()->insert($insert);
        }
    }

    /** @param iterable<int> $itemIds */
    public function projectMany(iterable $itemIds): void
    {
        foreach (array_unique(array_map('intval', is_array($itemIds) ? $itemIds : iterator_to_array($itemIds))) as $id) {
            $this->project($id);
        }
    }
}
