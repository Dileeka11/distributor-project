<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Users are created with a username; email is optional on the form but the
 * column was still NOT NULL, so adding a user without an email failed.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `users` MODIFY `email` VARCHAR(255) NULL');
    }

    public function down(): void
    {
        DB::statement("UPDATE `users` SET `email` = CONCAT(`username`, '@local') WHERE `email` IS NULL");
        DB::statement('ALTER TABLE `users` MODIFY `email` VARCHAR(255) NOT NULL');
    }
};
