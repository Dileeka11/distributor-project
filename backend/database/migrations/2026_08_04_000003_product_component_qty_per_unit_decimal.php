<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A recipe line is stored per one unit of the product, but the quantities are
 * now entered as the total for a whole run — 3 items across 2 units is 1.5 each,
 * which an integer column cannot hold. Widened so any run divides cleanly.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Raw DDL: this Laravel build has no column-change grammar for MySQL.
        DB::statement('ALTER TABLE `product_components` MODIFY `qty` DECIMAL(12,3) NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `product_components` MODIFY `qty` INT NOT NULL');
    }
};
