<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = optional($this->route('employee'))->id;

        return [
            'code' => ['required', 'string', 'max:32', Rule::unique('employees', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:200'],
            'role' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'work_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'ot_rate' => ['nullable', 'numeric', 'min:0'],
            'join_date' => ['nullable', 'date'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
