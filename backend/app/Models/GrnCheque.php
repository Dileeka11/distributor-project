<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GrnCheque extends Model
{
    protected $fillable = ['grn_id', 'cheque_no', 'cheque_date', 'amount', 'cleared_at'];

    protected $casts = [
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
        'cleared_at' => 'datetime',
    ];

    public function grn(): BelongsTo
    {
        return $this->belongsTo(Grn::class);
    }
}
