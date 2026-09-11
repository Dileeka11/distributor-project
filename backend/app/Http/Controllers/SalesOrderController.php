<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\SalesOrder;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sales orders: a customer's items and quantities, taken down ahead of the day
 * they are wanted. Nothing here touches stock or cost lots — on the day the
 * order is turned into an ordinary invoice (InvoiceController::store links the
 * two), and that invoice picks the lots and takes the stock.
 */
class SalesOrderController extends Controller
{
    private const RELATIONS = ['customer:id,code,name,phone,address', 'lines', 'invoice:id,no'];

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $status = trim((string) $request->input('status'));

        $rows = SalesOrder::query()
            ->with(self::RELATIONS)
            ->when(in_array($status, ['pending', 'invoiced', 'cancelled'], true), fn ($qb) => $qb->where('status', $status))
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('no', 'like', "%{$q}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->orderBy('due_date')->orderBy('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(SalesOrder $salesOrder): JsonResponse
    {
        return response()->json(['data' => $salesOrder->load(self::RELATIONS)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $order = DB::transaction(function () use ($data, $request) {
            $order = SalesOrder::query()->create([
                'no' => NumberService::next(SalesOrder::class, 'SO-'),
                'date' => now()->toDateString(),
                'due_date' => $data['due_date'],
                'customer_id' => $data['customer_id'],
                'status' => 'pending',
                'note' => $data['note'] ?? null,
                'created_by' => optional($request->user())->id,
            ]);
            $this->writeLines($order, $data['lines']);

            return $order;
        });

        return response()->json(['data' => $order->fresh(self::RELATIONS)], 201);
    }

    public function update(Request $request, SalesOrder $salesOrder): JsonResponse
    {
        abort_unless($salesOrder->status === 'pending', 422, 'Only a pending order can be edited.');
        $data = $this->validated($request);

        DB::transaction(function () use ($salesOrder, $data) {
            $salesOrder->update([
                'due_date' => $data['due_date'],
                'customer_id' => $data['customer_id'],
                'note' => $data['note'] ?? null,
            ]);
            $salesOrder->lines()->delete();
            $this->writeLines($salesOrder, $data['lines']);
        });

        return response()->json(['data' => $salesOrder->fresh(self::RELATIONS)]);
    }

    /** Called off before it went out. Kept in the list, marked cancelled. */
    public function cancel(SalesOrder $salesOrder): JsonResponse
    {
        abort_unless($salesOrder->status === 'pending', 422, 'Only a pending order can be cancelled.');
        $salesOrder->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        return response()->json(['data' => $salesOrder->fresh(self::RELATIONS)]);
    }

    public function destroy(SalesOrder $salesOrder): JsonResponse
    {
        abort_unless($salesOrder->status === 'cancelled', 422, 'Only a cancelled order can be deleted.');
        $salesOrder->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'customer_id' => ['required', 'exists:customers,id'],
            'due_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.item_id' => ['required', 'exists:items,id'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
        ]);
    }

    private function writeLines(SalesOrder $order, array $lines): void
    {
        $names = Item::query()->whereIn('id', array_column($lines, 'item_id'))->pluck('name', 'id');
        foreach ($lines as $l) {
            $order->lines()->create([
                'item_id' => (int) $l['item_id'],
                'name' => (string) ($names[(int) $l['item_id']] ?? ''),
                'qty' => (int) $l['qty'],
            ]);
        }
    }
}
