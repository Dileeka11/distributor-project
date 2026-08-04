<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'no', 'date', 'customer_id', 'invoice_id', 'total', 'note', 'created_by',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'customer_id' => 'integer',
        'invoice_id' => 'integer',
        'created_by' => 'integer',
        'date' => 'date',
        'total' => 'decimal:2',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** The invoice the goods were sold on. */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SalesReturnLine::class);
    }

    /** Where this credit has been spent so far. */
    public function allocations(): HasMany
    {
        return $this->hasMany(InvoiceReturnCredit::class);
    }

    /** Credit still to be drawn down by a future invoice. */
    public function getAvailableAttribute(): float
    {
        $used = (float) $this->allocations()->sum('amount');

        return round((float) $this->total - $used, 2);
    }
}
