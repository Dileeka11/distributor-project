<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSettlementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'side' => ['required', 'in:receivable,payable'],
            'party_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'mode' => ['required', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:80'],
            'cheque_date' => ['nullable', 'date'],
            'cheques' => ['nullable', 'array'],
            'cheques.*.no' => ['nullable', 'string', 'max:60'],
            'cheques.*.date' => ['nullable', 'date'],
            'cheques.*.amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
