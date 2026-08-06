import { useEffect, useState } from 'react';
import { Plus, X, Boxes, Hammer, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0 } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, Pagination } from '@/components/ui/Common';
import { usePagination } from '@/lib/usePagination';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, MoneyInput } from '@/components/ui/Field';
import { TotalRow } from '@/pages/InvoicesPage';
import type { Category, Item, ItemBatch, Product } from '@/types';

interface DraftLine { item_id: number | ''; batch_id: number | ''; qty: string; price: string; }
const blankLine = (): DraftLine => ({ item_id: '', batch_id: '', qty: '1', price: '0' });

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [create, setCreate] = useState(false);
  const [assembling, setAssembling] = useState<Product | null>(null);

  const load = () => http.get('/api/products').then((r) => setRows(r.data.data));
  useEffect(() => { void load(); }, []);

  const pager = usePagination(rows, rows.length);

  const del = async (p: Product) => {
    const name = p.item?.name ?? 'this product';
    if (!(await confirmDelete({
      title: 'Delete product?',
      html: `Delete <b>${name}</b>? Component stock for the ${fmt0(Number(p.item?.stock ?? 0))} un-sold units will be restored.`,
    }))) return;
    try { await http.delete(`/api/products/${p.id}`); toast('Product deleted'); void load(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Products"
        sub="Build new sellable products by combining existing items."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New product</Button>}
      />

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Product</th><th>Components</th><th className="num">Actual price</th><th className="num">Selling price</th><th className="num">Margin</th><th className="num">Stock</th><th></th></tr></thead>
          <tbody>
            {pager.slice.map((p) => {
              const actual = Number(p.actual_price);
              const selling = Number(p.selling_price);
              const margin = selling - actual;
              const stock = Number(p.item?.stock ?? 0);
              return (
                <tr key={p.id}>
                  <td className="mono font-semibold">{p.item?.code ?? '—'}</td>
                  <td>
                    <div className="font-semibold">{p.item?.name ?? '—'}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{p.item?.category?.name ?? ''}</div>
                  </td>
                  <td className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    {(p.components ?? []).map((c) => `${fmt0(Number(c.qty))} × ${c.name}`).join(' · ')}
                  </td>
                  <td className="num money">{fmt(actual)}</td>
                  <td className="num money font-bold">{fmt(selling)}</td>
                  <td className="num money" style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(margin)}</td>
                  <td className="num">
                    <Badge kind={stock > 0 ? 'green' : 'red'}>{fmt0(stock)}</Badge>
                  </td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Hammer size={14} />} title="Assemble more units" onClick={() => setAssembling(p)}>Assemble</Button>
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void del(p)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty icon={<Boxes size={40} />} title="No products yet"
            sub="Combine two or more items into a new product — it becomes sellable on invoices." />
        )}
        {rows.length > 0 && <Pagination {...pager.props} />}
      </div>

      {create && <ProductBuilder onClose={() => setCreate(false)} onSaved={() => { setCreate(false); void load(); }} />}
      {assembling && <AssembleModal product={assembling} onClose={() => setAssembling(null)} onSaved={() => { setAssembling(null); void load(); }} />}
    </div>
  );
}

