<?php

namespace App\Http\Controllers;

use App\Models\CustomerType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => CustomerType::query()->orderBy('name')->get(['id', 'name'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('customer_types', 'name')],
        ], [
            'name.required' => 'Please enter a customer type.',
            'name.unique' => 'This customer type already exists.',
            'name.max' => 'Customer type is too long (max 40 characters).',
        ]);

        $type = CustomerType::query()->create(['name' => $data['name']]);

        return response()->json(['data' => $type->only('id', 'name')], 201);
    }

    public function update(Request $request, CustomerType $customerType): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('customer_types', 'name')->ignore($customerType->id)],
        ], [
            'name.required' => 'Please enter a customer type.',
            'name.unique' => 'This customer type already exists.',
            'name.max' => 'Customer type is too long (max 40 characters).',
        ]);

        $customerType->update(['name' => $data['name']]);

        return response()->json(['data' => $customerType->only('id', 'name')]);
    }

    public function destroy(CustomerType $customerType): JsonResponse
    {
        $customerType->delete();

        return response()->json(['message' => 'Customer type deleted']);
    }
}
