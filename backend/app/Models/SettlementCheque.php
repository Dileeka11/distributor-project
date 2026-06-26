<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementCheque extends Model
{
    protected $fillable = ['settlement_id', 'cheque_no', 'cheque_date', 'amount', 'cleared_at', 'applied'];

    protected $casts = [
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
        'cleared_at' => 'datetime',
        'applied' => 'array',
    ];

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(Settlement::class);
    }
}
