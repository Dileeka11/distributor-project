<?php

namespace App\Http\Controllers;

use App\Models\LeaveCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeaveCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => LeaveCategory::query()->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guardAdmin($request);

        $cat = LeaveCategory::query()->create($this->validated($request));

        return response()->json(['data' => $cat], 201);
    }

    public function update(Request $request, LeaveCategory $leaveCategory): JsonResponse
    {
        $this->guardAdmin($request);

        $leaveCategory->update($this->validated($request, $leaveCategory));

        return response()->json(['data' => $leaveCategory]);
    }

    public function destroy(Request $request, LeaveCategory $leaveCategory): JsonResponse
    {
        $this->guardAdmin($request);
        abort_if($leaveCategory->leaves()->exists(), 422, 'This category has leave records — it cannot be deleted.');

        $leaveCategory->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function validated(Request $request, ?LeaveCategory $cat = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('leave_categories', 'name')->ignore(optional($cat)->id)],
            'annual_days' => ['required', 'integer', 'min:0', 'max:365'],
            'color' => ['nullable', 'string', 'max:9'],
            'active' => ['boolean'],
        ]);
    }

    private function guardAdmin(Request $request): void
    {
        abort_unless((bool) optional($request->user())->is_admin, 403, 'Only an admin can manage leave categories.');
    }
}
