<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_cheques', function (Blueprint $t) {
            if (! Schema::hasColumn('invoice_cheques', 'cleared_at')) {
                $t->timestamp('cleared_at')->nullable()->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoice_cheques', function (Blueprint $t) {
            $t->dropColumn('cleared_at');
        });
    }
};
