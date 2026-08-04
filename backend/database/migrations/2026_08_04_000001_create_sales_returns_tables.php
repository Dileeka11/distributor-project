<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sales returns: goods a customer hands back off an invoice they already have.
 *
 * A return does not rewrite the invoice it came from — that bill stands as it
 * was issued. What it produces is a credit for the customer, which the next
 * invoice they are billed on draws down.
 *
 * It moves no stock either: returned goods are recorded here and nowhere else,
 * so item quantities and cost lots are left exactly as the sale left them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_returns', function (Blueprint $t) {
            $t->id();
            $t->string('no')->unique();
            $t->date('date');
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            // The invoice being returned against — kept so the original bill can
            // show what came back off it.
            $t->foreignId('invoice_id')->constrained()->restrictOnDelete();
            $t->decimal('total', 14, 2)->default(0);
            $t->text('note')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index('customer_id');
        });

        // How much of each return has been spent, and on which invoice. Held
        // per allocation rather than as a flag so one return can cover parts of
        // two bills, and so editing or cancelling an invoice hands the credit
        // straight back.
        Schema::create('invoice_return_credits', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sales_return_id')->constrained()->cascadeOnDelete();
            $t->decimal('amount', 14, 2)->default(0);
            $t->timestamps();

            $t->unique(['invoice_id', 'sales_return_id']);
        });

        Schema::create('sales_return_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_return_id')->constrained()->cascadeOnDelete();
            $t->foreignId('invoice_line_id')->nullable()->constrained('invoice_lines')->nullOnDelete();
            $t->foreignId('item_id')->constrained()->restrictOnDelete();
            // Which cost lot it was sold from — recorded for the trail only.
            $t->foreignId('batch_id')->nullable()->constrained('item_batches')->nullOnDelete();
            $t->string('name'); // snapshot, like invoice_lines
            $t->integer('qty');
            $t->decimal('price', 12, 2);          // unit price as invoiced
            $t->decimal('discount_rate', 5, 2)->default(0); // the invoice's rate, per unit
            $t->decimal('total', 14, 2)->default(0);        // qty x price less discount
            $t->timestamps();
        });

        Schema::table('invoices', function (Blueprint $t) {
            if (! Schema::hasColumn('invoices', 'return_credit')) {
                // Return credit taken off this bill. Applied after discount and
                // tax — it is money already discounted on the earlier invoice.
                $t->decimal('return_credit', 14, 2)->default(0)->after('tax_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->dropColumn('return_credit');
        });
        Schema::dropIfExists('invoice_return_credits');
        Schema::dropIfExists('sales_return_lines');
        Schema::dropIfExists('sales_returns');
    }
};
