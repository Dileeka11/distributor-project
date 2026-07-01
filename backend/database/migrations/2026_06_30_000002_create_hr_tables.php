<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Employees, daily attendance and monthly payroll for the HR module. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $t) {
            $t->id();
            $t->string('code', 32)->unique();
            $t->string('name', 200);
            $t->string('role', 120)->nullable();
            $t->string('phone', 40)->nullable();
            $t->string('email', 120)->nullable();
            $t->decimal('basic_salary', 14, 2)->default(0);
            $t->decimal('hourly_rate', 10, 2)->default(0);
            $t->date('join_date')->nullable();
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        Schema::create('attendances', function (Blueprint $t) {
            $t->id();
            $t->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $t->date('date');
            $t->time('clock_in')->nullable();
            $t->time('clock_out')->nullable();
            $t->decimal('total_hours', 6, 2)->default(0);
            $t->string('status', 20)->default('present'); // present | absent | leave | half-day
            $t->timestamps();
            $t->unique(['employee_id', 'date']);
        });

        Schema::create('payrolls', function (Blueprint $t) {
            $t->id();
            $t->string('code', 32)->unique(); // payslip / bill no, e.g. PSL-0001
            $t->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('month');
            $t->unsignedSmallInteger('year');
            $t->unsignedSmallInteger('days_worked')->default(0);
            $t->decimal('total_hours', 8, 2)->default(0);
            $t->decimal('basic_salary', 14, 2)->default(0);
            $t->decimal('hours_pay', 14, 2)->default(0);
            $t->decimal('bonus', 14, 2)->default(0);
            $t->decimal('gross_pay', 14, 2)->default(0);
            $t->decimal('deductions', 14, 2)->default(0);
            $t->decimal('net_pay', 14, 2)->default(0);
            $t->timestamp('generated_at')->nullable();
            $t->timestamps();
            $t->unique(['employee_id', 'month', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payrolls');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('employees');
    }
};
