<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\ItemBatch;
use App\Models\StockAdjustment;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAdjustmentController extends Controller
{
    /**
     * An item's lots: opening stock + each GRN cost-batch, with cost/price and
     * current quantity. Drives the adjustment screen.
     */
    public function lots(Item $item): JsonResponse
    {
        $batches = ItemBatch::query()
            ->where('item_id', $item->id)
            ->leftJoin('grns', 'grns.id', '=', 'item_batches.grn_id')
            ->orderBy('item_batches.id')
            ->get([
                'item_batches.id as batch_id',
                'item_batches.grn_id',
                'grns.no as grn_no',
                'grns.date as grn_date',
                'item_batches.unit_cost',
                'item_batches.qty_remaining as qty',
            ]);

        $held = (int) $batches->sum('qty');
        $lots = [];
        $opening = (int) $item->stock - $held;
        if ($opening > 0 || $batches->isEmpty()) {
            $lots[] = [
                'batch_id' => null, 'grn_id' => 0, 'grn_no' => null, 'grn_date' => null,
                'unit_cost' => null, 'price' => (float) $item->retail_price, 'qty' => max($opening, 0),
            ];
        }
        foreach ($batches as $b) {
            $lots[] = [
                'batch_id' => (int) $b->batch_id, 'grn_id' => (int) $b->grn_id,
                'grn_no' => $b->grn_no, 'grn_date' => $b->grn_date,
                'unit_cost' => (float) $b->unit_cost, 'price' => (float) $b->unit_cost, 'qty' => (int) $b->qty,
            ];
        }

        return response()->json([
            'item' => ['id' => $item->id, 'code' => $item->code, 'name' => $item->name, 'stock' => (int) $item->stock],
            'lots' => $lots,
        ]);
    }

    /** Adjustment history for an item. */
    public function index(Request $request): JsonResponse
    {
        $rows = StockAdjustment::query()
            ->with('createdBy:id,name')
            ->when($request->input('item_id'), fn ($q, $i) => $q->where('item_id', $i))
            ->leftJoin('grns', 'grns.id', '=', 'stock_adjustments.grn_id')
            ->orderByDesc('stock_adjustments.id')
            ->limit(300)
            ->get(['stock_adjustments.*', 'grns.no as grn_no']);

        return response()->json(['data' => $rows]);
    }

    /** Add / reduce stock on one lot (a batch or opening), then re-project. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'item_id' => ['required', 'exists:items,id'],
            'batch_id' => ['nullable', 'exists:item_batches,id'], // null = opening lot
            'qty' => ['required', 'integer', 'min:1'],
            'type' => ['required', 'in:add,reduce'],
            'remark' => ['nullable', 'string', 'max:500'],
        ]);

        $adj = DB::transaction(function () use ($data, $request) {
            /** @var Item $item */
            $item = Item::query()->whereKey($data['item_id'])->lockForUpdate()->firstOrFail();
            $qty = (int) $data['qty'];
            $signed = $data['type'] === 'reduce' ? -$qty : $qty;
            $grnId = 0;

            if (! empty($data['batch_id'])) {
                /** @var ItemBatch $batch */
                $batch = ItemBatch::query()->whereKey($data['batch_id'])->lockForUpdate()->firstOrFail();
                abort_if((int) $batch->item_id !== (int) $item->id, 422, 'That batch belongs to a different item.');
                if ($data['type'] === 'reduce') {
                    abort_if((int) $batch->qty_remaining < $qty, 422, "Only {$batch->qty_remaining} left in this batch.");
                }
                $batch->qty_remaining = (int) $batch->qty_remaining + $signed;
                $batch->save();
                $grnId = (int) $batch->grn_id;
            } elseif ($data['type'] === 'reduce') {
                // Opening lot = stock not held in any batch.
                $held = (int) ItemBatch::query()->where('item_id', $item->id)->sum('qty_remaining');
                $opening = (int) $item->stock - $held;
                abort_if($opening < $qty, 422, "Only {$opening} in opening stock.");
            }

            $item->stock = (int) $item->stock + $signed;
            $item->save();

            $adj = StockAdjustment::query()->create([
                'item_id' => $item->id,
                'grn_id' => $grnId,
                'batch_id' => $data['batch_id'] ?? null,
                'qty' => $signed,
                'type' => $data['type'],
                'remark' => $data['remark'] ?? null,
                'created_by' => optional($request->user())->id,
            ]);

            app(StockService::class)->project((int) $item->id);

            return $adj;
        });

        return response()->json(['data' => $adj], 201);
    }
}
