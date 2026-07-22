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
        'amount', 'mode', 'reference', 'cheque_date', 'applied', 'created_by',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'customer_id' => 'integer',
        'supplier_id' => 'integer',
        'created_by' => 'integer',
        'date' => 'date',
        'cheque_date' => 'date',
        'amount' => 'decimal:2',
        'applied' => 'array',
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