// Invoice-style builder: pick items + qty + price, actual price = line total,
// then set your own selling price. Saving assembles the first units.
function ProductBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [units, setUnits] = useState('1');
  const [selling, setSelling] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [batchesByItem, setBatchesByItem] = useState<Record<number, ItemBatch[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void http.get('/api/items').then((r) => setItems(r.data.data));
    void http.get('/api/categories').then((r) => setCategories(r.data.data));
  }, []);

  const loadBatches = (itemId: number) => {
    if (!itemId) return;
    void http.get(`/api/items/${itemId}/batches`).then((r) => setBatchesByItem((m) => ({ ...m, [itemId]: r.data.data })));
  };
  const batchesFor = (l: DraftLine) => (l.item_id ? batchesByItem[Number(l.item_id)] ?? [] : []);
  const batchFor = (l: DraftLine) => batchesFor(l).find((b) => Number(b.id) === l.batch_id);

  const itemFor = (l: DraftLine) => items.find((x) => Number(x.id) === l.item_id);
  const looseFor = (it: Item) =>
    Number(it.stock) - (batchesByItem[Number(it.id)] ?? []).reduce((s, b) => s + Number(b.qty_remaining), 0);
  const oldStockPrice = (it: Item) =>
    Number(it.wholesale_price) * (1 - (Number(it.opening_discount ?? 0) || 0) / 100);
  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => Number(x.id) === id);
    // Until a cost lot is chosen the price falls back to the item's retail
    // price; picking a lot replaces it with what that lot actually cost.
    setLine(i, { item_id: id, batch_id: '', price: item ? Number(item.retail_price).toFixed(2) : '0' });
    if (id) loadBatches(Number(id));
  };

  /**
   * Choosing which lot the component comes out of also sets its price, so the
   * product is costed at what the goods were bought for. Still editable after.
   */
  const pickBatch = (i: number, l: DraftLine, v: number | '') => {
    const it = itemFor(l);
    if (v === '') { setLine(i, { batch_id: '' }); return; }
    if (v === 0) {
      setLine(i, { batch_id: 0, price: it ? oldStockPrice(it).toFixed(2) : '0' });
      return;
    }
    const b = batchesFor(l).find((x) => Number(x.id) === v);
    setLine(i, { batch_id: v, price: b ? Number(b.unit_cost).toFixed(2) : '0' });
  };
  /** Units of this row's exact item + cost lot already claimed by other rows. */
  const takenElsewhere = (l: DraftLine, exceptIdx: number) =>
    l.item_id === '' ? 0 : lines.reduce(
      (s, x, idx) => s + (idx !== exceptIdx && x.item_id === l.item_id && x.batch_id === l.batch_id
        ? (Number(x.qty) || 0)
        : 0),
      0,
    );

  /** A cost lot another row already took for this same item. */
  const lotTaken = (l: DraftLine, exceptIdx: number, batchId: number) =>
    lines.some((x, idx) => idx !== exceptIdx && x.item_id === l.item_id && x.batch_id === batchId);

  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const unitsN = Math.max(1, Number(units) || 1);
  // A line with cost-batches must have one selected (same rule as invoices).
  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0 && (batchesFor(l).length === 0 || l.batch_id !== ''));
  // Actual price is the component total for ONE unit of the product.
  // Entered quantities are the whole run, so one unit costs the run spread out.
  const runCost = validLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const actual = runCost / unitsN;
  const sellingN = Number(selling) || 0;
  const shortages = validLines.filter((l) => {
    const it = itemFor(l);
    if (!it) return false;
    const batch = batchFor(l);
    const have = batch ? Number(batch.qty_remaining) : Number(it.stock);
    return Number(l.qty) > have;
  });
  const canSave = name.trim() !== '' && validLines.length > 0 && sellingN > 0 && shortages.length === 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await http.post('/api/products', {
        name: name.trim(),
        category_id: categoryId || null,
        selling_price: sellingN,
        units: unitsN,
        lines: validLines.map((l) => ({ item_id: l.item_id, batch_id: l.batch_id || null, qty: Number(l.qty), price: Number(l.price) })),
      });
      toast('Product created');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title="New product"
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3.5">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Actual price / unit</span>
            <span className="text-[20px] font-extrabold mono">Rs {fmt(actual)}</span>
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>Create product</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Field label="Product name" req>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Umbrella gift pack" />
        </Field>
        <Field label="Category" hint="Defaults to “Products”.">
          <Select value={categoryId === '' ? '' : String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Products (auto)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Units to assemble" req hint="Component stock is deducted.">
          <Input className="mono text-right" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Component items <span className="font-medium" style={{ color: 'var(--text-faint)' }}>· the whole quantity used for all {fmt0(unitsN)} unit{unitsN === 1 ? '' : 's'}</span></div>
      <div className="card p-2.5 mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)', width: '30%' }}>Item</th>
              <th className="text-left text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: '28%' }}>Cost</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 70 }}>Qty</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Price</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)' }}>Amount</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = itemFor(l);
              const need = Number(l.qty) || 0;
              const batch = batchFor(l);
              const pool = l.batch_id === 0
                ? (it ? looseFor(it) : 0)
                : batch
                  ? Number(batch.qty_remaining)
                  : Number(it?.stock ?? 0);
              // The same item can appear on more than one row, taken from a
              // different cost lot each time — so what is left for this row is
              // its lot less whatever the other rows already draw from it.
              const have = pool - takenElsewhere(l, i);
              const short = it ? need > have : false;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <Select value={l.item_id === '' ? '' : String(l.item_id)} onChange={(e) => pickItem(i, e.target.value ? Number(e.target.value) : '')} style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select item…</option>
                      {items.map((x) => (
                        <option key={x.id} value={String(Number(x.id))} disabled={Number(x.stock) <= 0}>
                          {x.code} · {x.name}{Number(x.stock) <= 0 ? ' (out)' : ''}
                        </option>
                      ))}
                    </Select>
                    {it && (
                      <div className="text-[12px] mt-1" style={{ color: short ? 'var(--red)' : 'var(--text-muted)' }}>
                        Stock: {fmt0(Number(it.stock))} · RP Rs {fmt(Number(it.retail_price))}
                        {l.batch_id === 0 ? ` · old stock ${fmt0(looseFor(it))} left` : batch ? ` · batch ${fmt0(Number(batch.qty_remaining))} left` : ''}
                        {short ? ` — need ${fmt0(need)}, only ${fmt0(Math.max(0, have))} available` : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5 align-top">
                    <Select
                      value={l.batch_id === '' ? '' : String(l.batch_id)}
                      disabled={l.item_id === ''}
                      onChange={(e) => pickBatch(i, l, e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ height: 36, fontSize: 12.5 }}
                    >
                      <option value="">
                        {l.item_id === ''
                          ? 'Pick an item first'
                          : batchesFor(l).length === 0 && !(it && looseFor(it) > 0)
                            ? 'No cost lots'
                            : 'Select cost…'}
                      </option>
                      {it && looseFor(it) > 0 && (
                        <option value="0" disabled={lotTaken(l, i, 0)}>
                          Rs {fmt(oldStockPrice(it))} · old stock · {fmt0(looseFor(it))} left
                          {lotTaken(l, i, 0) ? ' (already used)' : ''}
                        </option>
                      )}
                      {batchesFor(l).map((b) => (
                        <option key={b.id} value={String(Number(b.id))} disabled={lotTaken(l, i, Number(b.id))}>
                          Rs {fmt(Number(b.unit_cost))} · GRN lot · {fmt0(Number(b.qty_remaining))} left
                          {lotTaken(l, i, Number(b.id)) ? ' (already used)' : ''}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-1.5 align-top"><Input className="mono text-right" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 36 }} /></td>
                  <td className="p-1.5"><MoneyInput className="text-right" value={l.price} onChange={(v) => setLine(i, { price: v })} style={{ height: 36 }} /></td>
                  <td className="p-1.5 text-right money font-semibold">{fmt((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                  <td className="p-1.5 text-right">
                    <button className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => delLine(i)} type="button"><X size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Button variant="subtle" size="sm" icon={<Plus size={14} />} onClick={addLine} style={{ margin: 8 }}>Add item</Button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Field label="Selling price (LKR)" req hint="Your price for one unit of the new product.">
          <MoneyInput value={selling} onChange={setSelling} />
        </Field>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Actual price (components)" v={fmt(actual)} />
          <TotalRow k="Selling price" v={fmt(sellingN)} />
          <div className="h-px my-2.5" style={{ background: 'var(--border)' }} />
          <TotalRow k="Margin / unit" v={fmt(sellingN - actual)} big accent={sellingN < actual} />
        </div>
      </div>
    </Modal>
  );
}

// Build more units of an existing product from its saved recipe.
/**
 * Assemble a run of an existing product.
 *
 * Built the same way as a new product: each line names an item, the cost lot it
 * comes out of, and the whole quantity the run consumes. The recipe only seeds
 * it — a run that used more, or drew from a different lot, is entered as it
 * actually happened.
 */
function AssembleModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [units, setUnits] = useState('1');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [batchesByItem, setBatchesByItem] = useState<Record<number, ItemBatch[]>>({});
  const [busy, setBusy] = useState(false);

  const loadBatches = (itemId: number) => {
    if (!itemId) return;
    void http.get(`/api/items/${itemId}/batches`).then((r) =>
      setBatchesByItem((m) => ({ ...m, [itemId]: r.data.data })));
  };

  useEffect(() => {
    void http.get('/api/items').then((r) => setItems(r.data.data));
    const comps = product.components ?? [];
    setLines(comps.map((c) => ({
      item_id: Number(c.item_id),
      batch_id: '' as number | '',
      // Seeded at one unit's worth, rounded up to whole items.
      qty: String(Math.max(1, Math.ceil(Number(c.qty)))),
      price: Number(c.price).toFixed(2),
    })));
    comps.forEach((c) => loadBatches(Number(c.item_id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const unitsN = Math.max(1, Number(units) || 1);
  const itemFor = (l: DraftLine) => items.find((x) => Number(x.id) === l.item_id);
  const batchesFor = (l: DraftLine) => (l.item_id ? batchesByItem[Number(l.item_id)] ?? [] : []);
  const batchFor = (l: DraftLine) => batchesFor(l).find((b) => Number(b.id) === l.batch_id);
  const looseFor = (it: Item) =>
    Number(it.stock) - (batchesByItem[Number(it.id)] ?? []).reduce((s, b) => s + Number(b.qty_remaining), 0);
  const oldStockPrice = (it: Item) =>
    Number(it.wholesale_price) * (1 - (Number(it.opening_discount ?? 0) || 0) / 100);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => Number(x.id) === id);
    setLine(i, { item_id: id, batch_id: '', price: item ? Number(item.retail_price).toFixed(2) : '0' });
    if (id) loadBatches(Number(id));
  };
  const pickBatch = (i: number, l: DraftLine, v: number | '') => {
    const it = itemFor(l);
    if (v === '') { setLine(i, { batch_id: '' }); return; }
    if (v === 0) { setLine(i, { batch_id: 0, price: it ? oldStockPrice(it).toFixed(2) : '0' }); return; }
    const b = batchesFor(l).find((x) => Number(x.id) === v);
    setLine(i, { batch_id: v, price: b ? Number(b.unit_cost).toFixed(2) : '0' });
  };
  const takenElsewhere = (l: DraftLine, exceptIdx: number) =>
    l.item_id === '' ? 0 : lines.reduce(
      (s, x, idx) => s + (idx !== exceptIdx && x.item_id === l.item_id && x.batch_id === l.batch_id ? (Number(x.qty) || 0) : 0), 0);
  const lotTaken = (l: DraftLine, exceptIdx: number, batchId: number) =>
    lines.some((x, idx) => idx !== exceptIdx && x.item_id === l.item_id && x.batch_id === batchId);
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0);
  const runCost = validLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const anyShort = lines.some((l, i) => {
    const it = itemFor(l);
    if (!it || !(Number(l.qty) > 0)) return false;
    const batch = batchFor(l);
    const pool = l.batch_id === 0 ? looseFor(it) : batch ? Number(batch.qty_remaining) : Number(it.stock);
    return Number(l.qty) > pool - takenElsewhere(l, i);
  });
  const canSave = validLines.length > 0 && !anyShort && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await http.post(`/api/products/${product.id}/assemble`, {
        units: unitsN,
        lines: validLines.map((l) => ({
          item_id: l.item_id,
          batch_id: l.batch_id === '' || l.batch_id === 0 ? null : l.batch_id,
          qty: Number(l.qty),
          price: Number(l.price) || 0,
        })),
      });
      toast(`Assembled ${fmt0(unitsN)} × ${product.item?.name ?? 'product'}`);
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title={`Assemble — ${product.item?.name ?? ''}`}
      onClose={onClose}
      footer={<>
        <span className="mr-auto text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Run cost <b className="money" style={{ color: 'var(--text)', fontSize: 16 }}>Rs {fmt(runCost)}</b>
          {' '}· per unit <b className="money" style={{ color: 'var(--text)' }}>Rs {fmt(runCost / unitsN)}</b>
        </span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>Assemble</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field label="Units to assemble" req hint="How many finished units this run makes.">
          <Input className="mono text-right" inputMode="numeric" value={units}
            onChange={(e) => setUnits(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        Component items <span className="font-medium" style={{ color: 'var(--text-faint)' }}>· the whole quantity used for all {fmt0(unitsN)} unit{unitsN === 1 ? '' : 's'}</span>
      </div>
      <div className="card p-2.5 mb-2">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)', width: '30%' }}>Item</th>
              <th className="text-left text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: '28%' }}>Cost</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 70 }}>Qty</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Price</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)' }}>Amount</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = itemFor(l);
              const batch = batchFor(l);
              const pool = l.batch_id === 0 ? (it ? looseFor(it) : 0) : batch ? Number(batch.qty_remaining) : Number(it?.stock ?? 0);
              const have = pool - takenElsewhere(l, i);
              const over = it ? (Number(l.qty) || 0) > have : false;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5 align-top">
                    <Select value={l.item_id === '' ? '' : String(l.item_id)}
                      onChange={(e) => pickItem(i, e.target.value ? Number(e.target.value) : '')}
                      style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select item…</option>
                      {items.map((x) => (
                        <option key={x.id} value={String(Number(x.id))} disabled={Number(x.stock) <= 0}>
                          {x.code} · {x.name}{Number(x.stock) <= 0 ? ' (out)' : ''}
                        </option>
                      ))}
                    </Select>
                    {it && (
                      <div className="text-[12px] mt-1" style={{ color: over ? 'var(--red)' : 'var(--text-muted)' }}>
                        Stock: {fmt0(Number(it.stock))}
                        {over ? ` — need ${fmt0(Number(l.qty) || 0)}, only ${fmt0(Math.max(0, have))} available` : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5 align-top">
                    <Select value={l.batch_id === '' ? '' : String(l.batch_id)} disabled={l.item_id === ''}
                      onChange={(e) => pickBatch(i, l, e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ height: 36, fontSize: 12.5 }}>
                      <option value="">
                        {l.item_id === '' ? 'Pick an item first'
                          : batchesFor(l).length === 0 && !(it && looseFor(it) > 0) ? 'No cost lots' : 'Select cost…'}
                      </option>
                      {it && looseFor(it) > 0 && (
                        <option value="0" disabled={lotTaken(l, i, 0)}>
                          Rs {fmt(oldStockPrice(it))} · old stock · {fmt0(looseFor(it))} left{lotTaken(l, i, 0) ? ' (already used)' : ''}
                        </option>
                      )}
                      {batchesFor(l).map((b) => (
                        <option key={b.id} value={String(Number(b.id))} disabled={lotTaken(l, i, Number(b.id))}>
                          Rs {fmt(Number(b.unit_cost))} · GRN lot · {fmt0(Number(b.qty_remaining))} left{lotTaken(l, i, Number(b.id)) ? ' (already used)' : ''}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-1.5 align-top">
                    <Input className="mono text-right" value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })}
                      style={{ height: 36, borderColor: over ? 'var(--red)' : undefined }} />
                  </td>
                  <td className="p-1.5 align-top">
                    <MoneyInput className="text-right" value={l.price} onChange={(v) => setLine(i, { price: v })} style={{ height: 36 }} />
                  </td>
                  <td className="p-1.5 text-right money font-semibold align-top">{fmt((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                  <td className="p-1.5 text-right align-top">
                    <button className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => delLine(i)} type="button"><X size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Button variant="subtle" size="sm" icon={<Plus size={14} />} onClick={addLine} style={{ margin: 8 }}>Add item</Button>
      </div>
      <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
        Seeded from the recipe — change the items, cost lots or quantities to match what this run actually used.
      </div>
    </Modal>
  );
}
