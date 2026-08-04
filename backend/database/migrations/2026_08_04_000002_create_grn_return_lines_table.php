<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Goods a customer returned to us, handed back to the supplier on a GRN.
 *
 * Each row draws down one sales return line, so the pool of returnable goods
 * shrinks as it is sent back and the next GRN only offers what is still here.
 * The cost of what goes back comes off that GRN's bill.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grn_return_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sales_return_line_id')->constrained()->cascadeOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            $t->string('name'); // snapshot, like the other line tables
            $t->integer('qty');
            // What the goods cost us — the lot they were bought on, so the
            // credit back to the supplier is at the price we paid.
            $t->decimal('unit_cost', 12, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->timestamps();

            $t->index(['grn_id', 'sales_return_line_id']);
        });

        Schema::table('grns', function (Blueprint $t) {
            if (! Schema::hasColumn('grns', 'return_deduction')) {
                $t->decimal('return_deduction', 14, 2)->default(0)->after('tax_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('grns', function (Blueprint $t) {
            $t->dropColumn('return_deduction');
        });
        Schema::dropIfExists('grn_return_lines');
    }
};
