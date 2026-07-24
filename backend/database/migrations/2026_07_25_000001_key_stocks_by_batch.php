<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Key each stock lot by its cost-batch instead of the GRN id. A batch whose GRN
 * row was removed had grn_id = NULL, which collapsed into the opening lot (0)
 * and made restored quantities show under "Opening" instead of their cost lot.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('stocks', 'batch_id')) {
            Schema::table('stocks', function (Blueprint $t) {
                $t->unsignedBigInteger('batch_id')->default(0)->after('grn_id'); // 0 = opening
            });
        }

        // Clear first: existing rows are keyed by GRN and would collide on the
        // new (item_id, batch_id) unique key.
        DB::statement('DELETE FROM stocks');

        // Add the new unique BEFORE dropping the old one — its leftmost column
        // (item_id) keeps the foreign key indexed, which the drop otherwise breaks.
        if (! $this->indexExists('stocks_item_id_batch_id_unique')) {
            Schema::table('stocks', function (Blueprint $t) {
                $t->unique(['item_id', 'batch_id']);
            });
        }
        if ($this->indexExists('stocks_item_id_grn_id_unique')) {
            Schema::table('stocks', function (Blueprint $t) {
                $t->dropUnique('stocks_item_id_grn_id_unique');
            });
        }

        // Rebuild: one lot per cost-batch, plus the opening remainder.
        DB::statement('
            INSERT INTO stocks (item_id, grn_id, batch_id, qty, created_at, updated_at)
            SELECT item_id, COALESCE(grn_id, 0), id, qty_remaining, NOW(), NOW()
            FROM item_batches WHERE qty_remaining > 0
        ');
        DB::statement('
            INSERT INTO stocks (item_id, grn_id, batch_id, qty, created_at, updated_at)
            SELECT i.id, 0, 0, i.stock - COALESCE(b.s, 0), NOW(), NOW()
            FROM items i
            LEFT JOIN (SELECT item_id, SUM(qty_remaining) s FROM item_batches GROUP BY item_id) b
              ON b.item_id = i.id
            WHERE (i.stock - COALESCE(b.s, 0)) > 0
        ');
    }

    public function down(): void
    {
        DB::statement('DELETE FROM stocks');
        if ($this->indexExists('stocks_item_id_batch_id_unique')) {
            Schema::table('stocks', fn (Blueprint $t) => $t->unique(['item_id', 'grn_id']));
            Schema::table('stocks', fn (Blueprint $t) => $t->dropUnique('stocks_item_id_batch_id_unique'));
        }
        Schema::table('stocks', fn (Blueprint $t) => $t->dropColumn('batch_id'));
    }

    private function indexExists(string $name): bool
    {
        return (int) DB::selectOne(
            "SELECT COUNT(*) AS c FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocks' AND INDEX_NAME = ?",
            [$name]
        )->c > 0;
    }
};
