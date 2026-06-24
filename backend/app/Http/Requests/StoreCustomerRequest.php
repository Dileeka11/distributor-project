<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = optional($this->route('customer'))->id;

        return [
            'code' => ['required', 'string', 'max:32', Rule::unique('customers', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:200'],
            'contact' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:120'],
            'type' => ['nullable', 'string', 'max:40'],
            'cash_discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cheque_discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'terms_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
