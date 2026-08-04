<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGrnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:cash,credit'],
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'paid' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.item_id' => ['required', 'exists:items,id'],
            'lines.*.qty' => ['required', 'numeric', 'min:0.01'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            // Customer-returned goods being handed back on this GRN.
            'return_lines' => ['nullable', 'array'],
            'return_lines.*.sales_return_line_id' => ['required', 'integer', 'exists:sales_return_lines,id'],
            'return_lines.*.qty' => ['required', 'integer', 'min:1'],
            'cheques' => ['nullable', 'array'],
            'cheques.*.no' => ['nullable', 'string', 'max:60'],
            'cheques.*.date' => ['nullable', 'date'],
            'cheques.*.amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
