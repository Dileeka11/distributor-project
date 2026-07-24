import { useEffect, useMemo, useState } from 'react';
import { Warehouse, Package, Layers, Eye, AlertCircle, FolderOpen } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, SearchBar, Stat } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ItemPickerModal } from '@/components/ItemPickerModal';
import type { Category, Item } from '@/types';

interface Lot {
  batch_id: number | null;
  grn_id: number;
  grn_no: string | null;
  grn_date: string | null;
  unit_cost: number | null;
  price: number;
  qty: number;
}

interface LotsResponse {
  item: { id: number; code: string; name: string; stock: number };
  lots: Lot[];
}

export default function LiveStockPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [catFilter, setCatFilter] = useState<'All' | number>('All');
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickItemId, setQuickItemId] = useState<number | ''>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  
  // Drill-down lot view
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [lotData, setLotData] = useState<LotsResponse | null>(null);
  const [loadingLots, setLoadingLots] = useState(false);

  // Load categories
  useEffect(() => {
    void http.get('/api/categories')
      .then((r) => setCats(r.data.data))
      .catch((e) => toast(apiErrorMessage(e), 'err'));
  }, []);

  // Load items based on category filter
  useEffect(() => {
    const params = catFilter === 'All' ? undefined : { category_id: catFilter };
    void http.get('/api/items', { params })
      .then((r) => {
        setItems(r.data.data);
        setQuickItemId('');
      })
      .catch((e) => toast(apiErrorMessage(e), 'err'));
  }, [catFilter]);

  // Load lot details for active item
  useEffect(() => {
    if (activeItemId) {
      setLoadingLots(true);
      http.get(`/api/stock-adjustments/lots/${activeItemId}`)
        .then((r) => setLotData(r.data))
        .catch((e) => toast(apiErrorMessage(e), 'err'))
        .finally(() => setLoadingLots(false));
    } else {
      setLotData(null);
    }
  }, [activeItemId]);

  // Handle quick item search-select
  useEffect(() => {
    if (quickItemId !== '') {
      setActiveItemId(Number(quickItemId));
    }
  }, [quickItemId]);

  // Filter items in the list based on query
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Calculate totals
  const totalItemCount = filteredItems.length;
  const totalStockQuantity = filteredItems.reduce((acc, item) => acc + (Number(item.stock) || 0), 0);
  const outOfStockCount = filteredItems.filter((item) => (Number(item.stock) || 0) <= 0).length;

  return (
    <div className="fade-in">
      <PageHead
        title="Live Stock"
        sub="Real-time stock levels with lot and cost-batch breakdowns."
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat
          label="Unique Items"
          value={fmt0(totalItemCount)}
          icon={<Package size={18} />}
          tint="blue"
          foot="matching current filters"
        />
        <Stat
          label="Total Quantity on Hand"
          value={fmt0(totalStockQuantity)}
          icon={<Warehouse size={18} />}
          tint="green"
          foot="aggregated stock count"
        />
        <Stat
          label="Out of Stock Items"
          value={fmt0(outOfStockCount)}
          icon={<AlertCircle size={18} />}
          tint="red"
          foot="items requiring replenishment"
        />
      </div>

      <div className="flex gap-2.5 mb-4 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Category</span>
          <Select
            value={catFilter === 'All' ? 'All' : String(catFilter)}
            onChange={(e) => setCatFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))}
            style={{ width: 210, height: 40 }}
          >
            <option value="All">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Quick Find (dropdown)</span>
          <div className="flex gap-2">
            <SearchSelect
              items={items}
              value={quickItemId}
              onChange={setQuickItemId}
              allLabel="Search & select item…"
              placeholder="Type code or name…"
              width={300}
              subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock))}`}
            />
            <Button
              variant="subtle"
              icon={<FolderOpen size={15} />}
              onClick={() => setPickerOpen(true)}
              style={{ height: 40 }}
            >
              Browse Items
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Filter list</span>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Type item name or code to filter the list below…"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Name</th>
              <th>Category</th>
              <th className="num">Stock Level</th>
              <th className="num">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const stock = Number(item.stock) || 0;
              const badgeKind = stock > 20 ? 'green' : stock > 0 ? 'amber' : 'red';
              return (
                <tr
                  key={item.id}
                  className="row-click"
                  onClick={() => setActiveItemId(item.id)}
                >
                  <td className="mono font-semibold">{item.code}</td>
                  <td className="font-semibold">{item.name}</td>
                  <td className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {item.category?.name ?? '—'}
                  </td>
                  <td className="num">
                    <Badge kind={badgeKind} dot>
                      {fmt0(stock)} on hand
                    </Badge>
                  </td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={<Eye size={14} />}
                      onClick={() => setActiveItemId(item.id)}
                    >
                      View Lots
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <Empty
            icon={<Warehouse size={40} />}
            title="No items found"
            sub="No inventory records match the selected category or search filters."
          />
        )}
      </div>

      {activeItemId && (
        <Modal
          title={
            lotData
              ? `Stock Lots Breakdown — ${lotData.item.name}`
              : 'Loading Lots Breakdown…'
          }
          onClose={() => {
            setActiveItemId(null);
            setQuickItemId('');
          }}
          xl
          footer={
            <Button
              variant="primary"
              onClick={() => {
                setActiveItemId(null);
                setQuickItemId('');
              }}
            >
              Close
            </Button>
          }
        >
          {loadingLots && (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Fetching batch records and calculating lot quantities…
            </div>
          )}

          {!loadingLots && lotData && (
            <div>
              <div className="flex justify-between items-center mb-5 gap-4 flex-wrap">
                <div className="flex gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Code</div>
                    <div className="mono font-bold text-[14px]">{lotData.item.code}</div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Total Stock</div>
                    <div className="mono font-extrabold text-[15px]" style={{ color: lotData.item.stock > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt0(lotData.item.stock)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Source Lot</th>
                      <th>Received Date</th>
                      <th className="num">Unit Cost / Price</th>
                      <th className="num">Quantity remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotData.lots.map((l, index) => {
                      const isOpening = l.grn_id === 0;
                      return (
                        <tr key={index}>
                          <td>
                            {isOpening ? (
                              <Badge kind="gray">Opening Stock</Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Layers size={14} style={{ color: 'var(--blue)' }} />
                                <span className="mono font-semibold">{l.grn_no ?? `GRN #${l.grn_id}`}</span>
                              </div>
                            )}
                          </td>
                          <td className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {l.grn_date ? prettyDate(l.grn_date) : '—'}
                          </td>
                          <td className="num money">
                            {l.unit_cost != null
                              ? `cost Rs ${fmt(l.unit_cost)}`
                              : `price Rs ${fmt(l.price)}`}
                          </td>
                          <td className="num">
                            <Badge kind={l.qty > 0 ? 'green' : 'red'}>
                              {fmt0(l.qty)} units
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {lotData.lots.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          No batches or opening stock recorded for this item.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}

      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setActiveItemId}
      />
    </div>
  );
}
