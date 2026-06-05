<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    public $incrementing = false;
    protected $primaryKey = 'key';
    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'array'];

    public static function all_settings(): array
    {
        return Cache::rememberForever('app.settings', fn () => static::query()
            ->pluck('value', 'key')
            ->map(fn ($v) => is_array($v) && array_key_exists('v', $v) ? $v['v'] : $v)
            ->toArray());
    }

    public static function setMany(array $pairs): void
    {
        foreach ($pairs as $k => $v) {
            static::query()->updateOrInsert(
                ['key' => $k],
                ['value' => json_encode(['v' => $v]), 'updated_at' => now(), 'created_at' => now()],
            );
        }
        Cache::forget('app.settings');
    }
}
