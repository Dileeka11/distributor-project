<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            if (! Schema::hasColumn('customers', 'opening_collected')) {
                // Running total collected against the opening outstanding
                // (credit_limit), so the Paid bar can reflect non-invoice receipts.
                $t->decimal('opening_collected', 14, 2)->default(0)->after('balance');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            $t->dropColumn('opening_collected');
        });
    }
};
