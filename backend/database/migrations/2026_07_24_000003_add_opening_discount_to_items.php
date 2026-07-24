<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A discount (%) applied when selling an item's opening / old stock. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $t) {
            $t->decimal('opening_discount', 5, 2)->default(0)->after('stock');
        });
    }

    public function down(): void
    {
        Schema::table('items', fn (Blueprint $t) => $t->dropColumn('opening_discount'));
    }
};
