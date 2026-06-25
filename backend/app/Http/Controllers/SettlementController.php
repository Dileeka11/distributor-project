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
            ->with(['customer:id,code,name', 'supplier:id,code,name', 'cheques'])
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

        // Normalise cheque rows — only meaningful when paying by cheque.
        $chequeRows = [];
        if ($data['mode'] === 'Cheque') {
            foreach ($data['cheques'] ?? [] as $c) {
                $no = trim((string) ($c['no'] ?? ''));
                $amt = (float) ($c['amount'] ?? 0);
                $date = $c['date'] ?? null;
                if ($no === '' && ! $date && $amt <= 0) {
                    continue; // skip blank rows
                }
                $chequeRows[] = ['cheque_no' => $no !== '' ? $no : null, 'cheque_date' => $date, 'amount' => $amt];
            }
            // Back-compat: a single cheque sent via reference / cheque_date.
            if (empty($chequeRows) && ! empty($data['reference'])) {
                $chequeRows[] = ['cheque_no' => $data['reference'], 'cheque_date' => $data['cheque_date'] ?? null, 'amount' => (float) $data['amount']];
            }
        }
        $single = count($chequeRows) === 1 ? $chequeRows[0] : null;

        $settlement = DB::transaction(function () use ($data, $request, $chequeRows, $single) {
            // When paying by cheque, the amount is the sum of the cheque values.
            $amount = ! empty($chequeRows)
                ? round(array_sum(array_column($chequeRows, 'amount')), 2)
                : (float) $data['amount'];

            if ($data['side'] === 'receivable') {
                $customer = Customer::query()->whereKey($data['party_id'])->lockForUpdate()->firstOrFail();
                // Total outstanding = opening (credit_limit) + invoice balance.
                $totalOutstanding = (float) $customer->credit_limit + (float) $customer->balance;
                $amount = min($amount, $totalOutstanding);
                abort_if($amount <= 0, 422, 'Nothing to collect from this customer');

                // Apply to the invoice balance first, then to the opening outstanding.
                $fromBalance = min($amount, (float) $customer->balance);
                $fromOpening = round($amount - $fromBalance, 2);

                if ($fromBalance > 0) {
                    $customer->decrement('balance', $fromBalance);

                    $remaining = $fromBalance;
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
                }

                if ($fromOpening > 0) {
                    $customer->decrement('credit_limit', $fromOpening);
                }

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

            $settlement = Settlement::query()->create([
                'code' => NumberService::next(Settlement::class, $prefix, 3, 'code'),
                'date' => now()->toDateString(),
                'side' => $data['side'],
                'customer_id' => $customerId,
                'supplier_id' => $supplierId,
                'amount' => $amount,
                'mode' => $data['mode'],
                'reference' => $single ? $single['cheque_no'] : ($data['reference'] ?? null),
                'cheque_date' => $data['mode'] === 'Cheque'
                    ? ($single ? $single['cheque_date'] : ($data['cheque_date'] ?? null))
                    : null,
                'created_by' => optional($request->user())->id,
            ]);

            foreach ($chequeRows as $row) {
                $settlement->cheques()->create($row);
            }

            return $settlement;
        });

        return response()->json([
            'data' => $settlement->load(['customer:id,code,name', 'supplier:id,code,name', 'cheques']),
        ], 201);
    }
}
