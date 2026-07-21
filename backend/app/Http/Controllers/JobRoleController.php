<?php

namespace App\Http\Controllers;

use App\Models\JobRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JobRoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => JobRole::query()->orderBy('name')->get(['id', 'name'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('job_roles', 'name')],
        ], [
            'name.required' => 'Please enter a job role.',
            'name.unique' => 'This job role already exists.',
            'name.max' => 'Job role is too long (max 120 characters).',
        ]);

        $role = JobRole::query()->create(['name' => $data['name']]);

        return response()->json(['data' => $role->only('id', 'name')], 201);
    }

    public function update(Request $request, JobRole $jobRole): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('job_roles', 'name')->ignore($jobRole->id)],
        ], [
            'name.required' => 'Please enter a job role.',
            'name.unique' => 'This job role already exists.',
            'name.max' => 'Job role is too long (max 120 characters).',
        ]);

        $jobRole->update(['name' => $data['name']]);

        return response()->json(['data' => $jobRole->only('id', 'name')]);
    }

    public function destroy(JobRole $jobRole): JsonResponse
    {
        $jobRole->delete();

        return response()->json(['message' => 'Job role deleted']);
    }
}
