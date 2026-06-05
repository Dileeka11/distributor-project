<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class NumberService
{
    /**
     * Reserve & return the next sequential number for a model & prefix.
     * Uses a SELECT FOR UPDATE within a transaction to avoid duplicates.
     */
    public static function next(string $modelClass, string $prefix, int $pad = 4): string
    {
        return DB::transaction(function () use ($modelClass, $prefix, $pad) {
            /** @var class-string<Model> $modelClass */
            $latest = $modelClass::query()
                ->where('no', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('id')
                ->value('no');

            $n = 0;
            if ($latest) {
                $n = (int) preg_replace('/\D/', '', substr($latest, strlen($prefix)));
            }

            return $prefix.str_pad((string) ($n + 1), $pad, '0', STR_PAD_LEFT);
        });
    }

    public static function invoicePrefix(): string
    {
        return (Setting::all_settings()['invoice_prefix'] ?? 'INV').'-';
    }
}
