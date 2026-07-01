import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Lock, User as UserIcon, Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Common';
import { apiErrorMessage } from '@/lib/http';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  const company = settings.company ?? 'MediStock';
  const logo = settings.logo ?? 'M';
  const valid = username.trim().length > 0 && pw.trim().length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) { setErr('Enter your username and password to sign in.'); return; }
    setBusy(true); setErr(null);
    try {
      await login(username.trim(), pw, remember);
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(apiErrorMessage(e2, 'Login failed'));
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <style>{`
        .login-wrap{position:relative;height:100vh;overflow:hidden;display:grid;place-items:center;
          background:linear-gradient(120deg,var(--accent),color-mix(in oklab,var(--accent) 45%, #0f172a));
          background-size:200% 200%;animation:lg-grad 16s ease infinite}
        @keyframes lg-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .lg-blob{position:absolute;border-radius:50%;filter:blur(6px);opacity:.32;background:rgba(255,255,255,.6);
          animation:lg-float 13s ease-in-out infinite}
        @keyframes lg-float{0%,100%{transform:translate(0,0)}50%{transform:translate(24px,-42px)}}
        .lg-ring{position:absolute;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);animation:lg-spin 34s linear infinite}
        @keyframes lg-spin{to{transform:rotate(360deg)}}
        .lg-card{position:relative;width:min(420px,92vw);border-radius:22px;padding:34px 32px;
          background:#ffffff;color:#131822;box-shadow:0 34px 90px rgba(0,0,0,.4);
          animation:lg-in .55s cubic-bezier(.2,.9,.3,1)}
        @keyframes lg-in{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
        .lg-field{position:relative}
        .lg-input{width:100%;height:46px;border-radius:12px;border:1.5px solid #e2e6ec;background:#f8fafc;
          padding:0 14px 0 42px;font-size:14px;outline:none;transition:border-color .15s, box-shadow .15s;color:#131822}
        .lg-input::placeholder{color:#9aa3b2}
        .lg-label{font-size:12.5px;font-weight:600;margin-bottom:6px;display:block;color:#5b6472}
        .lg-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--accent) 22%, transparent)}
        .lg-ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text-faint)}
      `}</style>

      <div className="lg-blob" style={{ width: 260, height: 260, top: '8%', left: '10%' }} />
      <div className="lg-blob" style={{ width: 180, height: 180, bottom: '12%', right: '14%', animationDelay: '2s' }} />
      <div className="lg-blob" style={{ width: 120, height: 120, top: '62%', left: '24%', animationDelay: '4s' }} />
      <div className="lg-ring" style={{ width: 520, height: 520, top: -160, right: -140 }} />
      <div className="lg-ring" style={{ width: 320, height: 320, bottom: -120, left: -100, animationDirection: 'reverse' }} />

      {/* login details icon */}
      <button
        type="button"
        onClick={() => setHint((h) => !h)}
        className="grid place-items-center"
        style={{ position: 'absolute', top: 22, right: 22, width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', backdropFilter: 'blur(6px)' }}
        title="Login details"
      >
        <Info size={19} />
      </button>
      {hint && (
        <div style={{ position: 'absolute', top: 74, right: 22, width: 250, borderRadius: 13, padding: 15, background: '#fff', boxShadow: '0 22px 55px rgba(0,0,0,.28)', animation: 'lg-in .2s ease', zIndex: 5 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-bold">Demo login</div>
            <button type="button" onClick={() => setHint(false)} aria-label="Close"><X size={15} /></button>
          </div>
          <div className="text-[12.5px] leading-6" style={{ color: 'var(--text-muted)' }}>
            <div>Username: <b className="mono" style={{ color: 'var(--text)' }}>admin</b></div>
            <div>Password: <b className="mono" style={{ color: 'var(--text)' }}>admin@123</b></div>
          </div>
          <Button variant="subtle" size="sm" className="mt-3 w-full" onClick={() => { setUsername('admin'); setPw('admin@123'); setHint(false); }}>Fill in credentials</Button>
        </div>
      )}

      <div className="lg-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid place-items-center w-11 h-11 rounded-[13px] text-white text-lg font-extrabold" style={{ background: 'var(--accent)' }}>{logo}</div>
          <div>
            <div className="font-extrabold text-[17px] tracking-tight" style={{ color: '#131822' }}>{company}</div>
            <div className="text-[11.5px] font-medium" style={{ color: '#8a93a3' }}>Distributor Management System</div>
          </div>
        </div>

        <h1 className="text-[23px] font-extrabold tracking-tight mb-1" style={{ color: '#131822' }}>Welcome back 👋</h1>
        <p className="mb-6 text-[13.5px]" style={{ color: '#5b6472' }}>Sign in to continue to your workspace.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="lg-label">Username</label>
            <div className="lg-field">
              <UserIcon size={17} className="lg-ic" />
              <input className="lg-input mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoComplete="username" autoFocus />
            </div>
          </div>
          <div>
            <label className="lg-label">Password</label>
            <div className="lg-field">
              <Lock size={17} className="lg-ic" />
              <input className="lg-input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <Switch on={remember} onClick={() => setRemember((r) => !r)} /> Remember me
            </label>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>Forgot?</a>
          </div>

          {err && <div className="text-[13px] px-3 py-2 rounded-md badge-red">{err}</div>}

          <Button variant="primary" type="submit" disabled={busy || !valid} style={{ height: 46 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="text-center text-[11.5px] mt-5" style={{ color: 'var(--text-faint)' }}>© {new Date().getFullYear()} {company}. All rights reserved.</div>
      </div>
    </div>
  );
}
