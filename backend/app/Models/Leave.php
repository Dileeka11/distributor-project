<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Leave extends Model
{
    protected $fillable = [
        'employee_id', 'leave_category_id', 'from_date', 'days',
        'description', 'status', 'admin_note', 'decided_at', 'decided_by', 'created_by',
    ];

    protected $casts = [
        // PHP < 8.1 serializes numeric columns as strings; keep ids integers.
        'employee_id' => 'integer',
        'leave_category_id' => 'integer',
        'decided_by' => 'integer',
        'created_by' => 'integer',
        'from_date' => 'date',
        'days' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LeaveCategory::class, 'leave_category_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
