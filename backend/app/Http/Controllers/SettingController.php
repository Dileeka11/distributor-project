<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Setting::all_settings()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company' => ['nullable', 'string', 'max:120'],
            'logo' => ['nullable', 'string', 'max:4'],
            'accent' => ['nullable', 'string', 'max:9'],
            'accent_press' => ['nullable', 'string', 'max:9'],
            'mode' => ['nullable', 'in:light,dark'],
            'currency' => ['nullable', 'string', 'max:6'],
            'symbol' => ['nullable', 'string', 'max:6'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'invoice_prefix' => ['nullable', 'string', 'max:8'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'vat_no' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        Setting::setMany($data);

        return response()->json(['data' => Setting::all_settings()]);
    }
}
