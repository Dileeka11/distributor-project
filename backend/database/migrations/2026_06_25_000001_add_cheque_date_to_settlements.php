<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlements', function (Blueprint $t) {
            if (! Schema::hasColumn('settlements', 'cheque_date')) {
                $t->date('cheque_date')->nullable()->after('reference');
            }
        });
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $t) {
            $t->dropColumn('cheque_date');
        });
    }
};
