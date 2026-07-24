import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Boxes, Hammer, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0 } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, Pagination } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, MoneyInput } from '@/components/ui/Field';
import { TotalRow } from '@/pages/InvoicesPage';
import type { Category, Item, ItemBatch, Product, ProductComponent } from '@/types';

interface DraftLine { item_id: number | ''; batch_id: number | ''; qty: string; price: string; }
const blankLine = (): DraftLine => ({ item_id: '', batch_id: '', qty: '1', price: '0' });

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [create, setCreate] = useState(false);
  const [assembling, setAssembling] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const load = () => http.get('/api/products').then((r) => setRows(r.data.data));
  useEffect(() => { void load(); }, []);

  const paginated = useMemo(() => {
    return rows.slice((page - 1) * perPage, page * perPage);
  }, [rows, page, perPage]);

  // Reset page to 1 on rows reload/change
  useEffect(() => { setPage(1); }, [rows.length]);

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
            {paginated.map((p) => {
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
        {rows.length > 0 && (
          <Pagination
            totalItems={rows.length}
            currentPage={page}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
          />
        )}
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
  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => Number(x.id) === id);
    // Component price defaults to the item's retail (selling) price — editable.
    // The GRN cost-batch below only decides which purchase lot the qty comes from.
    setLine(i, { item_id: id, batch_id: '', price: item ? Number(item.retail_price).toFixed(2) : '0' });
    if (id) loadBatches(Number(id));
  };
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const unitsN = Math.max(1, Number(units) || 1);
  // A line with cost-batches must have one selected (same rule as invoices).
  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0 && (batchesFor(l).length === 0 || l.batch_id !== ''));
  // Actual price is the component total for ONE unit of the product.
  const actual = validLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const sellingN = Number(selling) || 0;
  const shortages = validLines.filter((l) => {
    const it = itemFor(l);
    if (!it) return false;
    const batch = batchFor(l);
    const have = batch ? Number(batch.qty_remaining) : Number(it.stock);
    return Number(l.qty) * unitsN > have;
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

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Component items (per one unit)</div>
      <div className="card p-2.5 mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)', width: '44%' }}>Item</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 70 }}>Qty</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Price</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)' }}>Amount</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = itemFor(l);
              const used = lines.filter((_, idx) => idx !== i).map((x) => x.item_id);
              const need = (Number(l.qty) || 0) * unitsN;
              const batch = batchFor(l);
              const have = batch ? Number(batch.qty_remaining) : Number(it?.stock ?? 0);
              const short = it ? need > have : false;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <Select value={l.item_id === '' ? '' : String(l.item_id)} onChange={(e) => pickItem(i, e.target.value ? Number(e.target.value) : '')} style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select item…</option>
                      {items.map((x) => (
                        <option key={x.id} value={String(Number(x.id))} disabled={Number(x.stock) <= 0 || used.includes(Number(x.id))}>
                          {x.code} · {x.name}{Number(x.stock) <= 0 ? ' (out)' : ''}
                        </option>
                      ))}
                    </Select>
                    {batchesFor(l).length > 0 && (
                      <Select value={l.batch_id === '' ? '' : String(l.batch_id)} onChange={(e) => setLine(i, { batch_id: e.target.value ? Number(e.target.value) : '' })} style={{ height: 32, fontSize: 12, marginTop: 6 }}>
                        <option value="">Select cost-batch…</option>
                        {batchesFor(l).map((b) => <option key={b.id} value={String(Number(b.id))}>GRN cost Rs {fmt(Number(b.unit_cost))} · {b.qty_remaining} left</option>)}
                      </Select>
                    )}
                    {it && (
                      <div className="text-[12px] mt-1" style={{ color: short ? 'var(--red)' : 'var(--text-muted)' }}>
                        Stock: {fmt0(Number(it.stock))} · RP Rs {fmt(Number(it.retail_price))}
                        {batch ? ` · batch ${fmt0(Number(batch.qty_remaining))} left` : ''}
                        {short ? ` — need ${fmt0(need)} for ${fmt0(unitsN)} units` : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 36 }} /></td>
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
function AssembleModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [units, setUnits] = useState('1');
  const [batchesByItem, setBatchesByItem] = useState<Record<number, ItemBatch[]>>({});
  const [batchChoice, setBatchChoice] = useState<Record<number, number | ''>>({});
  const [busy, setBusy] = useState(false);

  const comps = product.components ?? [];

  // Load each component's GRN cost-batches so the run deducts the right lot.
  useEffect(() => {
    comps.forEach((c) => {
      void http.get(`/api/items/${Number(c.item_id)}/batches`).then((r) =>
        setBatchesByItem((m) => ({ ...m, [Number(c.item_id)]: r.data.data })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchesOf = (c: ProductComponent) => batchesByItem[Number(c.item_id)] ?? [];
  const chosenBatch = (c: ProductComponent) =>
    batchesOf(c).find((b) => Number(b.id) === batchChoice[Number(c.item_id)]);
  const haveFor = (c: ProductComponent) => {
    const b = chosenBatch(c);
    return b ? Number(b.qty_remaining) : Number(c.item?.stock ?? 0);
  };

  const unitsN = Math.max(1, Number(units) || 1);
  // Most units the current component (or chosen batch) stock can build.
  const maxUnits = comps.length
    ? Math.min(...comps.map((c) => Math.floor(haveFor(c) / Math.max(1, Number(c.qty)))))
    : 0;
  const batchesPicked = comps.every((c) => batchesOf(c).length === 0 || batchChoice[Number(c.item_id)]);
  const canSave = unitsN >= 1 && unitsN <= maxUnits && batchesPicked && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await http.post(`/api/products/${product.id}/assemble`, {
        units: unitsN,
        lines: comps.map((c) => ({ item_id: Number(c.item_id), batch_id: batchChoice[Number(c.item_id)] || null })),
      });
      toast(`Assembled ${fmt0(unitsN)} × ${product.item?.name ?? 'product'}`);
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={`Assemble — ${product.item?.name ?? ''}`}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!canSave} onClick={save}>Assemble</Button></>}
    >
      <div className="card overflow-hidden mb-4">
        <table className="tbl">
          <thead><tr><th>Component</th><th className="num">Per unit</th><th className="num">Needed</th><th className="num">Available</th></tr></thead>
          <tbody>
            {comps.map((c) => {
              const need = Number(c.qty) * unitsN;
              const have = haveFor(c);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold">{c.name}</div>
                    {batchesOf(c).length > 0 && (
                      <Select
                        value={batchChoice[Number(c.item_id)] ? String(batchChoice[Number(c.item_id)]) : ''}
                        onChange={(e) => setBatchChoice((m) => ({ ...m, [Number(c.item_id)]: e.target.value ? Number(e.target.value) : '' }))}
                        style={{ height: 32, fontSize: 12, marginTop: 6, maxWidth: 260 }}
                      >
                        <option value="">Select cost-batch…</option>
                        {batchesOf(c).map((b) => <option key={b.id} value={String(Number(b.id))}>GRN cost Rs {fmt(Number(b.unit_cost))} · {b.qty_remaining} left</option>)}
                      </Select>
                    )}
                  </td>
                  <td className="num mono">{fmt0(Number(c.qty))}</td>
                  <td className="num mono" style={{ color: need > have ? 'var(--red)' : undefined }}>{fmt0(need)}</td>
                  <td className="num mono">{fmt0(have)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Field label="Units to assemble" req hint={maxUnits > 0 ? `Stock allows up to ${fmt0(maxUnits)} unit${maxUnits === 1 ? '' : 's'}.` : 'Not enough component stock to assemble any units.'}>
        <Input className="mono text-right" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ''))} />
      </Field>
    </Modal>
  );
}
