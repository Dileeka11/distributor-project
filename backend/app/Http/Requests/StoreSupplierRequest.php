<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = optional($this->route('supplier'))->id;

        return [
            'code' => ['required', 'string', 'max:32', Rule::unique('suppliers', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:200'],
            'contact' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:500'],
            'terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ];
    }
}
