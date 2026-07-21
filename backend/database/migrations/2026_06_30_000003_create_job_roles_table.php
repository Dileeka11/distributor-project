<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_roles', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->timestamps();
        });

        // Seed from any roles already used by employees, plus sensible defaults.
        $names = DB::table('employees')
            ->whereNotNull('role')->where('role', '!=', '')
            ->distinct()->pluck('role')->all();

        $names = array_values(array_unique(array_merge($names, ['Manager', 'Sales Rep', 'Cashier', 'Driver', 'Store Keeper'])));

        foreach ($names as $name) {
            DB::table('job_roles')->updateOrInsert(
                ['name' => $name],
                ['name' => $name, 'created_at' => now(), 'updated_at' => now()],
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('job_roles');
    }
};
