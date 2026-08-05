<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Item;
use App\Models\ItemBatch;
use App\Models\Product;
use App\Services\NumberService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Composite products: build a new sellable item from other items.
 * Assembling deducts component stock; the product then behaves like any
 * other item (invoices, stock) since it lives in the `items` table.
 */
class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Product::query()
            ->with([
                'item.category:id,name',
                'components.item:id,code,name,stock,retail_price',
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    /** Create the product item, its recipe, and assemble the first units. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'units' => ['required', 'integer', 'min:1'],
            'lines' => ['required', 'array', 'min:1'],
            // The same item may appear more than once, taken from a different
            // cost lot each time, so the item alone is not required to be unique.
            'lines.*.item_id' => ['required', 'exists:items,id'],
            // Which GRN cost-batch the components are taken from (like invoices).
            'lines.*.batch_id' => ['nullable', 'exists:item_batches,id'],
            // The whole quantity consumed by this run, not a per-unit figure.
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.price' => ['required', 'numeric', 'min:0'],
        ]);

        $product = DB::transaction(function () use ($data) {
            $units = (int) $data['units'];
            $components = $this->lockComponents($data['lines'], 1);

            // Quantities arrive as the total for the run, so the cost of one
            // unit is the run's component cost spread over the units made.
            $actual = 0.0;
            foreach ($components as $c) {
                $actual += $c['total'];
            }
            $actual = round($actual / $units, 2);
            $selling = round((float) $data['selling_price'], 2);

            $categoryId = $data['category_id'] ?? null;
            if (! $categoryId) {
                $categoryId = Category::query()->firstOrCreate(['name' => 'Products'])->id;
            }

            $item = Item::query()->create([
                'code' => NumberService::next(Item::class, 'PRD-', 4, 'code'),
                'name' => $data['name'],
                'category_id' => $categoryId,
                'distributor_price' => $actual,
                'wholesale_price' => $selling,
                'retail_price' => $selling,
                'stock' => $units,
            ]);

            $product = Product::query()->create([
                'item_id' => $item->id,
                'actual_price' => $actual,
                'selling_price' => $selling,
            ]);

            foreach ($components as $c) {
                $product->components()->create([
                    'item_id' => $c['item']->id,
                    'name' => $c['item']->name,
                    // Kept per one unit, so assembling more later reads straight
                    // off the recipe.
                    'qty' => round($c['qty'] / $units, 3),
                    'price' => $c['price'],
                    'total' => round($c['total'] / $units, 2),
                ]);
                // The run consumes exactly what was entered.
                $this->consume($c);
            }

            // Project the components + the new product item into the stock ledger.
            $ids = array_map(fn ($c) => (int) $c['item']->id, $components);
            $ids[] = (int) $item->id;
            app(StockService::class)->projectMany($ids);

            return $product;
        });

        return response()->json([
            'data' => $product->fresh(['item.category:id,name', 'components.item:id,code,name,stock,retail_price']),
        ], 201);
    }

    /** Assemble more units of an existing product from its recipe. */
    public function assemble(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'units' => ['required', 'integer', 'min:1'],
            // Optional per-item cost-batch choices for this assembly run.
            'lines' => ['nullable', 'array'],
            'lines.*.item_id' => ['required_with:lines', 'integer'],
            'lines.*.batch_id' => ['nullable', 'exists:item_batches,id'],
        ]);

        DB::transaction(function () use ($product, $data) {
            $units = (int) $data['units'];
            $product->loadMissing('components');

            $batchByItem = [];
            foreach ($data['lines'] ?? [] as $l) {
                $batchByItem[(int) $l['item_id']] = $l['batch_id'] ?? null;
            }

            $lines = $product->components
                ->map(fn ($c) => [
                    'item_id' => $c->item_id,
                    'qty' => $c->qty,
                    'price' => $c->price,
                    'batch_id' => $batchByItem[(int) $c->item_id] ?? null,
                ])
                ->all();
            $components = $this->lockComponents($lines, $units);

            foreach ($components as $c) {
                $this->consume($c);
            }
            Item::query()->whereKey($product->item_id)->increment('stock', $units);

            $ids = array_map(fn ($c) => (int) $c['item']->id, $components);
            $ids[] = (int) $product->item_id;
            app(StockService::class)->projectMany($ids);
        });

        return response()->json([
            'data' => $product->fresh(['item.category:id,name', 'components.item:id,code,name,stock,retail_price']),
        ]);
    }

    /** Delete a product: return un-sold assembled units to component stock. */
    public function destroy(Product $product): JsonResponse
    {
        DB::transaction(function () use ($product) {
            $product->loadMissing(['item', 'components']);
            $remaining = $product->item ? (int) $product->item->stock : 0;
            $componentIds = $product->components->pluck('item_id')->map(fn ($v) => (int) $v)->all();

            if ($remaining > 0) {
                foreach ($product->components as $c) {
                    Item::query()->whereKey($c->item_id)->increment('stock', $c->qty * $remaining);
                }
            }

            // We want to delete the product and its components. If the product item is 
            // referenced in invoice_lines (active or cancelled), deleting the item will fail 
            // due to restrictOnDelete. In that case, we delete the product definition and set 
            // the item's stock to 0, keeping the item row for audit reference.
            // Otherwise, we delete the item entirely.
            $isReferenced = DB::table('invoice_lines')->where('item_id', $product->item_id)->exists();
            if ($isReferenced) {
                $product->delete();
                if ($product->item) {
                    $product->item->update(['stock' => 0]);
                }
            } else {
                if ($product->item) {
                    $product->item->delete();
                } else {
                    $product->delete();
                }
            }

            // Components and product item got stock back / updated; re-project them.
            app(StockService::class)->projectMany(array_merge($componentIds, [$product->item_id]));
        });

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Lock the component items (and chosen cost-batches) and verify enough
     * stock exists to assemble the requested units.
     * Returns [{item, batch|null, qty, price, total(per unit)}].
     */
    /**
     * Lock the component items and work out what each line consumes.
     *
     * `$multiplier` is how many times the line's quantity is taken: creating a
     * product sends the run's whole quantities and so multiplies by one, while
     * assembling more reads the per-unit recipe and multiplies by the units.
     * A per-unit recipe can be fractional, so the need is rounded up — half an
     * item cannot come off the shelf.
     */
    private function lockComponents(array $lines, float $multiplier): array
    {
        $ids = array_map(fn ($l) => $l['item_id'], $lines);
        $items = Item::query()->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');
        $batchIds = array_filter(array_map(fn ($l) => $l['batch_id'] ?? null, $lines));
        $batches = ItemBatch::query()->whereIn('id', $batchIds)->lockForUpdate()->get()->keyBy('id');

        $out = [];
        foreach ($lines as $line) {
            /** @var Item $item */
            $item = $items[$line['item_id']];
            $qty = (float) $line['qty'];
            $price = (float) $line['price'];
            $need = (int) ceil(round($qty * $multiplier, 3));
            $batchId = $line['batch_id'] ?? null;
            $batch = null;

            if ($batchId) {
                $batch = $batches[$batchId] ?? null;
                abort_if(! $batch || (int) $batch->item_id !== (int) $item->id, 422, "Invalid batch for {$item->name}");
                abort_if($batch->qty_remaining < $need, 422, "Only {$batch->qty_remaining} left in the selected batch for {$item->name}");
            } else {
                abort_if($item->stock < $need, 422, "Insufficient stock for {$item->name} (need {$need}, have {$item->stock}).");
            }

            $out[] = [
                'item' => $item,
                'batch' => $batch,
                'qty' => $qty,
                'need' => $need,   // whole items actually coming off the shelf
                'price' => $price,
                'total' => round($qty * $price, 2),
            ];
        }

        return $out;
    }

    /** Deduct one component's stock (and its cost-batch) for an assembly run. */
    private function consume(array $c): void
    {
        $c['item']->decrement('stock', $c['need']);
        if ($c['batch']) {
            $c['batch']->decrement('qty_remaining', $c['need']);
        }
    }
}
