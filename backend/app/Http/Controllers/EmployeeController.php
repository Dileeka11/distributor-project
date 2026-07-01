<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEmployeeRequest;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q'));
        $role = trim((string) $request->input('role'));

        $rows = Employee::query()
            ->when($q !== '', fn ($qb) => $qb->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%")
                    ->orWhere('role', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%");
            }))
            ->when($role !== '', fn ($qb) => $qb->where('role', $role))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $employee = Employee::query()->create($request->validated());

        return response()->json(['data' => $employee], 201);
    }

    public function update(StoreEmployeeRequest $request, Employee $employee): JsonResponse
    {
        $employee->update($request->validated());

        return response()->json(['data' => $employee]);
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $employee->delete(); // attendance + payroll cascade

        return response()->json(['message' => 'Deleted']);
    }
}
