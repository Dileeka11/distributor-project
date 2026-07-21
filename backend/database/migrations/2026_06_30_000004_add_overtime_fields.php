<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Overtime: per-day standard hours + OT rate on employees, OT results on payroll. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $t) {
            $t->decimal('work_hours', 6, 2)->default(8)->after('hourly_rate'); // OT starts beyond this per day
            $t->decimal('ot_rate', 10, 2)->default(0)->after('work_hours');
        });

        Schema::table('payrolls', function (Blueprint $t) {
            $t->decimal('ot_hours', 8, 2)->default(0)->after('total_hours');
            $t->decimal('ot_pay', 14, 2)->default(0)->after('hours_pay');
        });
    }

    public function down(): void
    {
        Schema::table('employees', fn (Blueprint $t) => $t->dropColumn(['work_hours', 'ot_rate']));
        Schema::table('payrolls', fn (Blueprint $t) => $t->dropColumn(['ot_hours', 'ot_pay']));
    }
};
