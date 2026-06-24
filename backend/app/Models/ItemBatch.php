<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItemBatch extends Model
{
    protected $fillable = [
        'item_id', 'grn_id', 'unit_price', 'discount', 'unit_cost', 'qty_in', 'qty_remaining',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'qty_in' => 'integer',
        'qty_remaining' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(Grn::class);
    }
}
