<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Leave categories (with a yearly day allowance) and leave applications. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_categories', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120)->unique();
            $t->integer('annual_days')->default(0);   // yearly allowance per employee
            $t->string('color', 9)->default('#6366f1'); // calendar colour
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        Schema::create('leaves', function (Blueprint $t) {
            $t->id();
            $t->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $t->foreignId('leave_category_id')->constrained()->restrictOnDelete();
            $t->date('from_date');
            $t->integer('days')->default(1);
            $t->string('description', 500)->nullable();
            $t->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $t->string('admin_note', 500)->nullable();
            $t->timestamp('decided_at')->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['employee_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leaves');
        Schema::dropIfExists('leave_categories');
    }
};
