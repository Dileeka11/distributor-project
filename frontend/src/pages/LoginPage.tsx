import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Eye, EyeOff, Package, ReceiptText, CalendarCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage } from '@/lib/http';
import { alertError } from '@/lib/toast';

// Turn backend / validation strings into a friendly sign-in message.
function friendlyLoginError(raw: string): string {
  if (/auth\.failed/i.test(raw)) return 'The username or password you entered is incorrect.';
  if (/required/i.test(raw)) return 'Please enter both your username and password.';
  return raw;
}

const FEATURES = [
  { icon: Package, title: 'Inventory & GRN batches', sub: 'Items, purchases and live stock in one place.' },
  { icon: ReceiptText, title: 'Cash & credit invoicing', sub: 'Billing, cheques and outstanding balances.' },
  { icon: CalendarCheck, title: 'HR, attendance & payroll', sub: 'Clock-ins, worked hours and payslips.' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const company = settings.company ?? 'Kadurata Kuda';
  const logo = settings.logo ?? 'KK';
  const year = new Date().getFullYear();
  const valid = username.trim().length > 0 && pw.trim().length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      const m = 'Please enter both your username and password.';
      setErr(m);
      void alertError('Missing details', m);
      return;
    }
    setBusy(true); setErr(null);
    try {
      await login(username.trim(), pw);
      navigate('/', { replace: true });
    } catch (e2) {
      const msg = friendlyLoginError(apiErrorMessage(e2, 'Login failed'));
      setErr(msg);
      void alertError('Sign in failed', msg);
    } finally { setBusy(false); }
  }

  return (
    <div className="lg-wrap">
      <style>{`
        .lg-wrap{display:flex;min-height:100vh;background:#f6f8fb}

        /* ---- Left / brand panel ---- */
        .lg-brand{position:relative;overflow:hidden;flex:1 1 52%;display:flex;flex-direction:column;
          justify-content:space-between;padding:56px 64px;color:#fff;
          background:
            radial-gradient(1100px 620px at -10% -20%, rgba(255,255,255,.14), transparent 55%),
            radial-gradient(900px 700px at 115% 115%, rgba(0,0,0,.30), transparent 60%),
            linear-gradient(150deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 62%, #101828) 58%, color-mix(in oklab, var(--accent) 34%, #0b1220) 100%)}
        .lg-brand::before{content:'';position:absolute;inset:0;opacity:.35;
          background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.05) 1px,transparent 1px);
          background-size:44px 44px}
        .lg-mark{position:absolute;right:-70px;bottom:-60px;font-size:340px;font-weight:800;line-height:1;
          letter-spacing:-.04em;color:rgba(255,255,255,.05);user-select:none;pointer-events:none}
        .lg-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.65)}
        .lg-headline{font-size:clamp(26px,2.6vw,34px);font-weight:800;letter-spacing:-.02em;line-height:1.18;max-width:520px}
        .lg-sub{font-size:14.5px;line-height:1.65;color:rgba(255,255,255,.72);max-width:440px}
        .lg-feat{display:flex;align-items:flex-start;gap:14px}
        .lg-feat-ic{flex-shrink:0;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;
          background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
        .lg-feat-t{font-size:14px;font-weight:700}
        .lg-feat-s{font-size:12.5px;color:rgba(255,255,255,.62);margin-top:2px}

        /* ---- Right / form panel ---- */
        .lg-side{flex:1 1 48%;display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:48px 24px;background:#fff}
        .lg-form{width:min(392px,100%)}
        .lg-mobile-brand{display:none}
        .lg-label{font-size:12.5px;font-weight:600;margin-bottom:6px;display:block;color:#5b6472}
        .lg-field{position:relative}
        .lg-input{width:100%;height:46px;border-radius:11px;border:1.5px solid #e3e7ee;background:#f8fafc;
          padding:0 14px 0 42px;font-size:14px;outline:none;color:#131822;
          transition:border-color .15s, box-shadow .15s, background .15s}
        .lg-input::placeholder{color:#9aa3b2}
        .lg-input:focus{border-color:var(--accent);background:#fff;
          box-shadow:0 0 0 3.5px color-mix(in oklab,var(--accent) 16%, transparent)}
        .lg-ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#98a1b0}
        .lg-secure{display:flex;align-items:center;justify-content:center;gap:7px;
          font-size:11.5px;color:#98a1b0;margin-top:26px}

        @media (max-width: 900px){
          .lg-brand{display:none}
          .lg-side{background:#f6f8fb}
          .lg-form{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:34px 30px;
            box-shadow:0 18px 50px rgba(15,23,42,.08)}
          .lg-mobile-brand{display:flex;align-items:center;gap:11px;margin-bottom:26px}
        }
      `}</style>

      {/* Brand / value panel */}
      <aside className="lg-brand">
        <div className="lg-mark">{logo}</div>

        <div className="flex items-center gap-3.5" style={{ position: 'relative' }}>
          <div className="grid place-items-center w-12 h-12 rounded-[14px] text-[19px] font-extrabold"
            style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)' }}>{logo}</div>
          <div>
            <div className="font-extrabold text-[18px] tracking-tight">{company}</div>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.6)' }}>Distributor Management System</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="lg-eyebrow mb-3.5">Everything in one workspace</div>
          <h2 className="lg-headline mb-4">Run your distribution business with clarity and control.</h2>
          <p className="lg-sub mb-9">
            Stock, sales, purchasing and payroll — tracked accurately from the moment goods
            arrive to the moment invoices are settled.
          </p>
          <div className="flex flex-col gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="lg-feat">
                <span className="lg-feat-ic"><f.icon size={18} /></span>
                <span>
                  <div className="lg-feat-t">{f.title}</div>
                  <div className="lg-feat-s">{f.sub}</div>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[12px]" style={{ position: 'relative', color: 'rgba(255,255,255,.5)' }}>
          © {year} {company}. All rights reserved.
        </div>
      </aside>

      {/* Sign-in panel */}
      <main className="lg-side">
        <div className="lg-form">
          <div className="lg-mobile-brand">
            <div className="grid place-items-center w-11 h-11 rounded-[13px] text-white text-lg font-extrabold" style={{ background: 'var(--accent)' }}>{logo}</div>
            <div>
              <div className="font-extrabold text-[16.5px] tracking-tight" style={{ color: '#131822' }}>{company}</div>
              <div className="text-[11.5px] font-medium" style={{ color: '#8a93a3' }}>Distributor Management System</div>
            </div>
          </div>

          <h1 className="text-[24px] font-extrabold tracking-tight mb-1.5" style={{ color: '#131822' }}>Sign in</h1>
          <p className="mb-7 text-[13.5px]" style={{ color: '#5b6472' }}>Welcome back — please enter your account details.</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
            <div>
              <label className="lg-label" htmlFor="lg-username">Username</label>
              <div className="lg-field">
                <UserIcon size={17} className="lg-ic" />
                <input id="lg-username" className="lg-input mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" autoComplete="username" autoFocus />
              </div>
            </div>
            <div>
              <label className="lg-label" htmlFor="lg-password">Password</label>
              <div className="lg-field">
                <Lock size={17} className="lg-ic" />
                <input id="lg-password" className="lg-input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a93a3' }}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: '#8a93a3' }}>Sign in required on every visit.</span>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>Forgot password?</a>
            </div>

            {err && <div className="text-[13px] px-3 py-2 rounded-md badge-red">{err}</div>}

            <Button variant="primary" type="submit" disabled={busy || !valid} style={{ height: 47, fontSize: 14.5 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="lg-secure">
            <ShieldCheck size={14} /> Authorized access only · {company}
          </div>
        </div>
      </main>
    </div>
  );
}
