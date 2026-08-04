<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One draw-down of a sales return's credit against an invoice. */
class InvoiceReturnCredit extends Model
{
    protected $fillable = ['invoice_id', 'sales_return_id', 'amount'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'invoice_id' => 'integer',
        'sales_return_id' => 'integer',
        'amount' => 'decimal:2',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class);
    }
}
