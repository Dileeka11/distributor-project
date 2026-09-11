import { useState } from 'react';
import { http, apiErrorMessage } from '@/lib/http';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { Supplier } from '@/types';

interface SupForm {
  code: string; name: string; contact: string; phone: string; email: string; address: string; terms_days: string;
}

const nextSupplierCode = (rows: Supplier[]): string => {
  const max = rows.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0);
  return 'SUP-' + String(max + 1).padStart(3, '0');
};

/**
 * Add / edit a supplier. Used by the Supplier Master and straight from a GRN,
 * so `onSaved` hands back the saved supplier for the caller to select.
 */
export function SupplierModal({ rec = null, suppliers, onClose, onSaved }: {
  rec?: Supplier | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}) {
  const isNew = !rec;
  const [f, setF] = useState<SupForm>(() => rec
    ? { code: rec.code, name: rec.name, contact: rec.contact ?? '', phone: rec.phone ?? '', email: rec.email ?? '', address: rec.address ?? '', terms_days: String(rec.terms_days) }
    : { code: nextSupplierCode(suppliers), name: '', contact: '', phone: '', email: '', address: '', terms_days: '30' });
  const [busy, setBusy] = useState(false);
  const valid = f.code.trim() && f.name.trim();

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        code: f.code.trim(), name: f.name.trim(), contact: f.contact.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null, address: f.address.trim() || null,
        terms_days: Number(f.terms_days) || 0,
      };
      const r = isNew
        ? await http.post('/api/suppliers', payload)
        : await http.put(`/api/suppliers/${rec!.id}`, payload);
      toast(isNew ? 'Supplier created' : 'Supplier updated');
      onSaved(r.data.data);
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={(isNew ? 'Add ' : 'Edit ') + 'Supplier'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req hint="Auto-generated — editable."><Input className="mono" value={f.code} disabled={!isNew} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Supplier name" req><Input value={f.name} autoFocus={isNew} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Lanka Pharma Imports" /></Field>
        <Field label="Contact person"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <Field label="Phone"><Input className="mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Payment terms (days)"><Input className="mono" inputMode="numeric" value={f.terms_days} onChange={(e) => setF({ ...f, terms_days: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Address" full><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
