<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ChequeController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerTypeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GrnController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SettlementController;
use App\Http\Controllers\SupplierController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware(['throttle:6,1'])
    ->name('auth.login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

    Route::get('/customer-types', [CustomerTypeController::class, 'index']);
    Route::post('/customer-types', [CustomerTypeController::class, 'store']);
    Route::put('/customer-types/{customerType}', [CustomerTypeController::class, 'update']);
    Route::delete('/customer-types/{customerType}', [CustomerTypeController::class, 'destroy']);

    Route::apiResource('items', ItemController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('suppliers', SupplierController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('customers', CustomerController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices', [InvoiceController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
    Route::put('/invoices/{invoice}', [InvoiceController::class, 'update']);
    Route::delete('/invoices/{invoice}', [InvoiceController::class, 'destroy']);

    Route::get('/grns', [GrnController::class, 'index']);
    Route::post('/grns', [GrnController::class, 'store']);
    Route::get('/grns/{grn}', [GrnController::class, 'show']);

    Route::get('/cheques', [ChequeController::class, 'index']);
    Route::post('/cheques/{cheque}/toggle', [ChequeController::class, 'toggle']);

    Route::get('/settlements', [SettlementController::class, 'index']);
    Route::post('/settlements', [SettlementController::class, 'store']);
    Route::get('/outstanding', [SettlementController::class, 'outstanding']);

    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);
});
