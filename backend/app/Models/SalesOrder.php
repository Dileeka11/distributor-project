<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A customer's order for a given day; becomes an invoice when it goes out. */
class SalesOrder extends Model
{
    protected $fillable = [
        'no', 'date', 'due_date', 'customer_id', 'status', 'note', 'invoice_id', 'cancelled_at', 'created_by',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'customer_id' => 'integer',
        'invoice_id' => 'integer',
        'created_by' => 'integer',
        // Plain calendar days, sent as Y-m-d so no timezone can move them.
        'date' => 'date:Y-m-d',
        'due_date' => 'date:Y-m-d',
        'cancelled_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SalesOrderLine::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
