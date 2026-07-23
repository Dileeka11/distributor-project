<?php

use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ChequeController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerTypeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\GrnController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\JobRoleController;
use App\Http\Controllers\LeaveCategoryController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SettlementController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware(['throttle:6,1'])
    ->name('auth.login');

// Public: branding (company name, logo, colours) must render on the login
// page before any user is authenticated.
Route::get('/settings', [SettingController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/sales', [DashboardController::class, 'sales']);

    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

    Route::get('/customer-types', [CustomerTypeController::class, 'index']);
    Route::post('/customer-types', [CustomerTypeController::class, 'store']);
    Route::put('/customer-types/{customerType}', [CustomerTypeController::class, 'update']);
    Route::delete('/customer-types/{customerType}', [CustomerTypeController::class, 'destroy']);

    Route::get('/items/{item}/batches', [ItemController::class, 'batches']);
    Route::apiResource('items', ItemController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::post('/products/{product}/assemble', [ProductController::class, 'assemble']);
    Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    Route::apiResource('suppliers', SupplierController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('customers', CustomerController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices', [InvoiceController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
    Route::put('/invoices/{invoice}', [InvoiceController::class, 'update']);
    Route::post('/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel']);

    Route::get('/grns', [GrnController::class, 'index']);
    Route::post('/grns', [GrnController::class, 'store']);
    Route::get('/grns/{grn}', [GrnController::class, 'show']);
    Route::put('/grns/{grn}', [GrnController::class, 'update']);
    Route::post('/grns/{grn}/cancel', [GrnController::class, 'cancel']);

    Route::get('/cheques', [ChequeController::class, 'index']);
    Route::post('/cheques/{cheque}/toggle', [ChequeController::class, 'toggle']);
    Route::get('/grn-cheques', [ChequeController::class, 'grnIndex']);
    Route::post('/grn-cheques/{grnCheque}/toggle', [ChequeController::class, 'grnToggle']);
    Route::get('/settlement-cheques', [ChequeController::class, 'settlementIndex']);
    Route::post('/settlement-cheques/{settlementCheque}/toggle', [ChequeController::class, 'settlementToggle']);

    Route::get('/settlements', [SettlementController::class, 'index']);
    Route::post('/settlements', [SettlementController::class, 'store']);
    Route::put('/settlements/{settlement}', [SettlementController::class, 'update']);
    Route::delete('/settlements/{settlement}', [SettlementController::class, 'destroy']);
    Route::get('/outstanding', [SettlementController::class, 'outstanding']);

    Route::get('/job-roles', [JobRoleController::class, 'index']);
    Route::post('/job-roles', [JobRoleController::class, 'store']);
    Route::put('/job-roles/{jobRole}', [JobRoleController::class, 'update']);
    Route::delete('/job-roles/{jobRole}', [JobRoleController::class, 'destroy']);

    Route::apiResource('employees', EmployeeController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::post('/attendance', [AttendanceController::class, 'store']);
    Route::post('/attendance/clock', [AttendanceController::class, 'clock']);
    Route::delete('/attendance/{attendance}', [AttendanceController::class, 'destroy']);

    Route::get('/leave-categories', [LeaveCategoryController::class, 'index']);
    Route::post('/leave-categories', [LeaveCategoryController::class, 'store']);
    Route::put('/leave-categories/{leaveCategory}', [LeaveCategoryController::class, 'update']);
    Route::delete('/leave-categories/{leaveCategory}', [LeaveCategoryController::class, 'destroy']);

    Route::get('/leaves', [LeaveController::class, 'index']);
    Route::get('/leaves/balances', [LeaveController::class, 'balances']);
    Route::post('/leaves', [LeaveController::class, 'store']);
    Route::post('/leaves/{leave}/decide', [LeaveController::class, 'decide']);
    Route::delete('/leaves/{leave}', [LeaveController::class, 'destroy']);

    Route::get('/payrolls', [PayrollController::class, 'index']);
    Route::post('/payrolls/generate', [PayrollController::class, 'generate']);
    Route::delete('/payrolls/{payroll}', [PayrollController::class, 'destroy']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::put('/settings', [SettingController::class, 'update']);
});
