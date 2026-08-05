<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One item movement made by a product assembly run. */
class ProductRun extends Model
{
    protected $fillable = ['product_id', 'item_id', 'batch_id', 'qty', 'units', 'remark', 'created_by'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids as ints.
        'product_id' => 'integer',
        'item_id' => 'integer',
        'batch_id' => 'integer',
        'qty' => 'integer',
        'units' => 'integer',
        'created_by' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
