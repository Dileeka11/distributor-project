<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $fillable = ['employee_id', 'date', 'clock_in', 'clock_out', 'total_hours', 'status'];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; cast so the JSON
        // always carries a real integer (the UI matches rows by employee_id).
        'employee_id' => 'integer',
        'date' => 'date',
        'total_hours' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
