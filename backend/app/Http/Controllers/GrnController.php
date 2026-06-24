<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGrnRequest;
use App\Models\Grn;
use App\Models\Item;
use App\Models\Supplier;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $type = trim((string) $request->input('type'));

        $rows = Grn::query()
            ->with(['supplier:id,code,name,address', 'lines'])
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('supplier', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->when(in_array($type, ['cash', 'credit']), fn ($qb) => $qb->where('type', $type))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Grn $grn): JsonResponse
    {
        return response()->json([
            'data' => $grn->load(['supplier', 'lines.item:id,code,name']),
        ]);
    }

    public function store(StoreGrnRequest $request): JsonResponse
    {
        $data = $request->validated();
        $taxRate = (float) ($data['tax_rate'] ?? 0);

        $grn = DB::transaction(function () use ($data, $taxRate, $request) {
            $itemIds = collect($data['lines'])->pluck('item_id')->unique();
            $items = Item::query()->whereIn('id', $itemIds)->lockForUpdate()->get()->keyBy('id');

            $subtotal = 0;
            $linesOut = [];
            foreach ($data['lines'] as $line) {
                /** @var Item $item */
                $item = $items[$line['item_id']];
                $qty = (float) $line['qty'];
                $price = (float) $line['price'];
                $total = round($qty * $price, 2);
                $subtotal += $total;
                $linesOut[] = [
                    'item_id' => $item->id,
                    'name' => $item->name,
                    'qty' => $qty,
                    'price' => $price,
                    'total' => $total,
                ];
            }

            $taxAmount = round($subtotal * $taxRate / 100, 2);
            $total = round($subtotal + $taxAmount, 2);

            $type = $data['type'];
            $paid = $type === 'cash' ? $total : min((float) ($data['paid'] ?? 0), $total);
            $balance = round($total - $paid, 2);
            $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

            $grn = Grn::query()->create([
                'no' => NumberService::next(Grn::class, 'GRN-'),
                'date' => now()->toDateString(),
                'type' => $type,
                'supplier_id' => $data['supplier_id'],
                'subtotal' => $subtotal,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total' => $total,
                'paid' => $paid,
                'status' => $status,
                'created_by' => optional($request->user())->id,
            ]);

            foreach ($linesOut as $row) {
                $grn->lines()->create($row);
                $items[$row['item_id']]->increment('stock', (int) $row['qty']);
            }

            if ($type === 'credit' && $balance > 0) {
                Supplier::query()->whereKey($data['supplier_id'])->increment('payable', $balance);
            }

            return $grn;
        });

        return response()->json([
            'data' => $grn->fresh(['supplier', 'lines']),
        ], 201);
    }
}
