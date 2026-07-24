import { useEffect, useState } from 'react';
import { SlidersHorizontal, Plus, Minus, Package, Layers, FolderOpen } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Common';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ItemPickerModal } from '@/components/ItemPickerModal';
import type { Category, Item } from '@/types';

// One stock lot of an item: opening (batch_id null) or a GRN cost-batch.
interface Lot {
  batch_id: number | null; grn_id: number; grn_no: string | null; grn_date: string | null;
  unit_cost: number | null; price: number; qty: number;
}
interface LotsResponse { item: { id: number; code: string; name: string; stock: number }; lots: Lot[]; }

export default function StockAdjustPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [catFilter, setCatFilter] = useState<'All' | number>('All');
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState<number | ''>('');
  const [data, setData] = useState<LotsResponse | null>(null);
  const [adjust, setAdjust] = useState<Lot | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { void http.get('/api/categories').then((r) => setCats(r.data.data)); }, []);
  useEffect(() => {
    void http.get('/api/items', { params: { category_id: catFilter === 'All' ? undefined : catFilter } }).then((r) => setItems(r.data.data));
    setItemId(''); setData(null);
  }, [catFilter]);

  const loadLots = (id: number) => http.get(`/api/stock-adjustments/lots/${id}`).then((r) => setData(r.data));
  useEffect(() => { if (itemId !== '') void loadLots(Number(itemId)); else setData(null); }, [itemId]);

  return (
    <div className="fade-in">
      <PageHead
        title="Stock Adjustment"
        sub="Add or reduce stock for a specific batch — changes update the stock ledger live."
      />

      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <Select value={catFilter === 'All' ? 'All' : String(catFilter)} onChange={(e) => setCatFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ width: 210, height: 40 }}>
          <option value="All">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <SearchSelect items={items} value={itemId} onChange={setItemId} allLabel="Select item…" placeholder="Search item name or code…" width={300} subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock))}`} />
        <Button variant="subtle" icon={<FolderOpen size={15} />} onClick={() => setPickerOpen(true)} style={{ height: 40 }}>Browse Items</Button>
        {data && (
          <div className="ml-auto flex items-center gap-2.5 px-4 rounded-full border border-border" style={{ height: 40, background: 'var(--surface)' }}>
            <Package size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Total stock</span>
            <span className="mono text-[16px] font-extrabold">{fmt0(data.item.stock)}</span>
          </div>
        )}
      </div>

      {!data ? (
        <div className="card"><Empty icon={<SlidersHorizontal size={40} />} title="Pick an item" sub="Choose a category and item to see its batches and adjust stock." /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Source lot</th><th>Date</th><th className="num">Unit cost / price</th><th className="num">Qty in lot</th><th></th></tr></thead>
            <tbody>
              {data.lots.map((l) => (
                <tr key={l.batch_id ?? 'opening'}>
                  <td>
                    {l.grn_id === 0
                      ? <span className="flex items-center gap-2"><Badge kind="gray">Opening</Badge></span>
                      : <span className="flex items-center gap-2"><Layers size={15} style={{ color: 'var(--blue)' }} /><span className="mono font-semibold">{l.grn_no ?? `GRN #${l.grn_id}`}</span></span>}
                  </td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{l.grn_date ? prettyDate(l.grn_date) : '—'}</td>
                  <td className="num money">{l.unit_cost != null ? `cost ${fmt(l.unit_cost)}` : `price ${fmt(l.price)}`}</td>
                  <td className="num"><Badge kind={l.qty > 0 ? 'green' : 'red'}>{fmt0(l.qty)}</Badge></td>
                  <td className="num">
                    <Button variant="subtle" size="sm" icon={<SlidersHorizontal size={14} />} onClick={() => setAdjust(l)}>Adjust</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjust && data && (
        <AdjustModal
          item={data.item}
          lot={adjust}
          onClose={() => setAdjust(null)}
          onSaved={() => { setAdjust(null); void loadLots(data.item.id); void http.get('/api/items', { params: { category_id: catFilter === 'All' ? undefined : catFilter } }).then((r) => setItems(r.data.data)); }}
        />
      )}

      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setItemId}
      />
    </div>
  );
}

function AdjustModal({ item, lot, onClose, onSaved }: {
  item: { id: number; code: string; name: string }; lot: Lot; onClose: () => void; onSaved: () => void;
}) {
  const [type, setType] = useState<'add' | 'reduce'>('add');
  const [qty, setQty] = useState('1');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const n = Number(qty) || 0;
  const tooMany = type === 'reduce' && n > lot.qty;
  const valid = n > 0 && !tooMany && !busy;
  const lotName = lot.grn_id === 0 ? 'Opening stock' : (lot.grn_no ?? `GRN #${lot.grn_id}`);
  const after = type === 'add' ? lot.qty + n : lot.qty - n;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await http.post('/api/stock-adjustments', {
        item_id: item.id, batch_id: lot.batch_id, qty: n, type, remark: remark.trim() || null,
      });
      toast(`Stock ${type === 'add' ? 'added' : 'reduced'} · ${item.code}`);
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={`Adjust stock — ${item.name}`}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>{type === 'add' ? 'Add stock' : 'Reduce stock'}</Button></>}
    >
      <div className="rounded-[10px] p-3.5 mb-4 flex items-center justify-between" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Lot</div>
          <div className="font-semibold flex items-center gap-2">{lot.grn_id === 0 ? <Badge kind="gray">Opening</Badge> : <span className="mono">{lotName}</span>}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Current qty</div>
          <div className="mono text-[18px] font-extrabold">{fmt0(lot.qty)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Adjustment" full>
          <Segmented value={type} onChange={(v) => setType(v as 'add' | 'reduce')} options={[{ value: 'add', label: '➕ Add' }, { value: 'reduce', label: '➖ Reduce' }]} />
        </Field>
        <Field label="Quantity" req hint={tooMany ? `Only ${fmt0(lot.qty)} in this lot.` : `Lot will become ${fmt0(Math.max(after, 0))}.`}>
          <div className="flex items-center gap-2">
            <button type="button" className="grid place-items-center w-9 h-9 rounded-md border border-border hover:bg-surface-2" onClick={() => setQty(String(Math.max(1, n - 1)))}><Minus size={15} /></button>
            <Input className="mono text-center" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} style={{ borderColor: tooMany ? 'var(--red)' : undefined }} />
            <button type="button" className="grid place-items-center w-9 h-9 rounded-md border border-border hover:bg-surface-2" onClick={() => setQty(String(n + 1))}><Plus size={15} /></button>
          </div>
        </Field>
        <Field label="Remark" full hint="Reason for the adjustment (optional).">
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. damaged units, stock-take correction…" />
        </Field>
      </div>
    </Modal>
  );
}
