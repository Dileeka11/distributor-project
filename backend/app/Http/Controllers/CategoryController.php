<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Category::query()->orderBy('name')->get(['id', 'name'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')],
        ], [
            'name.required' => 'Please enter a category name.',
            'name.unique' => 'A category with this name already exists.',
            'name.max' => 'Category name is too long (max 255 characters).',
        ]);

        $category = Category::query()->create(['name' => $data['name']]);

        return response()->json(['data' => $category->only('id', 'name')], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category->id)],
        ], [
            'name.required' => 'Please enter a category name.',
            'name.unique' => 'A category with this name already exists.',
            'name.max' => 'Category name is too long (max 255 characters).',
        ]);

        $category->update(['name' => $data['name']]);

        return response()->json(['data' => $category->only('id', 'name')]);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->items()->exists()) {
            throw ValidationException::withMessages([
                'name' => 'This category has items assigned and cannot be deleted.',
            ]);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted']);
    }
}
