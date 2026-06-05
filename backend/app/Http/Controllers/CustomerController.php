<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCustomerRequest;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = $request->string('q')->trim();

        $rows = Customer::query()
            ->when($q->isNotEmpty(), fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%")
                    ->orWhere('contact', 'like', "%{$q}%");
            }))
            ->orderBy('name')->get();

        return response()->json(['data' => $rows]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::query()->create($request->validated());

        return response()->json(['data' => $customer], 201);
    }

    public function update(StoreCustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return response()->json(['data' => $customer]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        abort_if($customer->invoices()->exists(), 422, 'Cannot delete customer with linked invoices');
        $customer->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
