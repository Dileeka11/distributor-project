<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_types')) {
            Schema::create('customer_types', function (Blueprint $t) {
                $t->id();
                $t->string('name')->unique();
                $t->timestamps();
            });
        }

        // Seed the list from any customer types already in use, plus sensible defaults.
        $names = DB::table('customers')
            ->whereNotNull('type')
            ->where('type', '!=', '')
            ->distinct()
            ->pluck('type')
            ->all();

        $names = array_values(array_unique(array_merge($names, ['Retailer', 'Wholesaler'])));

        foreach ($names as $name) {
            DB::table('customer_types')->updateOrInsert(
                ['name' => $name],
                ['name' => $name, 'created_at' => now(), 'updated_at' => now()],
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_types');
    }
};
