<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            if (! Schema::hasColumn('customers', 'city')) {
                $t->string('city', 120)->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'cash_discount')) {
                $t->decimal('cash_discount', 5, 2)->default(0)->after('type');
            }
            if (! Schema::hasColumn('customers', 'cheque_discount')) {
                $t->decimal('cheque_discount', 5, 2)->default(0)->after('cash_discount');
            }
            if (! Schema::hasColumn('customers', 'terms_days')) {
                $t->unsignedInteger('terms_days')->default(0)->after('cheque_discount');
            }
            if (! Schema::hasColumn('customers', 'description')) {
                $t->text('description')->nullable()->after('credit_limit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            $t->dropColumn(['city', 'cash_discount', 'cheque_discount', 'terms_days', 'description']);
        });
    }
};
