<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlements', function (Blueprint $t) {
            if (! Schema::hasColumn('settlements', 'applied')) {
                // Snapshot of how a non-cheque settlement posted to outstanding,
                // so edit/delete can reverse it exactly. (Cheque settlements keep
                // their snapshot per-cheque in settlement_cheques.applied.)
                $t->json('applied')->nullable()->after('cheque_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $t) {
            $t->dropColumn('applied');
        });
    }
};
