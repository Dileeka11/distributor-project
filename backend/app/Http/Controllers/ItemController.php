<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreItemRequest;
use App\Models\Item;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function batches(Item $item): JsonResponse
    {
        $batches = $item->batches()
            ->where('qty_remaining', '>', 0)
            ->orderBy('id')
            ->get(['id', 'unit_price', 'discount', 'unit_cost', 'qty_remaining']);

        return response()->json(['data' => $batches]);
    }

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $category = (int) $request->input('category_id');

        $items = Item::query()
            ->with(['category:id,name', 'product:id,item_id,actual_price,selling_price'])
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")->orWhere('code', 'like', "%{$q}%");
            }))
            ->when($category, fn ($qb) => $qb->where('category_id', $category))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(StoreItemRequest $request): JsonResponse
    {
        $item = Item::query()->create($request->validated());
        app(StockService::class)->project((int) $item->id); // opening stock → ledger

        return response()->json(['data' => $item->load('category:id,name')], 201);
    }

    public function update(StoreItemRequest $request, Item $item): JsonResponse
    {
        $item->update($request->validated());
        app(StockService::class)->project((int) $item->id); // opening-stock edits → ledger

        return response()->json(['data' => $item->fresh('category:id,name')]);
    }

    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
