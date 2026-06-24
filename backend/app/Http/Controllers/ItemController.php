<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreItemRequest;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $category = (int) $request->input('category_id');

        $items = Item::query()
            ->with('category:id,name')
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

        return response()->json(['data' => $item->load('category:id,name')], 201);
    }

    public function update(StoreItemRequest $request, Item $item): JsonResponse
    {
        $item->update($request->validated());

        return response()->json(['data' => $item->fresh('category:id,name')]);
    }

    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
