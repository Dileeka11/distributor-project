<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/** Username login + admin flag + per-page permissions for system users. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('username')->nullable()->unique()->after('name');
            $t->boolean('is_admin')->default(false)->after('password');
            $t->json('permissions')->nullable()->after('is_admin'); // page keys a non-admin may access
        });

        // Primary admin: username "admin", password "admin@123", full access.
        DB::table('users')->where('email', 'admin@medistock.lk')->update([
            'username' => 'admin',
            'is_admin' => true,
            'password' => Hash::make('admin@123'),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['username', 'is_admin', 'permissions']));
    }
};
