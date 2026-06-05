<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'contact', 'phone', 'email', 'address', 'terms_days', 'payable',
    ];

    protected $casts = [
        'terms_days' => 'integer',
        'payable' => 'decimal:2',
    ];

    public function grns(): HasMany
    {
        return $this->hasMany(Grn::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(Settlement::class);
    }
}
