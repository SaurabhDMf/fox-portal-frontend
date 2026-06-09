import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import api, { inboxApi } from '@/lib/api';

const INP = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-colors';
const LBL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

const errMsg = (e: any) =>
  e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

function AvatarFallback({ name }: { name?: string }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function InboxMembersPage() {
  const navigate = useNavigate();
  const { inboxId } = useParams<{ inboxId: string }>();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/emp') ? '/emp/inbox' : '/admin/inbox';
  const qc = useQueryClient();

  const [tab, setTab] = useState<'senders' | 'members'>('senders');

  const { data: inboxes = [] } = useQuery<any[]>({
    queryKey: ['shared-inboxes'],
    queryFn: () => inboxApi.getInboxes().then(r => r.data),
    staleTime: 60_000, refetchOnWindowFocus: false, refetchInterval: false,
  });
  const inbox = inboxes.find(i => i.id === inboxId);

  const { data: senders = [], refetch: refetchSenders } = useQuery<any[]>({
    queryKey: ['inbox-senders-settings', inboxId],
    queryFn: () => inboxApi.getSenders(inboxId!).then(r => r.data),
    enabled: !!inboxId,
    staleTime: 60_000, refetchOnWindowFocus: false, refetchInterval: false,
  });

  const { data: members = [], refetch: refetchMembers } = useQuery<any[]>({
    queryKey: ['inbox-members-settings', inboxId],
    queryFn: () => inboxApi.getMembers(inboxId!).then(r => r.data),
    enabled: !!inboxId,
    staleTime: 60_000, refetchOnWindowFocus: false, refetchInterval: false,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users/active').then(r => r.data),
    staleTime: 120_000, refetchOnWindowFocus: false, refetchInterval: false,
  });

  // ── Sender actions ──
  const [newSender, setNewSender] = useState({ email_address: '', display_name: '' });
  const [addingSender, setAddingSender] = useState(false);

  const addSender = async () => {
    if (!newSender.email_address.trim()) return;
    setAddingSender(true);
    try {
      await inboxApi.addSender(inboxId!, newSender);
      setNewSender({ email_address: '', display_name: '' });
      refetchSenders();
      qc.invalidateQueries({ queryKey: ['inbox-senders', inboxId] });
      toast.success('Sender added');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setAddingSender(false); }
  };

  const removeSender = async (sid: string) => {
    try {
      await inboxApi.deleteSender(inboxId!, sid);
      refetchSenders();
      qc.invalidateQueries({ queryKey: ['inbox-senders', inboxId] });
      toast.success('Removed');
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  // ── Member actions ──
  const [selectedUser, setSelectedUser] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const addMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);
    try {
      await inboxApi.addMember(inboxId!, { user_id: selectedUser, role: 'member' });
      setSelectedUser('');
      refetchMembers();
      qc.invalidateQueries({ queryKey: ['inbox-members', inboxId] });
      toast.success('Member added');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setAddingMember(false); }
  };

  const removeMember = async (uid: string) => {
    try {
      await inboxApi.removeMember(inboxId!, uid);
      refetchMembers();
      qc.invalidateQueries({ queryKey: ['inbox-members', inboxId] });
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  const existingMemberIds = new Set(members.map((m: any) => m.user_id));
  const availableUsers = allUsers.filter((u: any) => !existingMemberIds.has(u.id));

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(basePath)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">
              {inbox?.name ? `${inbox.name} — Senders & Members` : 'Senders & Members'}
            </h1>
            <p className="page-subtitle">
              Manage the sender addresses and team access for this inbox
            </p>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {(['senders', 'members'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">

        {tab === 'senders' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add every email address that sends mail on behalf of this inbox. These appear as
              selectable "From" addresses when your team replies to threads.
            </p>

            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Add sender
              </h3>
              <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <label className={LBL}>Email address *</label>
                  <input value={newSender.email_address}
                    onChange={e => setNewSender(s => ({ ...s, email_address: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSender()}
                    placeholder="sales@yourdomain.com" className={INP} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={LBL}>Display name (optional)</label>
                  <input value={newSender.display_name}
                    onChange={e => setNewSender(s => ({ ...s, display_name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSender()}
                    placeholder="Saurabh — Sales" className={INP} />
                </div>
                <div className="flex items-end">
                  <button onClick={addSender}
                    disabled={addingSender || !newSender.email_address.trim()}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                    {addingSender ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              {senders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No senders yet — add the first one above.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {senders.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{s.email_address}</p>
                        {s.display_name && <p className="text-xs text-gray-400">{s.display_name}</p>}
                      </div>
                      <button onClick={() => removeSender(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Team members who can view and reply to threads in this inbox. Each member only sees
              threads assigned to them.
            </p>

            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Add team member
              </h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className={LBL}>Select a team member</label>
                  <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className={INP}>
                    <option value="">Choose…</option>
                    {availableUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name} — {u.email}</option>
                    ))}
                  </select>
                </div>
                <button onClick={addMember} disabled={addingMember || !selectedUser}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                  {addingMember ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No members yet — add the first one above.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {members.map((m: any) => (
                    <div key={m.user_id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarFallback name={m.full_name} />
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{m.full_name}</p>
                          <p className="text-xs text-gray-400">{m.email} · {m.role}</p>
                        </div>
                      </div>
                      <button onClick={() => removeMember(m.user_id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
