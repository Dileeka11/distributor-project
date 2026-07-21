<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = ['item_id', 'actual_price', 'selling_price'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids as ints.
        'item_id' => 'integer',
        'actual_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function components(): HasMany
    {
        return $this->hasMany(ProductComponent::class);
    }
}
