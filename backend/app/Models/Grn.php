<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Grn extends Model
{
    use HasFactory;

    protected $table = 'grns';

    protected $fillable = [
        'no', 'date', 'type', 'supplier_id',
        'subtotal', 'tax_rate', 'tax_amount', 'total', 'paid', 'status', 'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'subtotal' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'paid' => 'decimal:2',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(GrnLine::class);
    }

    public function cheques(): HasMany
    {
        return $this->hasMany(GrnCheque::class);
    }

    public function getBalanceAttribute(): float
    {
        return (float) $this->total - (float) $this->paid;
    }
}
