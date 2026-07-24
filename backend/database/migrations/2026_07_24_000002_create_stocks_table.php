<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-lot stock ledger: one row per (item, GRN) plus a grn_id = 0 row for
 * opening / pre-GRN stock. items.stock is kept equal to SUM(stocks.qty).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stocks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('item_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('grn_id')->default(0); // 0 = opening / non-GRN stock
            $t->integer('qty')->default(0);
            $t->timestamps();
            $t->unique(['item_id', 'grn_id']);
        });

        // Backfill from the current cost-batches (per GRN) ...
        DB::statement('
            INSERT INTO stocks (item_id, grn_id, qty, created_at, updated_at)
            SELECT item_id, grn_id, qty_remaining, NOW(), NOW()
            FROM item_batches WHERE qty_remaining > 0
        ');
        // ... plus the opening remainder (item stock not held in any batch).
        DB::statement('
            INSERT INTO stocks (item_id, grn_id, qty, created_at, updated_at)
            SELECT i.id, 0, i.stock - COALESCE(b.s, 0), NOW(), NOW()
            FROM items i
            LEFT JOIN (SELECT item_id, SUM(qty_remaining) s FROM item_batches GROUP BY item_id) b
              ON b.item_id = i.id
            WHERE (i.stock - COALESCE(b.s, 0)) > 0
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};
