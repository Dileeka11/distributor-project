<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('item_batches')) {
            Schema::create('item_batches', function (Blueprint $t) {
                $t->id();
                $t->foreignId('item_id')->constrained()->cascadeOnDelete();
                $t->foreignId('grn_id')->nullable()->constrained()->nullOnDelete();
                $t->decimal('unit_price', 12, 2)->default(0);
                $t->decimal('discount', 5, 2)->default(0);     // percent
                $t->decimal('unit_cost', 12, 2)->default(0);   // unit_price after discount
                $t->integer('qty_in')->default(0);
                $t->integer('qty_remaining')->default(0);
                $t->timestamps();
            });
        }

        Schema::table('grn_lines', function (Blueprint $t) {
            if (! Schema::hasColumn('grn_lines', 'unit_price')) {
                $t->decimal('unit_price', 12, 2)->default(0)->after('qty');
            }
            if (! Schema::hasColumn('grn_lines', 'discount')) {
                $t->decimal('discount', 5, 2)->default(0)->after('unit_price');
            }
        });

        Schema::table('invoice_lines', function (Blueprint $t) {
            if (! Schema::hasColumn('invoice_lines', 'batch_id')) {
                $t->foreignId('batch_id')->nullable()->after('item_id')->constrained('item_batches')->nullOnDelete();
            }
        });

        // Opening batch for any item that already has on-hand stock.
        foreach (DB::table('items')->where('stock', '>', 0)->get() as $it) {
            if (! DB::table('item_batches')->where('item_id', $it->id)->exists()) {
                DB::table('item_batches')->insert([
                    'item_id' => $it->id,
                    'grn_id' => null,
                    'unit_price' => $it->distributor_price,
                    'discount' => 0,
                    'unit_cost' => $it->distributor_price,
                    'qty_in' => $it->stock,
                    'qty_remaining' => $it->stock,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoice_lines', function (Blueprint $t) {
            $t->dropConstrainedForeignId('batch_id');
        });
        Schema::table('grn_lines', function (Blueprint $t) {
            $t->dropColumn(['unit_price', 'discount']);
        });
        Schema::dropIfExists('item_batches');
    }
};
