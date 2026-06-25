<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Settlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'date', 'side', 'customer_id', 'supplier_id',
        'amount', 'mode', 'reference', 'cheque_date', 'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function cheques(): HasMany
    {
        return $this->hasMany(SettlementCheque::class);
    }
}
