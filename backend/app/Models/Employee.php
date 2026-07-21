<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'code', 'name', 'role', 'phone', 'email',
        'basic_salary', 'hourly_rate', 'work_hours', 'ot_rate', 'join_date', 'active',
    ];

    protected $casts = [
        'basic_salary' => 'decimal:2',
        'hourly_rate' => 'decimal:2',
        'work_hours' => 'decimal:2',
        'ot_rate' => 'decimal:2',
        'join_date' => 'date',
        'active' => 'boolean',
    ];

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }
}
