import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ShieldCheck, ShieldOff, KeyRound, Copy, UserPlus, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  clientId: string;
  clientName?: string;
  contactName?: string;
  contactEmail?: string;
}

type PortalUserRecord = {
  id: string;
  email: string;
  full_name?: string;
  is_active?: boolean | number | string;
  last_login_at?: string | null;
  [key: string]: any;
};

type PortalUserQueryState = {
  user: PortalUserRecord | null;
  resolved: boolean;
};

function coerceBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'active', 'yes'].includes(value.toLowerCase());
  return Boolean(value);
}

function parsePortalUserResponse(payload: any): PortalUserQueryState {
  const candidates = [
    payload?.data?.data?.user,
    payload?.data?.data,
    payload?.data?.portal_user,
    payload?.data?.user,
    payload?.data?.client_portal_user,
    payload?.data,
    payload?.portal_user,
    payload?.user,
    payload?.client_portal_user,
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const looksLikePortalUser = [
      'id',
      'email',
      'full_name',
      'client_id',
      'is_active',
      'last_login_at',
    ].some((key) => key in candidate);

    if (!looksLikePortalUser) continue;

    return {
      user: {
        ...candidate,
        is_active: coerceBoolean(candidate.is_active),
      },
      resolved: true,
    };
  }

  const explicitNull = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.portal_user,
    payload?.user,
    payload?.client_portal_user,
    payload?.data?.portal_user,
    payload?.data?.user,
    payload?.data?.client_portal_user,
  ].some((value) => value === null);

  return { user: null, resolved: explicitNull };
}

function extractOneTimePassword(payload: any, fallback?: string) {
  return (
    payload?.temp_password ??
    payload?.data?.temp_password ??
    payload?.new_password ??
    payload?.data?.new_password ??
    payload?.password ??
    payload?.data?.password ??
    fallback
  );
}

