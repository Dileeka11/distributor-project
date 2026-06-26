<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlement_cheques', function (Blueprint $t) {
            if (! Schema::hasColumn('settlement_cheques', 'applied')) {
                // Snapshot of how a cleared cheque was posted (balance / opening /
                // per-invoice or per-GRN), so unticking can reverse it exactly.
                $t->json('applied')->nullable()->after('cleared_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('settlement_cheques', function (Blueprint $t) {
            $t->dropColumn('applied');
        });
    }
};
