<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'contact', 'phone', 'email', 'address', 'city',
        'type', 'cash_discount', 'cheque_discount', 'terms_days',
        'credit_limit', 'description', 'balance',
    ];

    protected $casts = [
        'cash_discount' => 'decimal:2',
        'cheque_discount' => 'decimal:2',
        'terms_days' => 'integer',
        'credit_limit' => 'decimal:2',
        'balance' => 'decimal:2',
    ];

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(Settlement::class);
    }
}
