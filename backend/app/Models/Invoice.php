<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'no', 'date', 'type', 'customer_id',
        'subtotal', 'cash_discount', 'cheque_discount', 'discount_amount',
        'tax_rate', 'tax_amount', 'total', 'paid', 'advance', 'status', 'created_by',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'customer_id' => 'integer',
        'created_by' => 'integer',
        'date' => 'date',
        'subtotal' => 'decimal:2',
        'cash_discount' => 'decimal:2',
        'cheque_discount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'paid' => 'decimal:2',
        'advance' => 'decimal:2',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class);
    }

    public function cheques(): HasMany
    {
        return $this->hasMany(InvoiceCheque::class);
    }

    public function getBalanceAttribute(): float
    {
        return (float) $this->total - (float) $this->paid;
    }
}
