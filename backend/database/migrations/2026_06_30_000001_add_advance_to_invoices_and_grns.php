<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Store the up-front "amount paid now" (advance) separately from `paid`.
 *
 * `paid` tracks the total ever collected on a document and grows when cheques
 * clear or settlements post, so it can't represent the original advance shown in
 * the edit form. `advance` is set once from the form and never touched by those
 * operations. Existing rows are backfilled: advance = paid − cleared cheques −
 * settlement allocations to the document.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', fn (Blueprint $t) => $t->decimal('advance', 14, 2)->default(0)->after('paid'));
        Schema::table('grns', fn (Blueprint $t) => $t->decimal('advance', 14, 2)->default(0)->after('paid'));

        $this->backfill('invoices', 'invoice_cheques', 'invoice_id', 'receivable', 'invoices');
        $this->backfill('grns', 'grn_cheques', 'grn_id', 'payable', 'grns');
    }

    private function backfill(string $docTable, string $chequeTable, string $fk, string $side, string $allocKey): void
    {
        // Cleared cheques recorded directly on the document.
        $cleared = DB::table($chequeTable)->whereNotNull('cleared_at')
            ->select($fk, DB::raw('SUM(amount) as s'))->groupBy($fk)->pluck('s', $fk);

        // Settlement allocations to the document: cash settlements carry the
        // snapshot on the row, cheque settlements on each cleared cheque.
        $alloc = [];
        $add = function ($json) use (&$alloc, $allocKey) {
            $ap = json_decode((string) $json, true);
            if (is_array($ap)) {
                foreach (($ap[$allocKey] ?? []) as $id => $amt) {
                    $alloc[$id] = ($alloc[$id] ?? 0) + (float) $amt;
                }
            }
        };
        foreach (DB::table('settlements')->where('side', $side)->pluck('applied') as $a) {
            $add($a);
        }
        foreach (DB::table('settlement_cheques')->whereNotNull('cleared_at')->pluck('applied') as $a) {
            $add($a);
        }

        foreach (DB::table($docTable)->get(['id', 'paid']) as $doc) {
            $advance = round((float) $doc->paid - (float) ($cleared[$doc->id] ?? 0) - (float) ($alloc[$doc->id] ?? 0), 2);
            DB::table($docTable)->where('id', $doc->id)->update(['advance' => max($advance, 0)]);
        }
    }

    public function down(): void
    {
        Schema::table('invoices', fn (Blueprint $t) => $t->dropColumn('advance'));
        Schema::table('grns', fn (Blueprint $t) => $t->dropColumn('advance'));
    }
};
