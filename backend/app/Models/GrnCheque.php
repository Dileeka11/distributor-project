<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GrnCheque extends Model
{
    protected $fillable = ['grn_id', 'cheque_no', 'cheque_date', 'amount', 'cleared_at', 'applied'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'grn_id' => 'integer',
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
        'cleared_at' => 'datetime',
        // How the cleared cheque was posted: what went onto the GRN and, when
        // it was worth more than the GRN owed, where the rest went.
        'applied' => 'array',
    ];

    public function grn(): BelongsTo
    {
        return $this->belongsTo(Grn::class);
    }
}
