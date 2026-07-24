import { useEffect, useMemo, useState } from 'react';
import { Search, Folder, Package, X } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { toast } from '@/lib/toast';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { Category, Item } from '@/types';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (itemId: number) => void;
}

export function ItemPickerModal({ isOpen, onClose, onSelect }: ItemPickerModalProps) {
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCatId, setActiveCatId] = useState<'All' | number>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Load categories and all items
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        http.get('/api/categories'),
        http.get('/api/items')
      ])
        .then(([resCats, resItems]) => {
          setCats(resCats.data.data);
          setItems(resItems.data.data);
        })
        .catch((e) => toast(apiErrorMessage(e), 'err'))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Reset filters when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setActiveCatId('All');
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter items locally by category and search query
  const filteredItems = useMemo(() => {
    let result = items;
    
    // Category filter
    if (activeCatId !== 'All') {
      result = result.filter((item) => Number(item.category_id) === activeCatId);
    }
    
    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [items, activeCatId, searchQuery]);

  if (!isOpen) return null;

  return (
    <Modal
      title="Select Item (Category Browser)"
      onClose={onClose}
      xl
      footer={
        <button
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-surface-3 hover:bg-surface-4 transition"
          onClick={onClose}
        >
          Cancel
        </button>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading categories and items list…
        </div>
      ) : (
        <div className="flex gap-4 h-[480px]">
          {/* Left Categories Sidebar */}
          <div className="w-[200px] flex-shrink-0 flex flex-col gap-1 overflow-y-auto pr-2 border-r border-border">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--text-faint)' }}>
              Categories
            </div>
            <button
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition font-medium flex items-center gap-2 ${
                activeCatId === 'All'
                  ? 'text-white'
                  : 'hover:bg-surface-2'
              }`}
              style={activeCatId === 'All' ? { background: 'var(--accent)' } : undefined}
              onClick={() => setActiveCatId('All')}
            >
              <Folder size={14} />
              <span>All Categories</span>
              <span className="ml-auto text-[11px] opacity-70">({items.length})</span>
            </button>
            
            {cats.map((c) => {
              const count = items.filter((i) => Number(i.category_id) === c.id).length;
              const isActive = activeCatId === c.id;
              return (
                <button
                  key={c.id}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition font-medium flex items-center gap-2 ${
                    isActive ? 'text-white' : 'hover:bg-surface-2'
                  }`}
                  style={isActive ? { background: 'var(--accent)' } : undefined}
                  onClick={() => setActiveCatId(c.id)}
                >
                  <Folder size={14} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto text-[11px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Right Items Grid */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--text-faint)' }} />
              <input
                type="text"
                placeholder="Search item by name or code…"
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-accent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-3 hover:text-accent transition"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Items Grid Container */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <div className="grid grid-cols-2 gap-2">
                {filteredItems.map((item) => {
                  const stock = Number(item.stock) || 0;
                  const badgeKind = stock > 20 ? 'green' : stock > 0 ? 'amber' : 'red';
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-lg border border-border bg-surface hover:border-accent hover:bg-surface-2 transition text-left cursor-pointer flex flex-col justify-between min-h-[96px] group"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="mono text-[11px] uppercase font-bold" style={{ color: 'var(--text-faint)' }}>
                            {item.code}
                          </span>
                          <Badge kind={badgeKind} dot>
                            {fmt0(stock)}
                          </Badge>
                        </div>
                        <div className="text-[13.5px] font-semibold mt-1.5 group-hover:text-accent transition line-clamp-2">
                          {item.name}
                        </div>
                      </div>
                      <div className="text-[11.5px] mt-2 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                        <span className="truncate">{item.category?.name ?? '—'}</span>
                        <span className="mono text-[12px] font-bold text-accent opacity-0 group-hover:opacity-100 transition">
                          Select →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="py-20 text-center">
                  <Package className="mx-auto w-10 h-10 mb-3" style={{ color: 'var(--text-faint)' }} />
                  <div className="text-[14px] font-semibold">No items found</div>
                  <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Try selecting a different category or refining your search text.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
