<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->timestamps();
        });

        Schema::create('items', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('name');
            $t->foreignId('category_id')->constrained()->restrictOnDelete();
            $t->decimal('distributor_price', 12, 2)->default(0);
            $t->decimal('wholesale_price', 12, 2)->default(0);
            $t->decimal('retail_price', 12, 2)->default(0);
            $t->integer('stock')->default(0);
            $t->timestamps();
            $t->index(['name', 'category_id']);
        });

        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('name');
            $t->string('contact')->nullable();
            $t->string('phone', 40)->nullable();
            $t->string('email')->nullable();
            $t->string('address', 500)->nullable();
            $t->unsignedSmallInteger('terms_days')->default(30);
            $t->decimal('payable', 14, 2)->default(0);
            $t->timestamps();
            $t->index('name');
        });

        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('name');
            $t->string('contact')->nullable();
            $t->string('phone', 40)->nullable();
            $t->string('email')->nullable();
            $t->string('address', 500)->nullable();
            $t->string('type', 40)->default('Pharmacy');
            $t->decimal('credit_limit', 14, 2)->default(0);
            $t->decimal('balance', 14, 2)->default(0);
            $t->timestamps();
            $t->index('name');
        });

        Schema::create('invoices', function (Blueprint $t) {
            $t->id();
            $t->string('no')->unique();
            $t->date('date');
            $t->enum('type', ['cash', 'credit']);
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->decimal('subtotal', 14, 2)->default(0);
            $t->decimal('tax_rate', 5, 2)->default(0);
            $t->decimal('tax_amount', 14, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->enum('status', ['paid', 'partial', 'unpaid'])->default('unpaid');
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['date', 'type']);
        });

        Schema::create('invoice_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            $t->string('name'); // snapshot
            $t->decimal('qty', 12, 2);
            $t->decimal('price', 12, 2);
            $t->decimal('total', 14, 2);
            $t->timestamps();
        });

        Schema::create('grns', function (Blueprint $t) {
            $t->id();
            $t->string('no')->unique();
            $t->date('date');
            $t->enum('type', ['cash', 'credit']);
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->decimal('subtotal', 14, 2)->default(0);
            $t->decimal('tax_rate', 5, 2)->default(0);
            $t->decimal('tax_amount', 14, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->enum('status', ['paid', 'partial', 'unpaid'])->default('unpaid');
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['date', 'type']);
        });

        Schema::create('grn_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->decimal('qty', 12, 2);
            $t->decimal('price', 12, 2);
            $t->decimal('total', 14, 2);
            $t->timestamps();
        });

        Schema::create('settlements', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->date('date');
            $t->enum('side', ['receivable', 'payable']);
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('amount', 14, 2);
            $t->string('mode', 40);
            $t->string('reference', 80)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['side', 'date']);
        });

        // Generic key-value app settings (theme, branding, billing, company)
        Schema::create('settings', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->json('value')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('settlements');
        Schema::dropIfExists('grn_lines');
        Schema::dropIfExists('grns');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('items');
        Schema::dropIfExists('categories');
    }
};
