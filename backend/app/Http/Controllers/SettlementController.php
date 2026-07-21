<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSettlementRequest;
use App\Models\Customer;
use App\Models\Settlement;
use App\Models\Supplier;
use App\Services\NumberService;
use App\Services\SettlementService;
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
            ->limit(500)->get()
            ->each(function (Settlement $s) {
                // A cheque settlement is "passed" once every cheque on it cleared.
                $s->setAttribute('passed', $s->mode === 'Cheque'
                    && $s->cheques->isNotEmpty()
                    && $s->cheques->every(fn ($c) => $c->cleared_at !== null));
            });

        return response()->json(['data' => $rows]);
    }

    public function outstanding(): JsonResponse
    {
        $receivables = Customer::query()
            ->select(['id', 'code', 'name', 'contact', 'phone', 'address', 'credit_limit', 'balance', 'opening_collected', 'type'])
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

    public function store(StoreSettlementRequest $request, SettlementService $posting): JsonResponse
    {
        $data = $request->validated();

        $settlement = DB::transaction(function () use ($data, $request, $posting) {
            $prefix = $data['side'] === 'receivable' ? 'RCP-' : 'PAY-';
            $settlement = new Settlement([
                'code' => NumberService::next(Settlement::class, $prefix, 3, 'code'),
                'date' => now()->toDateString(),
                'side' => $data['side'],
                'customer_id' => $data['side'] === 'receivable' ? $data['party_id'] : null,
                'supplier_id' => $data['side'] === 'payable' ? $data['party_id'] : null,
                'created_by' => optional($request->user())->id,
            ]);

            $this->applySettlementData($settlement, $data, $posting);

            return $settlement;
        });

        return response()->json([
            'data' => $settlement->load(['customer:id,code,name', 'supplier:id,code,name', 'cheques']),
        ], 201);
    }

    public function update(StoreSettlementRequest $request, Settlement $settlement, SettlementService $posting): JsonResponse
    {
        $data = $request->validated();
        // The party never changes on edit — keep the original.
        $data['side'] = $settlement->side;
        $data['party_id'] = $settlement->customer_id ?? $settlement->supplier_id;

        DB::transaction(function () use ($settlement, $data, $posting) {
            $settlement->loadMissing('cheques');
            $this->reverseSettlement($settlement, $posting);
            $settlement->cheques()->delete();
            $this->applySettlementData($settlement, $data, $posting);
        });

        return response()->json([
            'data' => $settlement->fresh(['customer:id,code,name', 'supplier:id,code,name', 'cheques']),
        ]);
    }

    public function destroy(Settlement $settlement, SettlementService $posting): JsonResponse
    {
        DB::transaction(function () use ($settlement, $posting) {
            $settlement->loadMissing('cheques');
            $this->reverseSettlement($settlement, $posting);
            $settlement->delete(); // cheques cascade
        });

        return response()->json(['message' => 'Settlement deleted']);
    }

    /**
     * Compute the amount, post it (immediately for cash-like modes, deferred for
     * cheque), persist the settlement + cheques and stash the reversal snapshot.
     * Shared by store/update.
     */
    private function applySettlementData(Settlement $settlement, array $data, SettlementService $posting): void
    {
        $isCheque = $data['mode'] === 'Cheque';

        // Normalise cheque rows — only meaningful when paying by cheque.
        $chequeRows = [];
        if ($isCheque) {
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

        // When paying by cheque, the amount is the sum of the cheque values.
        $amount = ! empty($chequeRows)
            ? round(array_sum(array_column($chequeRows, 'amount')), 2)
            : (float) $data['amount'];

        $applied = null;
        if ($data['side'] === 'receivable') {
            $customer = Customer::query()->whereKey($data['party_id'])->lockForUpdate()->firstOrFail();
            if ($isCheque) {
                abort_if($amount <= 0, 422, 'Enter at least one cheque value to collect');
            } else {
                $amount = min($amount, (float) $customer->credit_limit + (float) $customer->balance);
                abort_if($amount <= 0, 422, 'Nothing to collect from this customer');
                $applied = $posting->applyReceivable($customer, $amount);
            }
        } else {
            $supplier = Supplier::query()->whereKey($data['party_id'])->lockForUpdate()->firstOrFail();
            if ($isCheque) {
                abort_if($amount <= 0, 422, 'Enter at least one cheque value to pay');
            } else {
                $amount = min($amount, (float) $supplier->payable);
                abort_if($amount <= 0, 422, 'Nothing to pay this supplier');
                $applied = $posting->applyPayable($supplier, $amount);
            }
        }

        $settlement->fill([
            'amount' => $amount,
            'mode' => $data['mode'],
            'reference' => $single ? $single['cheque_no'] : ($data['reference'] ?? null),
            'cheque_date' => $isCheque
                ? ($single ? $single['cheque_date'] : ($data['cheque_date'] ?? null))
                : null,
            'applied' => $applied,
        ]);
        $settlement->save();

        foreach ($chequeRows as $row) {
            $settlement->cheques()->create($row);
        }
    }

    /**
     * Undo a settlement's posting: cheque settlements reverse each cleared cheque
     * from its own snapshot; cash-like settlements reverse the settlement snapshot.
     */
    private function reverseSettlement(Settlement $settlement, SettlementService $posting): void
    {
        if ($settlement->mode === 'Cheque') {
            foreach ($settlement->cheques as $cheque) {
                if ($cheque->cleared_at && is_array($cheque->applied)) {
                    $this->reverseSnapshot($settlement, $cheque->applied, $posting);
                }
            }
        } elseif (is_array($settlement->applied)) {
            $this->reverseSnapshot($settlement, $settlement->applied, $posting);
        }
    }

    private function reverseSnapshot(Settlement $settlement, array $applied, SettlementService $posting): void
    {
        if ($settlement->side === 'receivable' && $settlement->customer_id) {
            $customer = Customer::query()->whereKey($settlement->customer_id)->lockForUpdate()->firstOrFail();
            $posting->reverseReceivable($customer, $applied);
        } elseif ($settlement->supplier_id) {
            $supplier = Supplier::query()->whereKey($settlement->supplier_id)->lockForUpdate()->firstOrFail();
            $posting->reversePayable($supplier, $applied);
        }
    }
}
