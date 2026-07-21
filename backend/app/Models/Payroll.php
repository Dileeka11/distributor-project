<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payroll extends Model
{
    protected $fillable = [
        'code', 'employee_id', 'month', 'year', 'days_worked', 'total_hours', 'ot_hours',
        'basic_salary', 'hours_pay', 'ot_pay', 'bonus', 'gross_pay', 'deductions', 'net_pay', 'generated_at',
    ];

    protected $casts = [
        'total_hours' => 'decimal:2',
        'ot_hours' => 'decimal:2',
        'basic_salary' => 'decimal:2',
        'hours_pay' => 'decimal:2',
        'ot_pay' => 'decimal:2',
        'bonus' => 'decimal:2',
        'gross_pay' => 'decimal:2',
        'deductions' => 'decimal:2',
        'net_pay' => 'decimal:2',
        'generated_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
