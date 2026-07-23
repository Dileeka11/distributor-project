<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Soft-cancel for invoices and GRNs: the record is kept, effects reversed. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->timestamp('cancelled_at')->nullable()->after('status');
        });
        Schema::table('grns', function (Blueprint $t) {
            $t->timestamp('cancelled_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', fn (Blueprint $t) => $t->dropColumn('cancelled_at'));
        Schema::table('grns', fn (Blueprint $t) => $t->dropColumn('cancelled_at'));
    }
};
