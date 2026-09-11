<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderLine extends Model
{
    protected $fillable = ['sales_order_id', 'item_id', 'name', 'qty'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'sales_order_id' => 'integer',
        'item_id' => 'integer',
        'qty' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
