<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /** Only admins may manage system users. */
    private function guard(Request $request): void
    {
        abort_unless((bool) $request->user()->is_admin, 403, 'Only an admin can manage users.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->guard($request);

        $rows = User::query()->orderByDesc('is_admin')->orderBy('name')
            ->get(['id', 'name', 'username', 'email', 'is_admin', 'permissions']);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard($request);
        $data = $this->validateUser($request);

        $user = User::query()->create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'] ?? null,
            'password' => Hash::make($data['password']),
            'is_admin' => $data['is_admin'] ?? false,
            'permissions' => ($data['is_admin'] ?? false) ? null : array_values($data['permissions'] ?? []),
        ]);

        return response()->json(['data' => AuthController::payload($user)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->guard($request);
        $data = $this->validateUser($request, $user);

        $user->fill([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'] ?? null,
            'is_admin' => $data['is_admin'] ?? false,
            'permissions' => ($data['is_admin'] ?? false) ? null : array_values($data['permissions'] ?? []),
        ]);
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }
        $user->save();

        return response()->json(['data' => AuthController::payload($user)]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guard($request);
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete your own account.');

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    private function validateUser(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:60', Rule::unique('users', 'username')->ignore($user?->id)],
            'email' => ['nullable', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:4', 'max:100'],
            'is_admin' => ['boolean'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'max:40'],
        ]);
    }
}
