<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        // Cancelled invoices are void — excluded from every sales figure.
        $totalSales = (float) Invoice::query()->whereNull('cancelled_at')->sum('total');
        $cashTotal = (float) Invoice::query()->whereNull('cancelled_at')->where('type', 'cash')->sum('total');
        $creditTotal = (float) Invoice::query()->whereNull('cancelled_at')->where('type', 'credit')->sum('total');
        // Outstanding from customers = opening (credit_limit) + invoice balance,
        // matching the Outstanding page.
        $receivable = (float) Customer::query()->sum(DB::raw('credit_limit + balance'));
        $payable = (float) Supplier::query()->sum('payable');
        $lowStock = Item::query()->where('stock', '<', 200)
            ->orderBy('stock')
            ->limit(10)->get(['id', 'code', 'name', 'stock']);

        $recent = Invoice::query()
            ->whereNull('cancelled_at')
            ->with('customer:id,name')
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(6)->get();

        $topReceivables = Customer::query()
            ->whereRaw('credit_limit + balance > 0')
            ->orderByRaw('(credit_limit + balance) desc')
            ->limit(5)->get(['id', 'code', 'name', 'credit_limit', 'balance']);

        // Daily sales by type for the current month (the picker fetches other months).
        $salesMonth = Carbon::today()->startOfMonth();
        $series = $this->salesSeries($salesMonth);

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
            'sales_month' => $salesMonth->format('Y-m'),
            'inventory_by_category' => $catValue,
        ]);
    }

    /**
     * Daily cash/credit sales for a single month (YYYY-MM), for the dashboard
     * month picker. Defaults to the current month.
     */
    public function sales(Request $request): JsonResponse
    {
        $month = (string) $request->input('month', '');
        try {
            $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        } catch (\Throwable $e) {
            $start = Carbon::today()->startOfMonth();
        }

        $series = $this->salesSeries($start);
        $total = array_sum(array_map(fn ($r) => $r['cash'] + $r['credit'], $series));

        return response()->json([
            'month' => $start->format('Y-m'),
            'series' => $series,
            'total' => $total,
        ]);
    }

    /**
     * Build a per-day cash/credit series spanning the given month.
     */
    private function salesSeries(Carbon $start): array
    {
        $start = $start->copy()->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $daily = Invoice::query()
            ->whereNull('cancelled_at')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('date, type, SUM(total) as total')
            ->groupBy('date', 'type')
            ->get()
            ->groupBy(fn ($r) => $r->date->toDateString());

        $series = [];
        $days = (int) $start->daysInMonth;
        for ($i = 0; $i < $days; $i++) {
            $d = $start->copy()->addDays($i);
            $key = $d->toDateString();
            $bucket = $daily->get($key, collect());
            $series[] = [
                'date' => $key,
                'label' => $d->format('M d'),
                'cash' => (float) (optional($bucket->firstWhere('type', 'cash'))->total ?? 0),
                'credit' => (float) (optional($bucket->firstWhere('type', 'credit'))->total ?? 0),
            ];
        }

        return $series;
    }
}
