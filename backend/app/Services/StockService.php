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

        $this->reconcile($itemId, (int) $item->stock);

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

    /**
     * Pull drifted quantity back into the cost-batch it belongs to.
     *
     * A batch may only be short by what was genuinely taken from it: live
     * invoice lines and manual adjustments booked against that batch. Any other
     * gap is drift from a restore that returned the quantity to opening stock
     * instead of its own cost lot, so we claim it back from opening — never
     * beyond what opening actually holds, so stock is only ever moved between
     * lots, never invented.
     */
    public function reconcile(int $itemId, ?int $stock = null): void
    {
        $batches = ItemBatch::query()->where('item_id', $itemId)
            ->lockForUpdate()->get(['id', 'qty_in', 'qty_remaining']);
        if ($batches->isEmpty()) {
            return;
        }

        $stock = $stock ?? (int) DB::table('items')->where('id', $itemId)->value('stock');
        $ids = $batches->pluck('id')->all();

        $sold = DB::table('invoice_lines')
            ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->whereIn('invoice_lines.batch_id', $ids)
            ->groupBy('invoice_lines.batch_id')
            ->selectRaw('invoice_lines.batch_id AS b, SUM(invoice_lines.qty) AS q')
            ->pluck('q', 'b');

        $adjusted = DB::table('stock_adjustments')
            ->whereIn('batch_id', $ids)
            ->groupBy('batch_id')
            ->selectRaw('batch_id AS b, SUM(qty) AS q')
            ->pluck('q', 'b');

        $held = (int) $batches->sum('qty_remaining');
        foreach ($batches as $b) {
            $expected = max(0, (int) $b->qty_in - (int) ($sold[$b->id] ?? 0) + (int) ($adjusted[$b->id] ?? 0));
            $delta = $expected - (int) $b->qty_remaining;
            if ($delta > 0) {
                // Only ever reclaim what is actually sitting loose in opening.
                $delta = min($delta, max(0, $stock - $held));
            }
            if ($delta === 0) {
                continue;
            }
            ItemBatch::query()->whereKey($b->id)->update(['qty_remaining' => (int) $b->qty_remaining + $delta]);
            $held += $delta;
        }
    }

    /** @param iterable<int> $itemIds */
    public function reconcileMany(iterable $itemIds): void
    {
        foreach ($this->uniqueIds($itemIds) as $id) {
            $this->reconcile($id);
        }
    }

    /** @param iterable<int> $itemIds */
    public function projectMany(iterable $itemIds): void
    {
        foreach ($this->uniqueIds($itemIds) as $id) {
            $this->project($id);
        }
    }

    /**
     * @param  iterable<int>  $itemIds
     * @return array<int>
     */
    private function uniqueIds(iterable $itemIds): array
    {
        return array_unique(array_map('intval', is_array($itemIds) ? $itemIds : iterator_to_array($itemIds)));
    }
}
