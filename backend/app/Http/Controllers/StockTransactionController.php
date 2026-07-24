<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Stock;
use App\Models\StockAdjustment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Unified stock-movement report: every transaction that changes stock —
 * opening stock, GRN receipts (in), invoice sales (out) and manual
 * adjustments — read straight from their source tables so it always
 * reconciles (total in − total out == current stock). Filter by item and
 * a from/to date range.
 */
class StockTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $itemId = $request->input('item_id') ? (int) $request->input('item_id') : null;
        $from = $request->input('from') ?: null;   // Y-m-d
        $to = $request->input('to') ?: null;

        $inRange = fn (?string $d) => $d !== null && (! $from || $d >= $from) && (! $to || $d <= $to);
        $rows = [];

        // a) Opening stock per item = current opening (grn 0) minus opening adjustments.
        $openStock = Stock::query()->where('grn_id', 0)
            ->when($itemId, fn ($q) => $q->where('item_id', $itemId))
            ->groupBy('item_id')->selectRaw('item_id, SUM(qty) q')->pluck('q', 'item_id');
        $openAdj = StockAdjustment::query()->where('grn_id', 0)
            ->when($itemId, fn ($q) => $q->where('item_id', $itemId))
            ->groupBy('item_id')->selectRaw('item_id, SUM(qty) q')->pluck('q', 'item_id');

        Item::query()->when($itemId, fn ($q) => $q->whereKey($itemId))
            ->get(['id', 'code', 'name', 'created_at'])
            ->each(function (Item $it) use (&$rows, $openStock, $openAdj, $inRange) {
                $orig = (int) ($openStock[$it->id] ?? 0) - (int) ($openAdj[$it->id] ?? 0);
                $d = optional($it->created_at)->toDateString();
                if ($orig > 0 && $inRange($d)) {
                    $rows[] = $this->row($d, $it->created_at, $it, 'Opening stock', null, $orig, 0, null);
                }
            });

        // b) GRN receipts (stock in) — non-cancelled.
        DB::table('grn_lines')
            ->join('grns', 'grns.id', '=', 'grn_lines.grn_id')
            ->join('items', 'items.id', '=', 'grn_lines.item_id')
            ->whereNull('grns.cancelled_at')
            ->when($itemId, fn ($q) => $q->where('grn_lines.item_id', $itemId))
            ->when($from, fn ($q) => $q->whereDate('grns.date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('grns.date', '<=', $to))
            ->get(['grns.date', 'grns.created_at', 'grns.no as ref', 'grns.id as grn_id', 'items.id as item_id', 'items.code', 'items.name', 'grn_lines.qty'])
            ->each(function ($g) use (&$rows) {
                $rows[] = $this->row($g->date, $g->created_at, $g, $g->ref, $g->grn_id, (int) $g->qty, 0, null);
            });

        // c) Invoice sales (stock out) — non-cancelled.
        DB::table('invoice_lines')
            ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
            ->join('items', 'items.id', '=', 'invoice_lines.item_id')
            ->whereNull('invoices.cancelled_at')
            ->when($itemId, fn ($q) => $q->where('invoice_lines.item_id', $itemId))
            ->when($from, fn ($q) => $q->whereDate('invoices.date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('invoices.date', '<=', $to))
            ->get(['invoices.date', 'invoices.created_at', 'invoices.no as ref', 'invoice_lines.batch_id as grn_id', 'items.id as item_id', 'items.code', 'items.name', 'invoice_lines.qty'])
            ->each(function ($i) use (&$rows) {
                $rows[] = $this->row($i->date, $i->created_at, $i, $i->ref, null, 0, (int) $i->qty, null);
            });

        // d) Manual adjustments (in / out).
        DB::table('stock_adjustments')
            ->join('items', 'items.id', '=', 'stock_adjustments.item_id')
            ->leftJoin('grns', 'grns.id', '=', 'stock_adjustments.grn_id')
            ->when($itemId, fn ($q) => $q->where('stock_adjustments.item_id', $itemId))
            ->when($from, fn ($q) => $q->whereDate('stock_adjustments.created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('stock_adjustments.created_at', '<=', $to))
            ->get(['stock_adjustments.id as adjustment_id', 'stock_adjustments.created_at', 'stock_adjustments.qty', 'stock_adjustments.remark', 'stock_adjustments.grn_id', 'grns.no as grn_no', 'items.id as item_id', 'items.code', 'items.name'])
            ->each(function ($a) use (&$rows) {
                $q = (int) $a->qty;
                $src = 'Adjustment' . ($a->grn_no ? " · {$a->grn_no}" : ($a->grn_id == 0 ? ' · Opening' : ''));
                $d = substr((string) $a->created_at, 0, 10);
                $rows[] = $this->row($d, $a->created_at, $a, $src, $a->grn_id ?: null, $q > 0 ? $q : 0, $q < 0 ? -$q : 0, $a->remark, null, (int) $a->adjustment_id);
            });

        // Oldest first, then by created_at.
        usort($rows, fn ($a, $b) => [$a['date'], $a['created_at']] <=> [$b['date'], $b['created_at']]);

        $totalIn = array_sum(array_column($rows, 'qty_in'));
        $totalOut = array_sum(array_column($rows, 'qty_out'));

        return response()->json([
            'data' => $rows,
            'totals' => ['in' => $totalIn, 'out' => $totalOut, 'net' => $totalIn - $totalOut],
        ]);
    }

    private function row($date, $createdAt, $it, string $source, $grnId, int $in, int $out, ?string $remark, ?int $batchId = null, ?int $adjustmentId = null): array
    {
        return [
            'date' => $date ? substr((string) $date, 0, 10) : null,
            'created_at' => (string) $createdAt,
            'item_id' => (int) ($it->item_id ?? $it->id),
            'item_code' => $it->code,
            'item_name' => $it->name,
            'source' => $source,
            'grn_id' => $grnId,
            'qty_in' => $in,
            'qty_out' => $out,
            'remark' => $remark,
            'adjustment_id' => $adjustmentId,
        ];
    }
}
