<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends Model
{
    protected $fillable = ['item_id', 'grn_id', 'batch_id', 'qty', 'type', 'remark', 'created_by'];

    protected $casts = [
        'item_id' => 'integer',
        'grn_id' => 'integer',
        'batch_id' => 'integer',
        'qty' => 'integer',
        'created_by' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
