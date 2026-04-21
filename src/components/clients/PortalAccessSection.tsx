import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { ShieldCheck, ShieldOff, KeyRound, Copy, UserPlus, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  clientId: string;
  clientName?: string;
  contactName?: string;
  contactEmail?: string;
}

export default function PortalAccessSection({ clientId, clientName, contactName, contactEmail }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; oneTime?: boolean } | null>(null);

  const { data: portalUser, isLoading, refetch: refetchPortalUser } = useQuery({
    queryKey: ['portal-user', clientId],
    queryFn: () => api.get(`/clients/${clientId}/portal-user`).then(r => r.data?.data ?? r.data ?? null),
  });

  // Extract a useful error message from a server error response
  const extractErrorMessage = (e: any, fallback: string) =>
    e?.response?.data?.detail
      || e?.response?.data?.error
      || e?.response?.data?.message
      || e?.message
      || fallback;

  if (isLoading) return <div className="glass-card p-5 animate-pulse h-24" />;

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" /> Portal Access
      </h2>

      {createdCreds && (
        <div className="mb-4 p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="text-sm font-medium text-success mb-2">✅ Portal access ready</div>
          {createdCreds.oneTime && (
            <p className="text-xs text-success/90 mb-2">
              Share this password with the client — it won't be shown again.
            </p>
          )}
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Login:</span> <span className="font-mono">{createdCreds.email}</span></div>
            <div><span className="text-muted-foreground">Password:</span> <span className="font-mono">{createdCreds.password}</span></div>
          </div>
          <button onClick={() => {
            const text = `Portal Login\nEmail: ${createdCreds.email}\nPassword: ${createdCreds.password}\nURL: ${window.location.origin}/login`;
            navigator.clipboard.writeText(text);
            toast.success('Credentials copied!');
          }} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors">
            <Copy className="h-3.5 w-3.5" /> Copy Credentials
          </button>
        </div>
      )}

      {!portalUser ? (
        <div>
          <p className="text-sm text-muted-foreground mb-3">This client does not have portal access yet.</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="h-4 w-4" /> Create Portal Access
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {portalUser.is_active ? '✅ Portal Access Active' : '❌ Portal Access Inactive'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Name</span><div className="font-medium">{portalUser.full_name}</div></div>
            <div><span className="text-muted-foreground">Email</span><div className="font-medium">{portalUser.email}</div></div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${portalUser.is_active ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                  {portalUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Last Login</span>
              <div className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {portalUser.last_login_at
                  ? new Date(portalUser.last_login_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never logged in'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
            {portalUser.is_active ? (
              <button onClick={() => setShowRevoke(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                <ShieldOff className="h-3.5 w-3.5" /> Revoke Access
              </button>
            ) : (
              <ReactivateButton
                userId={portalUser.id}
                clientId={clientId}
                onActivated={async (creds) => {
                  await refetchPortalUser();
                  qc.invalidateQueries({ queryKey: ['portal-user', clientId] });
                  if (creds) setCreatedCreds(creds);
                }}
                extractErrorMessage={extractErrorMessage}
              />
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePortalModal
          clientId={clientId}
          defaultName={contactName || clientName || ''}
          defaultEmail={contactEmail || ''}
          onClose={() => setShowCreate(false)}
          onSuccess={(email, password) => {
            setCreatedCreds({ email, password, oneTime: true });
            qc.invalidateQueries({ queryKey: ['portal-user', clientId] });
            refetchPortalUser();
            setShowCreate(false);
          }}
        />
      )}

      {showReset && portalUser && (
        <ResetPasswordModal
          clientId={clientId}
          email={portalUser.email}
          onClose={() => setShowReset(false)}
          onSuccess={(newPassword) => {
            setCreatedCreds({ email: portalUser.email, password: newPassword, oneTime: true });
            setShowReset(false);
          }}
        />
      )}

      {showRevoke && portalUser && (
        <RevokeModal
          userId={portalUser.id}
          onClose={() => setShowRevoke(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['portal-user', clientId] });
            setShowRevoke(false);
          }}
        />
      )}
    </div>
  );
}

function CreatePortalModal({ clientId, defaultName, defaultEmail, onClose, onSuccess }: {
  clientId: string; defaultName: string; defaultEmail: string;
  onClose: () => void; onSuccess: (email: string, pw: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);

  const mut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        client_id: clientId,
        email,
        full_name: name,
      };
      if (!autoGenerate && password.trim()) {
        payload.password = password.trim();
      }
      return api.post('/users/invite-client', payload).then(r => r.data);
    },
    onSuccess: (data: any) => {
      const returnedPassword: string | undefined =
        data?.temp_password
          ?? data?.data?.temp_password
          ?? data?.password
          ?? (!autoGenerate ? password : undefined);
      if (!returnedPassword) {
        toast.error('Portal access created but no password was returned');
        onClose();
        return;
      }
      toast.success('Portal access created');
      onSuccess(email, returnedPassword);
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail
          || e?.response?.data?.error
          || e?.response?.data?.message
          || 'Failed to create portal access'
      ),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Create Portal Access</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Client contact name"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Email *</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="client@company.com"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password *</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="text" placeholder="Initial password"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-[11px] text-muted-foreground mt-1">Plain text — share manually with client</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!email.trim() || !password.trim() || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mut.isPending ? 'Creating...' : 'Create Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ clientId, email, onClose, onSuccess }: {
  clientId: string;
  email: string;
  onClose: () => void;
  onSuccess: (newPassword: string) => void;
}) {
  const mut = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/reset-portal-password`).then(r => r.data),
    onSuccess: (data: any) => {
      const newPassword: string | undefined =
        data?.new_password ?? data?.password ?? data?.temp_password ?? data?.data?.new_password;
      if (!newPassword) {
        toast.error('Password reset succeeded but no new password was returned');
        onClose();
        return;
      }
      toast.success('Password reset. Share new credentials with client.');
      onSuccess(newPassword);
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail
          || e?.response?.data?.error
          || e?.response?.data?.message
          || 'Failed to reset password'
      ),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-2">Reset Portal Password</h2>
        <p className="text-sm text-muted-foreground mb-5">
          A new random password will be generated for <span className="font-medium text-foreground">{email}</span>.
          You'll see it once and can copy it to share with the client.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mut.isPending ? 'Resetting...' : 'Generate New Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RevokeModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
  const mut = useMutation({
    mutationFn: () => api.put(`/users/${userId}`, { is_active: false }).then(r => r.data),
    onSuccess: () => { toast.success('Portal access revoked'); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to revoke access'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-2">Revoke Portal Access</h2>
        <p className="text-sm text-muted-foreground mb-5">This will disable the client's portal login. Continue?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-colors disabled:opacity-50">
            {mut.isPending ? 'Revoking...' : 'Revoke Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReactivateButton({
  userId,
  clientId,
  onActivated,
  extractErrorMessage,
}: {
  userId: string;
  clientId: string;
  onActivated: (creds: { email: string; password: string; oneTime: boolean } | null) => void | Promise<void>;
  extractErrorMessage: (e: any, fallback: string) => string;
}) {
  const mut = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/users/${userId}`, { is_active: true });
      return { status: res.status, data: res.data };
    },
    onSuccess: async ({ status, data }) => {
      if (status !== 200 && status !== 201) {
        toast.error(data?.detail || data?.error || 'Failed to reactivate');
        return;
      }
      const user = data?.data ?? data?.user ?? data ?? {};
      const tempPassword: string | undefined = data?.temp_password ?? user?.temp_password;
      const created: boolean = Boolean(data?.created);
      const email: string = user?.email || '';
      await onActivated(
        tempPassword
          ? { email, password: tempPassword, oneTime: created || true }
          : null
      );
      toast.success('Portal access reactivated');
    },
    onError: (e: any) => {
      toast.error(extractErrorMessage(e, 'Failed to reactivate'));
    },
  });

  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
    >
      <ShieldCheck className="h-3.5 w-3.5" /> {mut.isPending ? 'Activating...' : 'Reactivate'}
    </button>
  );
}
