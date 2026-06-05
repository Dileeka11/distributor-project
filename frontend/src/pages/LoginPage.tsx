import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Common';
import { apiErrorMessage } from '@/lib/http';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@medistock.lk');
  const [pw, setPw] = useState('demo1234');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const company = settings.company ?? 'MediStock';
  const logo = settings.logo ?? 'M';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await login(email, pw, remember);
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(apiErrorMessage(e2, 'Login failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-screen" style={{ gridTemplateColumns: '1.05fr 1fr' }}>
      <aside className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
        <div className="absolute rounded-full border-[1.5px]" style={{ width: 420, height: 420, top: -120, right: -120, borderColor: 'rgba(255,255,255,.16)' }} />
        <div className="absolute rounded-full border-[1.5px]" style={{ width: 280, height: 280, bottom: 40, left: -90, borderColor: 'rgba(255,255,255,.16)' }} />
        <div className="absolute rounded-full border-[1.5px]" style={{ width: 160, height: 160, bottom: -40, right: 120, borderColor: 'rgba(255,255,255,.16)' }} />

        <div className="relative flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-[11px] text-lg font-extrabold" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)' }}>{logo}</div>
          <div className="text-[17px] font-bold">{company}</div>
        </div>

        <div className="relative">
          <div className="text-[34px] font-extrabold tracking-tight leading-tight max-w-[420px]">
            Run your distribution<br />business end to end.
          </div>
          <p className="mt-4 text-[15px] opacity-80 max-w-[380px] leading-relaxed">
            Inventory, suppliers, customers, cash &amp; credit invoicing, and outstanding settlement — in one clean workspace.
          </p>
          <div className="flex gap-7 mt-8">
            {[['12,400+', 'SKUs tracked'], ['LKR 48M', 'Billed this month'], ['99.9%', 'Uptime']].map(([a, b]) => (
              <div key={b}>
                <div className="text-[21px] font-extrabold">{a}</div>
                <div className="text-[12.5px] opacity-75">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[12.5px] opacity-70">© {new Date().getFullYear()} {company}. All rights reserved.</div>
      </aside>

      <section className="grid place-items-center p-8 bg-bg">
        <div className="w-full max-w-[372px] fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid place-items-center w-[38px] h-[38px] rounded-[9px] text-white font-extrabold" style={{ background: 'var(--accent)' }}>{logo}</div>
            <div>
              <div className="font-bold text-[16px]">{company}</div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>Distributor Management System</div>
            </div>
          </div>

          <h1 className="text-[24px] font-extrabold tracking-tight mb-1.5">Sign in</h1>
          <p className="mb-6 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>Welcome back. Enter your credentials to continue.</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Email address">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.lk" autoComplete="email" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" style={{ paddingRight: 64 }} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <Switch on={remember} onClick={() => setRemember((r) => !r)} /> Remember me
              </label>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>Forgot password?</a>
            </div>
            {err && <div className="text-[13px] px-3 py-2 rounded-md badge-red">{err}</div>}
            <Button variant="primary" type="submit" disabled={busy} style={{ height: 44, marginTop: 4 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 px-4 py-3 text-[12.5px] flex gap-2 items-center rounded-[9px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <AlertCircle size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            Demo credentials are pre-filled. Press <span className="mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>Sign in</span>.
          </div>
        </div>
      </section>
    </div>
  );
}
