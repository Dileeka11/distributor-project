<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvoiceRequest;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = $request->string('q')->trim();
        $type = $request->string('type')->trim();

        $rows = Invoice::query()
            ->with(['customer:id,code,name,address', 'lines'])
            ->when($q->isNotEmpty(), fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->when(in_array($type->toString(), ['cash', 'credit']), fn ($qb) => $qb->where('type', $type))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json([
            'data' => $invoice->load(['customer', 'lines.item:id,code,name']),
        ]);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $taxRate = (float) ($data['tax_rate'] ?? 0);

        $invoice = DB::transaction(function () use ($data, $taxRate, $request) {
            // Lock items
            $itemIds = collect($data['lines'])->pluck('item_id')->unique();
            $items = Item::query()->whereIn('id', $itemIds)->lockForUpdate()->get()->keyBy('id');

            $subtotal = 0;
            $linesOut = [];
            foreach ($data['lines'] as $line) {
                /** @var Item $item */
                $item = $items[$line['item_id']];
                $qty = (float) $line['qty'];
                $price = (float) $line['price'];

                abort_if($item->stock < $qty, 422, "Insufficient stock for {$item->name}");

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

            $invoice = Invoice::query()->create([
                'no' => NumberService::next(Invoice::class, NumberService::invoicePrefix()),
                'date' => now()->toDateString(),
                'type' => $type,
                'customer_id' => $data['customer_id'],
                'subtotal' => $subtotal,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total' => $total,
                'paid' => $paid,
                'status' => $status,
                'created_by' => optional($request->user())->id,
            ]);

            foreach ($linesOut as $row) {
                $invoice->lines()->create($row);
                $items[$row['item_id']]->decrement('stock', (int) $row['qty']);
            }

            // Credit invoice -> customer receivable balance += outstanding
            if ($type === 'credit' && $balance > 0) {
                Customer::query()->whereKey($data['customer_id'])->increment('balance', $balance);
            }

            return $invoice;
        });

        return response()->json([
            'data' => $invoice->fresh(['customer', 'lines']),
        ], 201);
    }
}
