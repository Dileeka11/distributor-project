<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A cheque recorded on a bill may be worth more than the bill still owes — the
 * rest of it was already collected by a receipt. Clearing such a cheque spills
 * the surplus onto the party's other dues, so each cheque now keeps a snapshot
 * of how it was posted (exactly like settlement_cheques) and unticking can
 * reverse it precisely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_cheques', function (Blueprint $t) {
            if (! Schema::hasColumn('invoice_cheques', 'applied')) {
                $t->json('applied')->nullable()->after('cleared_at');
            }
        });

        Schema::table('grn_cheques', function (Blueprint $t) {
            if (! Schema::hasColumn('grn_cheques', 'applied')) {
                $t->json('applied')->nullable()->after('cleared_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoice_cheques', function (Blueprint $t) {
            $t->dropColumn('applied');
        });
        Schema::table('grn_cheques', function (Blueprint $t) {
            $t->dropColumn('applied');
        });
    }
};
