import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Box, Layers, ChevronDown, Search } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, stockBadge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, MoneyInput } from '@/components/ui/Field';
import { SearchBar } from '@/components/ui/Common';
import type { Category, Item } from '@/types';

// One row of the per-lot stock ledger (item + GRN).
interface StockRow {
  item_id: number; item_code: string; item_name: string; item_total: number;
  grn_id: number; grn_no: string | null; grn_date: string | null;
  qty: number; unit_cost: string | number | null;
}

interface ItemForm {
  code: string; name: string; category_id: number | '';
  price: string; stock: string;
}

const blankForm = (): ItemForm => ({ code: '', name: '', category_id: '', price: '', stock: '' });

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [catFilter, setCatFilter] = useState<'All' | number>('All');
  const [itemId, setItemId] = useState<number | ''>('');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [ledger, setLedger] = useState(false);

  const load = () => http.get('/api/items', { params: { category_id: catFilter === 'All' ? undefined : catFilter } }).then((r) => setItems(r.data.data));
  const loadCats = () => http.get('/api/categories').then((r) => setCats(r.data.data));

  useEffect(() => { void loadCats(); }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catFilter]);

  // Category dropdown narrows the list; the product dropdown then picks one.
  const filtered = itemId === '' ? items : items.filter((i) => Number(i.id) === itemId);
  const total = items.length;

  return (
    <div className="fade-in">
      <PageHead
        title="Item Master"
        sub={`${total} products · manage codes, categories and pricing tiers.`}
        actions={
          <>
            <Button variant="subtle" icon={<Layers size={16} />} onClick={() => setLedger(true)}>Stock ledger</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Item</Button>
          </>
        }
      />

      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Select value={catFilter === 'All' ? 'All' : String(catFilter)} onChange={(e) => { setCatFilter(e.target.value === 'All' ? 'All' : Number(e.target.value)); setItemId(''); }} style={{ width: 200, height: 40 }}>
          <option value="All">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <ItemPicker items={items} value={itemId} onChange={setItemId} />
        <div className="ml-auto chip"><Box size={14} />{filtered.length} shown</div>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th><th>Product</th><th>Category</th>
              <th className="num">Price</th>
              <th className="num">Stock</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const sb = stockBadge(it.stock);
              return (
                <tr key={it.id}>
                  <td className="mono font-semibold">{it.code}</td>
                  <td className="font-semibold">{it.name}</td>
                  <td><span className="chip" style={{ height: 24 }}>{it.category?.name ?? '—'}</span></td>
                  <td className="num money font-bold">{fmt(it.retail_price as number)}</td>
                  <td className="num"><Badge kind={sb.kind}>{fmt0(it.stock)}</Badge></td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(it)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                        if (!(await confirmDelete({ title: 'Delete item?', html: `Remove <b>${it.name}</b> (${it.code}) from the item master? This cannot be undone.` }))) return;
                        try { await http.delete(`/api/items/${it.id}`); toast('Item deleted'); void load(); }
                        catch (e) { toast(apiErrorMessage(e), 'err'); }
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty icon={<Box size={40} />} title="No items found" sub="Try a different search or add a new item." />}
      </div>

      {editing && (
        <ItemModal
          item={editing === 'new' ? null : editing}
          categories={cats}
          existingCodes={items.map((i) => i.code.toLowerCase())}
          onCategoriesChanged={loadCats}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}

      {ledger && <StockLedgerModal onClose={() => setLedger(false)} />}
    </div>
  );
}

