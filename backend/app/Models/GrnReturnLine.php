<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One returned item handed back to the supplier on a GRN. */
class GrnReturnLine extends Model
{
    protected $fillable = [
        'grn_id', 'sales_return_line_id', 'item_id', 'name', 'qty', 'unit_cost', 'total',
    ];

    protected $casts = [
        // PHP < 8.1 returns numeric DB columns as strings; keep ids integers.
        'grn_id' => 'integer',
        'sales_return_line_id' => 'integer',
        'item_id' => 'integer',
        'qty' => 'integer',
        'unit_cost' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function grn(): BelongsTo
    {
        return $this->belongsTo(Grn::class);
    }

    public function salesReturnLine(): BelongsTo
    {
        return $this->belongsTo(SalesReturnLine::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
