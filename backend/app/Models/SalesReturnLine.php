<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesReturnLine extends Model
{
    protected $fillable = [
        'sales_return_id', 'invoice_line_id', 'item_id', 'batch_id',
        'name', 'qty', 'price', 'discount_rate', 'total',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'sales_return_id' => 'integer',
        'invoice_line_id' => 'integer',
        'item_id' => 'integer',
        'batch_id' => 'integer',
        'qty' => 'integer',
        'price' => 'decimal:2',
        'discount_rate' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /** Hand-backs of these goods to a supplier, drawn off this line. */
    public function grnReturnLines(): HasMany
    {
        return $this->hasMany(GrnReturnLine::class);
    }
}
