<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoice_cheques')) {
            Schema::create('invoice_cheques', function (Blueprint $t) {
                $t->id();
                $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
                $t->string('cheque_no', 60)->nullable();
                $t->date('cheque_date')->nullable();
                $t->decimal('amount', 14, 2)->default(0);
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_cheques');
    }
};
