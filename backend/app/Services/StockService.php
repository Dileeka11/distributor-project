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
            ->get(['id', 'grn_id', 'qty_remaining']);

        // One lot per cost-batch (keyed by batch, so a batch whose GRN row is
        // gone keeps its own lot instead of collapsing into opening), plus the
        // opening remainder as batch 0.
        $now = now();
        $insert = [];
        $held = 0;
        foreach ($batches as $b) {
            $qty = (int) $b->qty_remaining;
            $held += $qty;
            $insert[] = [
                'item_id' => $itemId, 'grn_id' => (int) ($b->grn_id ?? 0), 'batch_id' => (int) $b->id,
                'qty' => $qty, 'created_at' => $now, 'updated_at' => $now,
            ];
        }
        $opening = (int) $item->stock - $held;
        if ($opening > 0) {
            $insert[] = [
                'item_id' => $itemId, 'grn_id' => 0, 'batch_id' => 0,
                'qty' => $opening, 'created_at' => $now, 'updated_at' => $now,
            ];
        }

        // Replace this item's rows with the freshly computed set.
        Stock::query()->where('item_id', $itemId)->delete();
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
