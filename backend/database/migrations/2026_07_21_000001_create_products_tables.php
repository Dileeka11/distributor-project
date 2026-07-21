<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composite products: a sellable item built by combining other items.
 * The product itself is a row in `items` (so invoicing / stock work as-is);
 * `products` holds its pricing summary and `product_components` the recipe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            // The sellable item this product materialises as. Deleting the item
            // removes the product definition with it.
            $t->foreignId('item_id')->constrained()->cascadeOnDelete();
            $t->decimal('actual_price', 12, 2)->default(0);  // per-unit component total
            $t->decimal('selling_price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('product_components', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            $t->string('name'); // snapshot, like invoice_lines
            $t->integer('qty'); // per one unit of the product
            $t->decimal('price', 12, 2);
            $t->decimal('total', 14, 2);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_components');
        Schema::dropIfExists('products');
    }
};
