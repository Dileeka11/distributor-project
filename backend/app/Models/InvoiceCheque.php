<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceCheque extends Model
{
    protected $fillable = ['invoice_id', 'cheque_no', 'cheque_date', 'amount', 'cleared_at'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'invoice_id' => 'integer',
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
        'cleared_at' => 'datetime',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
