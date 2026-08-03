<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            if (! Schema::hasColumn('customers', 'credit_discount')) {
                $t->decimal('credit_discount', 5, 2)->default(0)->after('cheque_discount');
            }
        });

        Schema::table('invoices', function (Blueprint $t) {
            if (! Schema::hasColumn('invoices', 'credit_discount')) {
                $t->decimal('credit_discount', 5, 2)->default(0)->after('cheque_discount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            $t->dropColumn('credit_discount');
        });

        Schema::table('invoices', function (Blueprint $t) {
            $t->dropColumn('credit_discount');
        });
    }
};
