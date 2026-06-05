import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Box } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0 } from '@/lib/format';
import { toast } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, stockBadge } from '@/components/ui/Badge';
import { SearchBar, Empty } from '@/components/ui/Common';
import { Modal, Confirm } from '@/components/ui/Modal';
import { Field, Input, Select, MoneyInput } from '@/components/ui/Field';
import type { Category, Item } from '@/types';

interface ItemForm {
  code: string; name: string; category_id: number | '';
  distributor_price: string; wholesale_price: string; retail_price: string; stock: string;
}

const blankForm = (): ItemForm => ({ code: '', name: '', category_id: '', distributor_price: '', wholesale_price: '', retail_price: '', stock: '' });

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<'All' | number>('All');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

  const load = () => http.get('/api/items', { params: { q, category_id: catFilter === 'All' ? undefined : catFilter } }).then((r) => setItems(r.data.data));

  useEffect(() => { void http.get('/api/categories').then((r) => setCats(r.data.data)); }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, catFilter]);

  const filtered = items;
  const total = items.length;

  return (
    <div className="fade-in">
      <PageHead
        title="Item Master"
        sub={`${total} products · manage codes, categories and pricing tiers.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Item</Button>}
      />

      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search by name or code…" />
        <Select value={catFilter === 'All' ? 'All' : String(catFilter)} onChange={(e) => setCatFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ width: 200, height: 40 }}>
          <option value="All">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="ml-auto chip"><Box size={14} />{filtered.length} shown</div>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th><th>Product</th><th>Category</th>
              <th className="num">Distributor</th><th className="num">Wholesale</th><th className="num">Retail</th>
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
                  <td className="num money">{fmt(it.distributor_price as number)}</td>
                  <td className="num money">{fmt(it.wholesale_price as number)}</td>
                  <td className="num money font-bold">{fmt(it.retail_price as number)}</td>
                  <td className="num"><Badge kind={sb.kind}>{fmt0(it.stock)}</Badge></td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(it)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleting(it)} />
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
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
      {deleting && (
        <Confirm
          title="Delete item?" danger confirmLabel="Delete"
          message={<>Remove <strong>{deleting.name}</strong> ({deleting.code}) from the item master? This cannot be undone.</>}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try { await http.delete(`/api/items/${deleting.id}`); toast('Item deleted'); void load(); }
            catch (e) { toast(apiErrorMessage(e), 'err'); }
          }}
        />
      )}
    </div>
  );
}

function ItemModal({
  item, categories, existingCodes, onClose, onSaved,
}: { item: Item | null; categories: Category[]; existingCodes: string[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !item;
  const [f, setF] = useState<ItemForm>(() => item
    ? {
        code: item.code, name: item.name, category_id: item.category_id,
        distributor_price: String(item.distributor_price),
        wholesale_price: String(item.wholesale_price),
        retail_price: String(item.retail_price),
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
      const payload = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        category_id: f.category_id,
        distributor_price: Number(f.distributor_price) || 0,
        wholesale_price: Number(f.wholesale_price) || 0,
        retail_price: Number(f.retail_price) || 0,
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
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
        </Field>
        <Field label="Category" full>
          <Select value={String(f.category_id)} onChange={(e) => setF({ ...f, category_id: Number(e.target.value) })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Distributor Price (LKR)"><MoneyInput value={f.distributor_price} onChange={(v) => setF({ ...f, distributor_price: v })} /></Field>
        <Field label="Wholesale Price (LKR)"><MoneyInput value={f.wholesale_price} onChange={(v) => setF({ ...f, wholesale_price: v })} /></Field>
        <Field label="Retail Price (LKR)"><MoneyInput value={f.retail_price} onChange={(v) => setF({ ...f, retail_price: v })} /></Field>
        <Field label="Stock Count">
          <Input className="mono" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value.replace(/\D/g, '') })} placeholder="0" />
        </Field>
      </div>
    </Modal>
  );
}
