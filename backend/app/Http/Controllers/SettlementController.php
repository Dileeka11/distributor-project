<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSettlementRequest;
use App\Models\Customer;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\Settlement;
use App\Models\Supplier;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettlementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = Settlement::query()
            ->with(['customer:id,code,name', 'supplier:id,code,name'])
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)->get();

        return response()->json(['data' => $rows]);
    }

    public function outstanding(): JsonResponse
    {
        $receivables = Customer::query()
            ->select(['id', 'code', 'name', 'contact', 'phone', 'address', 'credit_limit', 'balance', 'type'])
            ->withSum('invoices as paid_total', 'paid')
            ->where(fn ($q) => $q->where('balance', '>', 0)->orWhere('credit_limit', '>', 0))
            ->orderByRaw('(credit_limit + balance) desc')
            ->get();

        $payables = Supplier::query()
            ->where('payable', '>', 0)
            ->orderByDesc('payable')
            ->get(['id', 'code', 'name', 'contact', 'phone', 'address', 'terms_days', 'payable']);

        return response()->json([
            'receivables' => $receivables,
            'payables' => $payables,
        ]);
    }

    public function store(StoreSettlementRequest $request): JsonResponse
    {
        $data = $request->validated();

        $settlement = DB::transaction(function () use ($data, $request) {
            $amount = (float) $data['amount'];

            if ($data['side'] === 'receivable') {
                $customer = Customer::query()->whereKey($data['party_id'])->lockForUpdate()->firstOrFail();
                $amount = min($amount, (float) $customer->balance);
                abort_if($amount <= 0, 422, 'Nothing to collect from this customer');

                $customer->decrement('balance', $amount);

                $remaining = $amount;
                Invoice::query()
                    ->where('customer_id', $customer->id)
                    ->where('type', 'credit')
                    ->whereRaw('total - paid > 0')
                    ->orderBy('date')->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->each(function (Invoice $inv) use (&$remaining) {
                        if ($remaining <= 0) {
                            return;
                        }
                        $due = (float) $inv->total - (float) $inv->paid;
                        $pay = min($due, $remaining);
                        $remaining -= $pay;
                        $newPaid = (float) $inv->paid + $pay;
                        $inv->update([
                            'paid' => $newPaid,
                            'status' => $newPaid >= (float) $inv->total ? 'paid' : 'partial',
                        ]);
                    });

                $customerId = $customer->id;
                $supplierId = null;
                $prefix = 'RCP-';
            } else {
                $supplier = Supplier::query()->whereKey($data['party_id'])->lockForUpdate()->firstOrFail();
                $amount = min($amount, (float) $supplier->payable);
                abort_if($amount <= 0, 422, 'Nothing to pay this supplier');

                $supplier->decrement('payable', $amount);

                $remaining = $amount;
                Grn::query()
                    ->where('supplier_id', $supplier->id)
                    ->where('type', 'credit')
                    ->whereRaw('total - paid > 0')
                    ->orderBy('date')->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->each(function (Grn $g) use (&$remaining) {
                        if ($remaining <= 0) {
                            return;
                        }
                        $due = (float) $g->total - (float) $g->paid;
                        $pay = min($due, $remaining);
                        $remaining -= $pay;
                        $newPaid = (float) $g->paid + $pay;
                        $g->update([
                            'paid' => $newPaid,
                            'status' => $newPaid >= (float) $g->total ? 'paid' : 'partial',
                        ]);
                    });

                $customerId = null;
                $supplierId = $supplier->id;
                $prefix = 'PAY-';
            }

            return Settlement::query()->create([
                'code' => NumberService::next(Settlement::class, $prefix, 3),
                'date' => now()->toDateString(),
                'side' => $data['side'],
                'customer_id' => $customerId,
                'supplier_id' => $supplierId,
                'amount' => $amount,
                'mode' => $data['mode'],
                'reference' => $data['reference'] ?? null,
                'created_by' => optional($request->user())->id,
            ]);
        });

        return response()->json([
            'data' => $settlement->load(['customer:id,code,name', 'supplier:id,code,name']),
        ], 201);
    }
}
