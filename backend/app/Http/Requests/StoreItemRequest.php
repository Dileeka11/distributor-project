<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $itemId = optional($this->route('item'))->id;

        return [
            'code' => ['required', 'string', 'max:32', Rule::unique('items', 'code')->ignore($itemId)],
            'name' => ['required', 'string', 'max:200'],
            'category_id' => ['required', 'exists:categories,id'],
            'distributor_price' => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
            'retail_price' => ['required', 'numeric', 'min:0'],
            // Opening stock + its discount are only set when the item is created;
            // the controller ignores them on update (they can't be edited later).
            'stock' => ['required', 'integer', 'min:0'],
            'opening_discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
