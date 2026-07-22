import { useState, type ReactNode } from 'react';
import { Palette, Image as ImageIcon, Receipt, Building2, Sun, Moon, Check, Upload, Box } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { toast } from '@/lib/toast';
import { apiErrorMessage } from '@/lib/http';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import type { AppSettings } from '@/types';

const ACCENT_PRESETS = [
  { name: 'Crimson', color: '#C8102E', press: '#a60d26' },
  { name: 'Indigo', color: '#4F46E5', press: '#4038c9' },
  { name: 'Emerald', color: '#059669', press: '#047a55' },
  { name: 'Royal Blue', color: '#2563EB', press: '#1e51c4' },
  { name: 'Violet', color: '#7C3AED', press: '#6a2fce' },
  { name: 'Amber', color: '#D97706', press: '#b9650a' },
  { name: 'Teal', color: '#0D9488', press: '#0b7c72' },
  { name: 'Slate', color: '#475569', press: '#3a4658' },
];

const NAV = [
  { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
  { id: 'brand', label: 'Branding', icon: ImageIcon },
  { id: 'billing', label: 'Billing & Tax', icon: Receipt },
  { id: 'company', label: 'Company profile', icon: Building2 },
] as const;

type SectionId = (typeof NAV)[number]['id'];

export default function SettingsPage() {
  const { settings, save, setLocal } = useSettings();
  const [section, setSection] = useState<SectionId>('appearance');

  const patch = async (p: Partial<AppSettings>) => {
    try { await save(p); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Personalise the system — colours, branding, billing rules and company details." />
      <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '212px 1fr' }}>
        <div className="card p-3.5 flex flex-col gap-1 sticky top-0">
          {NAV.map((n) => {
            const on = section === n.id;
            return (
              <button
                key={n.id}
                className={cn('text-left px-3 py-2 rounded-[7px] font-semibold text-[13.5px] flex items-center gap-2.5 transition', on ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                style={on ? { color: 'var(--accent)', background: 'var(--accent-soft)' } : { color: 'var(--text-muted)' }}
                onClick={() => setSection(n.id)}
              >
                <n.icon size={17} />{n.label}
              </button>
            );
          })}
        </div>
        <div>
          {section === 'appearance' && <Appearance settings={settings} patch={patch} setLocal={setLocal} />}
          {section === 'brand' && <Branding settings={settings} patch={patch} />}
          {section === 'billing' && <Billing settings={settings} patch={patch} />}
          {section === 'company' && <Company settings={settings} patch={patch} />}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="card p-5 mb-4">
      <div className="mb-4">
        <div className="text-[15px] font-bold">{title}</div>
        {sub && <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Appearance({ settings, patch, setLocal }: { settings: AppSettings; patch: (p: Partial<AppSettings>) => Promise<void>; setLocal: (p: Partial<AppSettings>) => void }) {
  return (
    <>
      <Panel title="Accent colour" sub="Pick the primary colour used across buttons, highlights and charts. Changes apply instantly.">
        <div className="flex gap-3 flex-wrap">
          {ACCENT_PRESETS.map((p) => {
            const on = settings.accent?.toLowerCase() === p.color.toLowerCase();
            return (
              <button
                key={p.name}
                className="w-[46px] h-[46px] rounded-[12px] relative transition hover:scale-105"
                style={{ background: p.color, border: `2.5px solid ${on ? 'var(--text)' : 'var(--border)'}` }}
                title={p.name}
                onClick={() => patch({ accent: p.color, accent_press: p.press })}
              >
                {on && <Check size={18} color="white" className="absolute inset-0 m-auto" />}
              </button>
            );
          })}
        </div>
        <div className="h-px my-5" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-3.5">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>Custom colour</span>
          <input
            type="color"
            value={settings.accent ?? '#C8102E'}
            onChange={(e) => setLocal({ accent: e.target.value, accent_press: e.target.value })}
            onBlur={() => void patch({ accent: settings.accent, accent_press: settings.accent })}
            className="w-[46px] h-[38px] rounded-lg cursor-pointer p-0.5"
            style={{ border: '1px solid var(--border-strong)' }}
          />
          <span className="mono text-[13px]" style={{ color: 'var(--text-muted)' }}>{(settings.accent ?? '').toUpperCase()}</span>
        </div>
      </Panel>

      <Panel title="Interface mode" sub="Switch between a light and dark workspace.">
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map((m) => {
            const on = settings.mode === m;
            const Ico = m === 'light' ? Sun : Moon;
            return (
              <button
                key={m}
                onClick={() => patch({ mode: m })}
                className="flex-1 flex items-center gap-2.5 px-4 py-3.5 rounded-[10px] font-semibold text-[14px]"
                style={{ border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)' }}
              >
                <Ico size={18} />{m === 'light' ? 'Light' : 'Dark'}
                {on && <Check size={16} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Live preview">
        <div className="flex gap-3 items-center flex-wrap">
          <Button variant="primary">Primary action</Button>
          <Button variant="ghost">Secondary</Button>
          <Badge kind="green" dot>Paid</Badge>
          <Badge kind="amber" dot>Partial</Badge>
          <Badge kind="red" dot>Unpaid</Badge>
          <span className="chip"><Box size={14} />Chip</span>
          <div className="bar" style={{ width: 120 }}><span style={{ width: '65%' }} /></div>
        </div>
      </Panel>
    </>
  );
}

function Branding({ settings, patch }: { settings: AppSettings; patch: (p: Partial<AppSettings>) => Promise<void> }) {
  const [company, setCompany] = useState(settings.company ?? '');
  const [logo, setLogo] = useState(settings.logo ?? '');
  return (
    <>
      <Panel title="Logo & name" sub="Shown in the sidebar, login screen and on printed invoices.">
        <Field label="System / company name" hint="Appears next to the logo mark.">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} onBlur={() => void patch({ company })} placeholder="e.g. Kadurata Kuda" />
        </Field>
        <div className="h-4" />
        <Field label="Logo monogram" hint="1–2 characters used inside the coloured logo mark.">
          <Input value={logo} maxLength={2} onChange={(e) => setLogo(e.target.value.toUpperCase())} onBlur={() => void patch({ logo })} style={{ width: 120 }} />
        </Field>
        <div className="h-px my-5" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-4">
          <div className="grid place-items-center rounded-[9px] text-white font-extrabold" style={{ background: 'var(--accent)', width: 52, height: 52, fontSize: 22 }}>{settings.logo}</div>
          <div>
            <div className="font-bold text-[16px]">{settings.company}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>Live sidebar preview</div>
          </div>
          <Button variant="ghost" icon={<Upload size={15} />} className="ml-auto" onClick={() => {}}>Upload image</Button>
        </div>
      </Panel>

      <Panel title="Favicon" sub="The small icon shown in the browser tab — updates live as you change the accent and monogram.">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="grid place-items-center w-[18px] h-[18px] rounded text-white text-[10px] font-extrabold" style={{ background: settings.accent }}>{settings.logo}</div>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{settings.company} — Distributor System</span>
          </div>
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Generated from accent + monogram</span>
        </div>
      </Panel>
    </>
  );
}

function Billing({ settings, patch }: { settings: AppSettings; patch: (p: Partial<AppSettings>) => Promise<void> }) {
  const [tax, setTax] = useState(String(settings.tax_rate ?? 0));
  const [currency, setCurrency] = useState(settings.currency ?? 'LKR');
  const [symbol, setSymbol] = useState(settings.symbol ?? 'Rs');
  const [prefix, setPrefix] = useState(settings.invoice_prefix ?? 'INV');

  return (
    <>
      <Panel title="Tax / VAT" sub="Default tax rate applied to new invoices.">
        <div className="flex items-end gap-4">
          <Field label="Tax rate (%)">
            <Input className="mono" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => void patch({ tax_rate: Number(tax) || 0 })} style={{ width: 120 }} />
          </Field>
          <div className="flex gap-2 mb-0.5">
            {[0, 8, 15, 18].map((t) => (
              <Button key={t} variant={Number(tax) === t ? 'primary' : 'subtle'} size="sm" onClick={() => { setTax(String(t)); void patch({ tax_rate: t }); }}>{t}%</Button>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Currency" sub="Display format for all monetary values.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency code">
            <Select value={currency} onChange={(e) => { setCurrency(e.target.value); void patch({ currency: e.target.value }); }}>
              {['LKR', 'USD', 'INR', 'GBP', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Symbol">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} onBlur={() => void patch({ symbol })} style={{ width: 100 }} />
          </Field>
        </div>
      </Panel>
      <Panel title="Invoice numbering" sub="Prefix and next number for auto-generated invoices.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prefix">
            <Input className="mono" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} onBlur={() => void patch({ invoice_prefix: prefix })} />
          </Field>
          <Field label="Preview">
            <div className="h-[42px] flex items-center">
              <span className="mono font-bold text-[14px] px-3 py-1.5 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{prefix}-NEXT</span>
            </div>
          </Field>
        </div>
      </Panel>
    </>
  );
}

function Company({ settings, patch }: { settings: AppSettings; patch: (p: Partial<AppSettings>) => Promise<void> }) {
  const [f, setF] = useState({
    company: settings.company ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    vat_no: settings.vat_no ?? '',
    address: settings.address ?? '',
  });
  const flush = () => void patch(f);

  return (
    <Panel title="Company profile" sub="Used on invoice headers and statements.">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Registered name" full><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} onBlur={flush} /></Field>
        <Field label="Phone"><Input className="mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} onBlur={flush} placeholder="011 234 5678" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={flush} placeholder="hello@company.lk" /></Field>
        <Field label="VAT / Tax reg. no."><Input className="mono" value={f.vat_no} onChange={(e) => setF({ ...f, vat_no: e.target.value })} onBlur={flush} placeholder="134XXXXXX-7000" /></Field>
        <Field label="Address" full><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} onBlur={flush} placeholder="Street, City, Country" /></Field>
      </div>
    </Panel>
  );
}
