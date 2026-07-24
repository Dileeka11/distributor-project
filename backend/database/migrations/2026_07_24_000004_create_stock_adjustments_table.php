<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Manual stock adjustments per item lot (a GRN batch or opening stock). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('item_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('grn_id')->default(0);          // 0 = opening lot
            $t->unsignedBigInteger('batch_id')->nullable();        // the item_batches row, if a GRN lot
            $t->integer('qty');                                    // signed: +add / -reduce
            $t->string('type', 10);                                // add | reduce
            $t->string('remark', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['item_id', 'grn_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