export default function PortalAccessSection({ clientId, clientName, contactName, contactEmail }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [optimisticPortalUser, setOptimisticPortalUser] = useState<PortalUserRecord | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; oneTime?: boolean } | null>(null);

  const {
    data: portalState,
    isLoading,
    isError,
    refetch: refetchPortalUser,
  } = useQuery({
    queryKey: ['portal-user', clientId],
    queryFn: async () => {
      const response = await api.get(`/clients/${clientId}/portal-user`);
      return parsePortalUserResponse(response.data);
    },
    enabled: !!clientId,
    refetchInterval: justCreated ? 1000 : false,
  });

  useEffect(() => {
    if (portalState?.user) {
      setOptimisticPortalUser(portalState.user);
      if (justCreated) setJustCreated(false);
    }
  }, [portalState, justCreated]);

  useEffect(() => {
    if (!justCreated) return;
    const timeout = window.setTimeout(() => setJustCreated(false), 10000);
    return () => window.clearTimeout(timeout);
  }, [justCreated]);

  const extractErrorMessage = (e: any, fallback: string) =>
    e?.response?.data?.detail
      || e?.response?.data?.error
      || e?.response?.data?.message
      || e?.message
      || fallback;

  const currentPortalUser = portalState?.user ?? optimisticPortalUser;
  const hasResolvedPortalState = portalState?.resolved ?? false;

  if ((isLoading || (!hasResolvedPortalState && !isError)) && !currentPortalUser) {
    return <div className="glass-card p-5 animate-pulse h-24" />;
  }

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

      {!currentPortalUser && hasResolvedPortalState ? (
        <div>
          <p className="text-sm text-muted-foreground mb-3">This client does not have portal access yet.</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="h-4 w-4" /> Create Portal Access
          </button>
        </div>
      ) : !currentPortalUser ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          Checking portal access…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {currentPortalUser.is_active ? '✅ Portal Access Active' : '❌ Portal Access Inactive'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Name</span><div className="font-medium">{currentPortalUser.full_name || '—'}</div></div>
            <div><span className="text-muted-foreground">Email</span><div className="font-medium">{currentPortalUser.email || '—'}</div></div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentPortalUser.is_active ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                  {currentPortalUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Last Login</span>
              <div className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {currentPortalUser.last_login_at
                  ? new Date(currentPortalUser.last_login_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never logged in'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
            {currentPortalUser.is_active ? (
              <button onClick={() => setShowRevoke(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                <ShieldOff className="h-3.5 w-3.5" /> Revoke Access
              </button>
            ) : (
              <ReactivateButton
                userId={currentPortalUser.id}
                clientId={clientId}
                onActivated={async (creds) => {
                  await qc.invalidateQueries({
                    queryKey: ['portal-user', clientId],
                    refetchType: 'all'
                  });
                  const fresh = await refetchPortalUser();
                  const normalized = fresh.data ?? null;
                  if (normalized) setOptimisticPortalUser(normalized);
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
          onSuccess={async (email, password, user) => {
            setCreatedCreds({ email, password, oneTime: true });
            setJustCreated(true);
            if (user) {
              setOptimisticPortalUser(user);
              qc.setQueryData(['portal-user', clientId], user);
            }
            await qc.invalidateQueries({
              queryKey: ['portal-user', clientId],
              refetchType: 'all'
            });
            await refetchPortalUser();
            setShowCreate(false);
          }}
        />
      )}

      {showReset && currentPortalUser && (
        <ResetPasswordModal
          clientId={clientId}
          email={currentPortalUser.email}
          onClose={() => setShowReset(false)}
          onSuccess={(newPassword) => {
            setCreatedCreds({ email: currentPortalUser.email, password: newPassword, oneTime: true });
            setShowReset(false);
          }}
        />
      )}

      {showRevoke && currentPortalUser && (
        <RevokeModal
          userId={currentPortalUser.id}
          onClose={() => setShowRevoke(false)}
          onSuccess={async () => {
            setOptimisticPortalUser(null);
            qc.setQueryData(['portal-user', clientId], null);
            await qc.invalidateQueries({
              queryKey: ['portal-user', clientId],
              refetchType: 'all'
            });
            setShowRevoke(false);
          }}
        />
      )}
    </div>
  );
}

function CreatePortalModal({ clientId, defaultName, defaultEmail, onClose, onSuccess }: {
  clientId: string; defaultName: string; defaultEmail: string;
  onClose: () => void; onSuccess: (email: string, pw: string, user: PortalUserRecord | null) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);

  const mut = useMutation({
    mutationFn: () => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      const cleanPassword = password.trim();
      const payload: Record<string, any> = {
        email: cleanEmail,
        full_name: cleanName,
      };
      if (!autoGenerate && cleanPassword) {
        payload.password = cleanPassword;
      }
      return api.post(`/clients/${clientId}/portal-users`, payload).then(r => r.data);
    },
    onSuccess: (data: any) => {
      const normalizedUser = normalizePortalUser(data);
      const returnedPassword = extractOneTimePassword(data, !autoGenerate ? password.trim() : undefined);
      if (!returnedPassword) {
        toast.error('Portal access created but no password was returned');
        onClose();
        return;
      }
      if (normalizedUser) {
        qc.setQueryData(['portal-user', clientId], normalizedUser);
      }
      toast.success('Portal access created');
      onSuccess(email.trim().toLowerCase(), returnedPassword, normalizedUser);
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Password</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={e => setAutoGenerate(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                Auto-generate
              </label>
            </div>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="text"
              disabled={autoGenerate}
              placeholder={autoGenerate ? 'A strong password will be generated' : 'Set a custom password'}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {autoGenerate
                ? "You'll see the generated password once — copy and share it with the client."
                : 'Plain text — share manually with the client.'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!email.trim() || !name.trim() || (!autoGenerate && !password.trim()) || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
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
      const newPassword = extractOneTimePassword(data);
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
    onError: (e: any) => toast.error(e?.response?.data?.detail || e?.response?.data?.error || e?.response?.data?.message || 'Failed to revoke access'),
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
  const qc = useQueryClient();
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
      const user = normalizePortalUser(data);
      const tempPassword = extractOneTimePassword(data);
      if (user) {
        qc.setQueryData(['portal-user', clientId], user);
      }
      await onActivated(
        tempPassword
          ? { email: user?.email || '', password: tempPassword, oneTime: true }
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

