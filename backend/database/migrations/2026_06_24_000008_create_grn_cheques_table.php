<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('grn_cheques')) {
            Schema::create('grn_cheques', function (Blueprint $t) {
                $t->id();
                $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
                $t->string('cheque_no', 60)->nullable();
                $t->date('cheque_date')->nullable();
                $t->decimal('amount', 14, 2)->default(0);
                $t->timestamp('cleared_at')->nullable();
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('grn_cheques');
    }
};
