<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            if (! Schema::hasColumn('invoices', 'cash_discount')) {
                $t->decimal('cash_discount', 5, 2)->default(0)->after('subtotal');
            }
            if (! Schema::hasColumn('invoices', 'cheque_discount')) {
                $t->decimal('cheque_discount', 5, 2)->default(0)->after('cash_discount');
            }
        });

        Schema::table('invoices', function (Blueprint $t) {
            foreach (['discount_type', 'discount_rate'] as $col) {
                if (Schema::hasColumn('invoices', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            if (! Schema::hasColumn('invoices', 'discount_type')) {
                $t->enum('discount_type', ['none', 'cash', 'cheque'])->default('none')->after('subtotal');
            }
            if (! Schema::hasColumn('invoices', 'discount_rate')) {
                $t->decimal('discount_rate', 5, 2)->default(0)->after('discount_type');
            }
            $t->dropColumn(['cash_discount', 'cheque_discount']);
        });
    }
};