// Per-lot stock ledger: every item's stock broken down by the GRN it came from
// (plus an "Opening" row), which moves as GRNs are received and invoices sell.
function StockLedgerModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { void http.get('/api/stocks').then((r) => setRows(r.data.data)).finally(() => setLoaded(true)); }, []);

  const ql = q.trim().toLowerCase();
  const shown = ql ? rows.filter((r) => r.item_name.toLowerCase().includes(ql) || r.item_code.toLowerCase().includes(ql)) : rows;

  // Group the flat rows by item, preserving order.
  const groups: { code: string; name: string; total: number; lots: StockRow[] }[] = [];
  const byItem = new Map<number, number>();
  for (const r of shown) {
    let gi = byItem.get(r.item_id);
    if (gi === undefined) { gi = groups.length; byItem.set(r.item_id, gi); groups.push({ code: r.item_code, name: r.item_name, total: Number(r.item_total), lots: [] }); }
    groups[gi].lots.push(r);
  }
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  return (
    <Modal
      lg
      title={<span className="flex items-center gap-2.5"><Layers size={20} style={{ color: 'var(--blue)' }} /> Stock ledger — by GRN lot</span>}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[13px]" style={{ color: 'var(--text-muted)' }}>{groups.length} items · <b className="mono">{fmt0(grandTotal)}</b> units in stock</span>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="mb-3"><SearchBar value={q} onChange={setQ} placeholder="Search item name or code…" /></div>
      <div className="card overflow-hidden">
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Item</th><th>Source</th><th>Date</th><th className="num">Unit cost</th><th className="num">Qty</th></tr></thead>
            <tbody>
              {groups.map((g) => g.lots.map((l, i) => (
                <tr key={`${g.code}-${l.grn_id}`}>
                  <td>
                    {i === 0
                      ? <div><div className="mono font-semibold">{g.code}</div><div className="text-[12px] font-medium">{g.name}</div></div>
                      : <span style={{ color: 'var(--text-faint)' }}>↳</span>}
                  </td>
                  <td>{l.grn_id === 0
                    ? <Badge kind="gray">Opening</Badge>
                    : <span className="mono font-semibold">{l.grn_no ?? `GRN #${l.grn_id}`}</span>}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{l.grn_date ? prettyDate(l.grn_date) : '—'}</td>
                  <td className="num money" style={{ color: 'var(--text-muted)' }}>{l.unit_cost != null ? fmt(Number(l.unit_cost)) : '—'}</td>
                  <td className="num"><Badge kind={Number(l.qty) > 0 ? 'green' : 'red'}>{fmt0(Number(l.qty))}</Badge></td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        {loaded && groups.length === 0 && <div className="text-center py-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>No stock records.</div>}
      </div>
    </Modal>
  );
}

// Searchable product selector — pick by name or code, or "All products".
function ItemPicker({ items, value, onChange }: {
  items: Item[]; value: number | ''; onChange: (v: number | '') => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = items.find((i) => Number(i.id) === value);
  const ql = q.trim().toLowerCase();
  const list = ql ? items.filter((i) => i.name.toLowerCase().includes(ql) || i.code.toLowerCase().includes(ql)) : items;
  const pick = (v: number | '') => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative" style={{ width: 280 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center justify-between text-left w-full" style={{ height: 40, backgroundImage: 'none', paddingRight: 12 }}>
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>{selected ? selected.name : 'All products'}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)' }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input autoFocus className="input" style={{ height: 34, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code…" />
            </div>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }} className="py-1">
            <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2" style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}>All products</button>
            {list.map((i) => (
              <button key={i.id} type="button" onClick={() => pick(Number(i.id))} className="w-full text-left px-3 py-2 hover:bg-surface-2" style={{ background: Number(i.id) === value ? 'var(--surface-2)' : undefined }}>
                <div className="text-[13px] font-medium">{i.name}</div>
                <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{i.code}{i.category?.name ? ` · ${i.category.name}` : ''}</div>
              </button>
            ))}
            {list.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemModal({
  item, categories, existingCodes, onCategoriesChanged, onClose, onSaved,
}: { item: Item | null; categories: Category[]; existingCodes: string[]; onCategoriesChanged: () => void | Promise<void>; onClose: () => void; onSaved: () => void }) {
  const isNew = !item;
  const [mgrOpen, setMgrOpen] = useState(false);
  const [f, setF] = useState<ItemForm>(() => item
    ? {
        code: item.code, name: item.name, category_id: item.category_id,
        price: String(item.retail_price),
        stock: String(item.stock),
      }
    : { ...blankForm(), category_id: categories[0]?.id ?? '' });
  const [busy, setBusy] = useState(false);

  const dup = useMemo(
    () => isNew && existingCodes.includes(f.code.trim().toLowerCase()),
    [isNew, existingCodes, f.code],
  );
  const valid = f.code.trim() && f.name.trim() && f.category_id !== '' && !dup;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const price = Number(f.price) || 0;
      const payload = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        category_id: f.category_id,
        distributor_price: price,
        wholesale_price: price,
        retail_price: price,
        stock: Number(f.stock) || 0,
      };
      if (isNew) await http.post('/api/items', payload);
      else await http.put(`/api/items/${item!.id}`, payload);
      toast(isNew ? 'Item created' : 'Item updated');
      onSaved();
    } catch (e) {
      toast(apiErrorMessage(e), 'err');
    } finally { setBusy(false); }
  };

  return (
    <>
    <Modal
      title={isNew ? 'Add Item' : 'Edit Item'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req hint={dup ? '⚠ This code already exists.' : 'Enter your own item code.'}>
          <Input value={f.code} disabled={!isNew} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. AA0012" className={`mono${dup ? '' : ''}`} style={dup ? { borderColor: 'var(--red)' } : undefined} />
        </Field>
        <Field label="Name" req>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Item name" />
        </Field>
        <Field label="Category" full hint="Use + to add, edit or remove categories.">
          <div className="flex gap-2">
            <Select className="flex-1" value={String(f.category_id)} onChange={(e) => setF({ ...f, category_id: Number(e.target.value) })}>
              {categories.length === 0 && <option value="">No categories — click + to add</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button variant="subtle" icon={<Plus size={16} />} onClick={() => setMgrOpen(true)} aria-label="Manage categories" title="Manage categories" />
          </div>
        </Field>
        <Field label="Item Price (LKR)"><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></Field>
        <Field label="Stock Count">
          <Input className="mono" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value.replace(/\D/g, '') })} placeholder="0" />
        </Field>
      </div>
    </Modal>
    {mgrOpen && (
      <CategoryManager
        categories={categories}
        selectedId={f.category_id}
        onSelect={(id) => setF((cur) => ({ ...cur, category_id: id }))}
        onChanged={onCategoriesChanged}
        onClose={() => setMgrOpen(false)}
      />
    )}
    </>
  );
}

