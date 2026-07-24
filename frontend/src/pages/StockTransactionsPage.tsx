import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Printer, FolderOpen, Trash2 } from 'lucide-react';
import { http } from '@/lib/http';
import { fmt0, prettyDate } from '@/lib/format';
import { useSettings } from '@/store/settings';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, Stat, Pagination } from '@/components/ui/Common';
import { Select, Input } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ItemPickerModal } from '@/components/ItemPickerModal';
import { toast, confirmDelete } from '@/lib/toast';
import type { Category, Item } from '@/types';

interface TxnRow {
  date: string | null; created_at: string; item_id: number; item_code: string; item_name: string;
  source: string; grn_id: number | null; qty_in: number; qty_out: number; remark: string | null;
  adjustment_id: number | null;
}
interface TxnResp { data: TxnRow[]; totals: { in: number; out: number; net: number }; }

export default function StockTransactionsPage() {
  const { settings } = useSettings();
  const [cats, setCats] = useState<Category[]>([]);
  const [catFilter, setCatFilter] = useState<'All' | number>('All');
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [res, setRes] = useState<TxnResp>({ data: [], totals: { in: 0, out: 0, net: 0 } });
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  useEffect(() => { void http.get('/api/categories').then((r) => setCats(r.data.data)); }, []);
  useEffect(() => {
    void http.get('/api/items', { params: { category_id: catFilter === 'All' ? undefined : catFilter } }).then((r) => setItems(r.data.data));
    setItemId('');
  }, [catFilter]);

  const load = () => {
    setLoaded(false);
    void http.get('/api/stock-transactions', { params: { item_id: itemId || undefined, from: from || undefined, to: to || undefined } })
      .then((r) => setRes(r.data)).finally(() => setLoaded(true));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [itemId, from, to]);

  const deleteAdjustment = async (id: number) => {
    const ok = await confirmDelete({
      title: 'Delete adjustment?',
      html: 'Are you sure you want to delete this manual adjustment? The stock change will be reversed.',
      confirmText: 'Yes, delete it'
    });
    if (!ok) return;

    try {
      await http.delete(`/api/stock-adjustments/${id}`);
      toast('Adjustment deleted and stock reversed successfully');
      load();
    } catch (e: any) {
      toast(e.response?.data?.message || 'Failed to delete adjustment', 'err');
    }
  };

  const rows = res.data;
  const paginated = useMemo(() => {
    return rows.slice((page - 1) * perPage, page * perPage);
  }, [rows, page, perPage]);

  useEffect(() => { setPage(1); }, [catFilter, itemId, from, to, rows.length]);

  const itemName = itemId === '' ? 'All items' : (items.find((i) => Number(i.id) === itemId)?.name ?? '');

  const printReport = () => {
    const w = window.open('', '_blank', 'width=900,height=950');
    if (!w) return;
    const range = from || to ? `${from ? prettyDate(from) : '…'} → ${to ? prettyDate(to) : '…'}` : 'All dates';
    const tr = rows.map((r) => `<tr>
      <td>${r.date ? prettyDate(r.date) : '—'}</td><td class="mono">${r.item_code}</td><td>${r.item_name}</td>
      <td class="mono">${r.source}</td><td class="r">${r.qty_in || ''}</td><td class="r">${r.qty_out || ''}</td><td>${r.remark ?? ''}</td>
    </tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Stock transactions — ${itemName}</title>
      <style>*{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}body{margin:34px;color:#1c1f26}
      h1{font-size:19px;margin:0}.sub{color:#666;font-size:12px;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
      th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#777;padding:7px 6px;border-bottom:2px solid #d8dce2}
      th.r,td.r{text-align:right}td{padding:6px;border-bottom:1px solid #eef0f2}.mono{font-family:Consolas,monospace}
      .tot{margin-top:14px;display:flex;gap:26px;font-size:13px;font-weight:700}</style></head><body>
      <h1>${settings.company || 'Distributor'} — Stock transactions</h1>
      <div class="sub">${itemName} · ${range} · generated ${prettyDate(new Date().toISOString())}</div>
      <table><thead><tr><th>Date</th><th>Item</th><th>Name</th><th>Source</th><th class="r">In</th><th class="r">Out</th><th>Remark</th></tr></thead>
      <tbody>${tr || '<tr><td colspan="7">No transactions.</td></tr>'}</tbody></table>
      <div class="tot"><span>Total in: ${fmt0(res.totals.in)}</span><span>Total out: ${fmt0(res.totals.out)}</span><span>Net: ${fmt0(res.totals.net)}</span></div>
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Stock Transaction Report"
        sub="Every stock movement — opening, GRN receipts, invoice sales and adjustments."
        actions={<Button variant="subtle" icon={<Printer size={16} />} onClick={printReport}>Print / PDF</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat label="Total in" cur="" value={fmt0(res.totals.in)} icon={<ArrowDownToLine size={18} />} tint="green" foot="received + added" />
        <Stat label="Total out" cur="" value={fmt0(res.totals.out)} icon={<ArrowUpFromLine size={18} />} tint="red" foot="sold + reduced" />
        <Stat label="Net (current stock)" cur="" value={fmt0(res.totals.net)} icon={<ArrowLeftRight size={18} />} tint="blue" foot="in − out" />
      </div>

      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <Select value={catFilter === 'All' ? 'All' : String(catFilter)} onChange={(e) => setCatFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ width: 180, height: 40 }}>
          <option value="All">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <SearchSelect items={items} value={itemId} onChange={setItemId} allLabel="All items" placeholder="Search item name or code…" width={260} subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock))}`} />
        <Button variant="subtle" icon={<FolderOpen size={15} />} onClick={() => setPickerOpen(true)} style={{ height: 40 }}>Browse Items</Button>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>From</span>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ height: 40, width: 160 }} />
          <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>To</span>
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ height: 40, width: 160 }} />
          {(from || to) && <Button variant="subtle" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div style={{ maxHeight: 460, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Item</th><th>Source</th><th className="num">In</th><th className="num">Out</th><th>Remark</th><th style={{ width: 60 }}></th></tr></thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={i}>
                  <td className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.date ? prettyDate(r.date) : '—'}</td>
                  <td><div className="mono font-semibold text-[12.5px]">{r.item_code}</div><div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{r.item_name}</div></td>
                  <td className="mono text-[12.5px] font-medium">{r.source}</td>
                  <td className="num">{r.qty_in ? <Badge kind="green">+{fmt0(r.qty_in)}</Badge> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td className="num">{r.qty_out ? <Badge kind="red">−{fmt0(r.qty_out)}</Badge> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>{r.remark ?? '—'}</td>
                  <td className="text-right p-1.5">
                    {r.adjustment_id !== null && (
                      <button
                        className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2 ml-auto"
                        onClick={() => deleteAdjustment(r.adjustment_id!)}
                        title="Delete adjustment"
                        type="button"
                        style={{ color: 'var(--red)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <Empty icon={<ArrowLeftRight size={40} />} title="No stock transactions" sub="Try a different item or date range." />}
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

      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setItemId}
      />
    </div>
  );
}
