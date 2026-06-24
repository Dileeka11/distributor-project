<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            if (! Schema::hasColumn('invoices', 'discount_type')) {
                $t->enum('discount_type', ['none', 'cash', 'cheque'])->default('none')->after('subtotal');
            }
            if (! Schema::hasColumn('invoices', 'discount_rate')) {
                $t->decimal('discount_rate', 5, 2)->default(0)->after('discount_type');
            }
            if (! Schema::hasColumn('invoices', 'discount_amount')) {
                $t->decimal('discount_amount', 14, 2)->default(0)->after('discount_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->dropColumn(['discount_type', 'discount_rate', 'discount_amount']);
        });
    }
};
