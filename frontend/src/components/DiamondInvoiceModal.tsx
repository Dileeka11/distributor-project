import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { http } from '@/lib/http';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { diamondInvoiceHtml } from '@/lib/diamondInvoice';
import type { Invoice } from '@/types';

// The slip is 80mm wide; at 96dpi that is a shade over 302px.
const ROLL_PX = 302;

/**
 * Shows the finished invoice exactly as it will come off the roll, and prints it.
 *
 * It renders into an iframe rather than a popup window: a popup opened after the
 * save request has already resolved is no longer tied to a user gesture, so the
 * browser blocks it and the operator sees nothing at all.
 */
export function DiamondInvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [data, setData] = useState<Invoice>(inv);
  const [height, setHeight] = useState(900);

  // Re-fetch so the slip always has its lines and item codes, whether it was
  // opened straight off a save response or from a list row.
  useEffect(() => {
    void http.get(`/api/invoices/${inv.id}`).then((r) => setData(r.data.data)).catch(() => {});
  }, [inv.id]);

  const html = useMemo(
    () => diamondInvoiceHtml(data, (data.lines ?? []).length > 0 ? 'full' : 'plain'),
    [data],
  );

  // Grow the frame to its content so the whole slip is visible without scrolling.
  const fit = () => {
    const doc = frame.current?.contentDocument;
    if (doc) setHeight(doc.documentElement.scrollHeight + 8);
  };

  // Printing the frame itself keeps the slip's own @page size, so the job goes
  // out at 80mm instead of being scaled onto whatever the page default is.
  const print = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return (
    <Modal
      title={`Invoice ${data.no}`}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" icon={<Printer size={15} />} onClick={print}>Print</Button>
        <Button variant="primary" onClick={onClose}>Close</Button>
      </>}
    >
      <div className="flex justify-center">
        <iframe
          ref={frame}
          title={`Invoice ${data.no}`}
          srcDoc={html}
          onLoad={fit}
          style={{
            width: ROLL_PX,
            height,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: '#fff',
          }}
        />
      </div>
    </Modal>
  );
}
