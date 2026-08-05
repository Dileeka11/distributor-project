<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Product assembly runs: the stock ledger for building a composite product.
 * One row per item that moved in a run — a negative qty for each component
 * consumed, a positive qty for the assembled product units — so the stock
 * transaction report can show product builds alongside GRNs and invoices.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_runs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            // Not a foreign key: the product's own item is deleted with the
            // product, and a component item must stay deletable the same way
            // it is elsewhere in the ledger (stock_adjustments does the same).
            $t->unsignedBigInteger('item_id');
            $t->unsignedBigInteger('batch_id')->nullable();  // cost lot the component came from
            $t->integer('qty');                              // signed: +built / -consumed
            $t->unsignedInteger('units');                    // units made by the run
            $t->string('remark', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_runs');
    }
};