function CategoryManager({
  categories, selectedId, onSelect, onChanged, onClose,
}: {
  categories: Category[];
  selectedId: number | '';
  onSelect: (id: number | '') => void;
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const r = await http.post('/api/categories', { name });
      setNewName('');
      onSelect(r.data.data.id as number);
      await onChanged();
      toast('Category added');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await http.put(`/api/categories/${id}`, { name });
      setEditId(null);
      await onChanged();
      toast('Category updated');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await http.delete(`/api/categories/${id}`);
      setConfirmId(null);
      if (selectedId === id) onSelect(categories.find((c) => c.id !== id)?.id ?? '');
      await onChanged();
      toast('Category deleted');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Manage Categories" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="flex gap-2 mb-4">
        <Input
          className="flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          placeholder="New category name"
        />
        <Button variant="primary" icon={<Plus size={16} />} disabled={!newName.trim() || busy} onClick={() => void add()}>Add</Button>
      </div>

      <div className="flex flex-col">
        {categories.length === 0 && (
          <div className="text-[13px] py-2" style={{ color: 'var(--text-faint)' }}>No categories yet. Add one above.</div>
        )}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
            {editId === c.id ? (
              <>
                <Input
                  className="flex-1"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveEdit(c.id); }
                    if (e.key === 'Escape') setEditId(null);
                  }}
                />
                <Button variant="primary" size="sm" disabled={!editName.trim() || busy} onClick={() => void saveEdit(c.id)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
              </>
            ) : confirmId === c.id ? (
              <>
                <span className="flex-1 text-[13.5px]">Delete <strong>{c.name}</strong>?</span>
                <Button variant="primary" size="sm" style={{ background: 'var(--red)' }} disabled={busy} onClick={() => void remove(c.id)}>Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[14px] font-medium">{c.name}</span>
                <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} aria-label={`Edit ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); setConfirmId(null); }} />
                <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} aria-label={`Delete ${c.name}`} onClick={() => { setConfirmId(c.id); setEditId(null); }} />
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
