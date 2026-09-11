<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sales orders: what a customer wants and on which day, taken down ahead of
 * time. An order moves no stock and picks no cost lot — on the day it becomes
 * an ordinary invoice, and that invoice decides both, exactly like any sale.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_orders', function (Blueprint $t) {
            $t->id();
            $t->string('no')->unique();
            $t->date('date');                              // taken on
            $t->date('due_date');                          // to be delivered / invoiced on
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->string('status', 20)->default('pending');  // pending | invoiced | cancelled
            $t->text('note')->nullable();
            // The invoice the order became. Cleared again if that invoice is cancelled.
            $t->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['status', 'due_date']);
        });

        Schema::create('sales_order_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            $t->string('name');   // snapshot, like invoice_lines
            $t->integer('qty');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_order_lines');
        Schema::dropIfExists('sales_orders');
    }
};
