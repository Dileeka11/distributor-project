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

  // Size the frame to the slip itself. Measuring the body rather than the
  // document keeps the preview the height of the printed content — the paper
  // below it is the printer's business, not something to show as blank space.
  const fit = () => {
    const body = frame.current?.contentDocument?.body;
    if (body) setHeight(Math.ceil(body.getBoundingClientRect().height));
  };

  // The logos are data URIs, but re-measure once they have decoded so the frame
  // never settles on a height taken before the letterhead had laid out.
  const onFrameLoad = () => {
    fit();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    Promise.all(
      Array.from(doc.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise((res) => { img.onload = img.onerror = res; })),
    ).then(fit);
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
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" icon={<Printer size={15} />} onClick={print}>Print</Button>
      </>}
    >
      <div className="flex justify-center">
        <iframe
          ref={frame}
          title={`Invoice ${data.no}`}
          srcDoc={html}
          onLoad={onFrameLoad}
          scrolling="no"
          style={{
            width: ROLL_PX,
            height,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: '#fff',
            display: 'block',
          }}
        />
      </div>
    </Modal>
  );
}
