<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $totalSales = (float) Invoice::query()->sum('total');
        $cashTotal = (float) Invoice::query()->where('type', 'cash')->sum('total');
        $creditTotal = (float) Invoice::query()->where('type', 'credit')->sum('total');
        $receivable = (float) Customer::query()->sum('balance');
        $payable = (float) Supplier::query()->sum('payable');
        $lowStock = Item::query()->where('stock', '<', 200)
            ->orderBy('stock')
            ->limit(10)->get(['id', 'code', 'name', 'stock']);

        $recent = Invoice::query()
            ->with('customer:id,name')
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(6)->get();

        $topReceivables = Customer::query()
            ->where('balance', '>', 0)
            ->orderByDesc('balance')
            ->limit(5)->get(['id', 'code', 'name', 'credit_limit', 'balance']);

        // 14-day sales by type — anchored to the latest invoice so activity always shows,
        // even when the most recent data is older than the current date.
        $latestDate = Invoice::query()->max('date');
        $anchor = $latestDate ? Carbon::parse($latestDate) : Carbon::today();
        $from = $anchor->copy()->subDays(13);
        $daily = Invoice::query()
            ->whereBetween('date', [$from, $anchor])
            ->selectRaw('date, type, SUM(total) as total')
            ->groupBy('date', 'type')
            ->get()
            ->groupBy(fn ($r) => $r->date->toDateString());

        $series = [];
        for ($i = 0; $i < 14; $i++) {
            $d = $from->copy()->addDays($i);
            $key = $d->toDateString();
            $bucket = $daily->get($key, collect());
            $series[] = [
                'date' => $key,
                'label' => $d->format('M d'),
                'cash' => (float) (optional($bucket->firstWhere('type', 'cash'))->total ?? 0),
                'credit' => (float) (optional($bucket->firstWhere('type', 'credit'))->total ?? 0),
            ];
        }

        // Inventory value by category
        $catValue = Item::query()
            ->join('categories', 'categories.id', '=', 'items.category_id')
            ->selectRaw('categories.name as label, SUM(items.stock * items.retail_price) as value')
            ->groupBy('categories.name')
            ->orderByDesc('value')
            ->limit(5)->get();

        return response()->json([
            'totals' => [
                'sales' => $totalSales,
                'cash' => $cashTotal,
                'credit' => $creditTotal,
                'receivable' => $receivable,
                'payable' => $payable,
                'low_stock_count' => $lowStock->count(),
            ],
            'low_stock' => $lowStock,
            'recent_invoices' => $recent,
            'top_receivables' => $topReceivables,
            'sales_series' => $series,
            'inventory_by_category' => $catValue,
        ]);
    }
}
