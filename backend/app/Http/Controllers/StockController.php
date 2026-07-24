<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    /**
     * Per-lot stock: one row per (item, GRN) with the GRN number, quantity and
     * that lot's cost. grn_id = 0 is opening / non-GRN stock.
     */
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));

        $rows = DB::table('stocks')
            ->join('items', 'items.id', '=', 'stocks.item_id')
            ->leftJoin('grns', 'grns.id', '=', 'stocks.grn_id')
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('items.name', 'like', "%{$q}%")->orWhere('items.code', 'like', "%{$q}%");
            }))
            ->orderBy('items.name')
            ->orderByRaw('stocks.grn_id = 0 desc')  // opening first
            ->orderBy('stocks.grn_id')
            ->get([
                'stocks.item_id',
                'items.code as item_code',
                'items.name as item_name',
                'items.stock as item_total',
                'stocks.grn_id',
                'grns.no as grn_no',
                'grns.date as grn_date',
                'stocks.qty',
                DB::raw('(SELECT ib.unit_cost FROM item_batches ib WHERE ib.item_id = stocks.item_id AND ib.grn_id = stocks.grn_id ORDER BY ib.id LIMIT 1) as unit_cost'),
            ]);

        return response()->json(['data' => $rows]);
    }
}
