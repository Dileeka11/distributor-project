import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { PAGES } from '@/lib/pages';
import { useAuth } from '@/store/auth';
import type { User } from '@/types';

// Pages a non-admin can be granted (user management stays admin-only).
const ASSIGNABLE = PAGES.filter((p) => p.key !== 'users');

export default function UsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | 'new' | null>(null);

  const load = () => http.get('/api/users').then((r) => setRows(r.data.data));
  useEffect(() => { void load(); }, []);

  return (
    <div className="fade-in">
      <PageHead
        title="System Users"
        sub="Create users and control which pages each one can access."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add User</Button>}
      />

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Access</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.name}</td>
                <td className="mono">{u.username}</td>
                <td className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                <td>{u.is_admin ? <Badge kind="green">Admin</Badge> : <Badge kind="gray">User</Badge>}</td>
                <td className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>{u.is_admin ? 'All pages' : `${u.permissions?.length ?? 0} pages`}</td>
                <td className="num">
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(u)} />
                    {u.id !== me?.id && (
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                        if (!(await confirmDelete({ title: 'Delete user?', html: `Remove <b>${u.name}</b>? They will lose access immediately.` }))) return;
                        try { await http.delete(`/api/users/${u.id}`); toast('User deleted'); void load(); }
                        catch (e) { toast(apiErrorMessage(e), 'err'); }
                      }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon={<ShieldCheck size={40} />} title="No users yet" sub="Add a user and choose the pages they can access." />}
      </div>

      {editing && (
        <UserModal
          rec={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function UserModal({ rec, onClose, onSaved }: { rec: User | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !rec;
  const [name, setName] = useState(rec?.name ?? '');
  const [username, setUsername] = useState(rec?.username ?? '');
  const [email, setEmail] = useState(rec?.email ?? '');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(rec?.is_admin ?? false);
  const [perms, setPerms] = useState<string[]>(rec?.permissions ?? []);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && username.trim() && (isNew ? password.trim() : true);
  const toggle = (key: string) => setPerms((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(), username: username.trim(), email: email.trim() || null,
        password: password || undefined, is_admin: isAdmin, permissions: isAdmin ? [] : perms,
      };
      if (isNew) await http.post('/api/users', payload);
      else await http.put(`/api/users/${rec!.id}`, payload);
      toast(isNew ? 'User created' : 'User updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title={isNew ? 'Add User' : 'Edit User'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" req><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kasun Silva" /></Field>
        <Field label="Username" req hint="Used to sign in."><Input className="mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. cashier1" /></Field>
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={isNew ? 'Password' : 'New password'} req={isNew} hint={isNew ? undefined : 'Leave blank to keep current.'}>
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-[14px] cursor-pointer mt-4">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        <span><b>Administrator</b> — full access to every page and to user management.</span>
      </label>

      {!isAdmin && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Allowed pages</div>
          <div className="grid grid-cols-3 gap-2">
            {ASSIGNABLE.map((p) => {
              const always = p.key === 'dashboard';
              const on = always || perms.includes(p.key);
              return (
                <label key={p.key} className="flex items-center gap-2 text-[13px] px-3 py-2 rounded-[9px] border border-border cursor-pointer" style={{ background: on ? 'var(--surface-2)' : undefined, opacity: always ? 0.7 : 1 }}>
                  <input type="checkbox" checked={on} disabled={always} onChange={() => toggle(p.key)} />
                  {p.label}
                </label>
              );
            })}
          </div>
          <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-faint)' }}>Dashboard is always available. This user will only see the pages ticked above.</div>
        </div>
      )}
    </Modal>
  );
}
