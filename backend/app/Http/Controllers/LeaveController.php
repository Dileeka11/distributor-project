<?php

namespace App\Http\Controllers;

use App\Models\Leave;
use App\Models\LeaveCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LeaveController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = Leave::query()
            ->with(['employee:id,code,name,role', 'category:id,name,color,annual_days', 'decidedBy:id,name'])
            ->when($request->input('employee_id'), fn ($q, $e) => $q->where('employee_id', $e))
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    /** File a leave application (any attendance user) — starts as pending. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'leave_category_id' => ['required', 'exists:leave_categories,id'],
            'from_date' => ['required', 'date'],
            'days' => ['required', 'integer', 'min:1', 'max:365'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $leave = Leave::query()->create([
            'employee_id' => $data['employee_id'],
            'leave_category_id' => $data['leave_category_id'],
            'from_date' => $data['from_date'],
            'days' => $data['days'],
            'description' => $data['description'] ?? null,
            'status' => 'pending',
            'created_by' => optional($request->user())->id,
        ]);

        return response()->json([
            'data' => $leave->load(['employee:id,code,name,role', 'category:id,name,color,annual_days']),
        ], 201);
    }

    /** Approve / reject a pending leave (admin only) with a written note. */
    public function decide(Request $request, Leave $leave): JsonResponse
    {
        abort_unless((bool) optional($request->user())->is_admin, 403, 'Only an admin can approve or reject leave.');

        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_note' => ['nullable', 'string', 'max:500'],
        ]);

        $leave->update([
            'status' => $data['status'],
            'admin_note' => $data['admin_note'] ?? null,
            'decided_at' => now(),
            'decided_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $leave->fresh(['employee:id,code,name,role', 'category:id,name,color,annual_days', 'decidedBy:id,name']),
        ]);
    }

    public function destroy(Request $request, Leave $leave): JsonResponse
    {
        abort_unless((bool) optional($request->user())->is_admin, 403, 'Only an admin can delete leave records.');

        $leave->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Per-category leave balance for one employee in a year: allowance, used
     * (approved days) and remaining. Only approved leave counts.
     */
    public function balances(Request $request): JsonResponse
    {
        $employeeId = (int) $request->input('employee_id');
        $year = (int) ($request->input('year') ?: Carbon::today()->year);

        $categories = LeaveCategory::query()->orderBy('name')->get();

        $used = Leave::query()
            ->where('employee_id', $employeeId)
            ->where('status', 'approved')
            ->whereYear('from_date', $year)
            ->selectRaw('leave_category_id, COALESCE(SUM(days), 0) AS used')
            ->groupBy('leave_category_id')
            ->pluck('used', 'leave_category_id');

        $rows = $categories->map(function (LeaveCategory $c) use ($used) {
            $u = (int) ($used[$c->id] ?? 0);

            return [
                'category_id' => $c->id,
                'name' => $c->name,
                'color' => $c->color,
                'allowance' => (int) $c->annual_days,
                'used' => $u,
                'remaining' => max(0, (int) $c->annual_days - $u),
            ];
        });

        return response()->json(['data' => $rows, 'year' => $year]);
    }
}
