import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCog, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';

interface Props {
  projectId: string;
  onDone: () => void;
}

/**
 * Small toolbar action: opens a confirm modal to reassign EVERY task in the
 * project to a single user. Uses POST /projects/:id/tasks/bulk-assign.
 */
export default function BulkAssignBar({ projectId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users/active').then((r: any) => extractProjectArray<any>(r.data, ['users'])),
  });
  const usersArr = Array.isArray(users) ? users : [];

  const submit = async () => {
    if (!userId) return;
    const picked = usersArr.find((u: any) => u.id === userId);
    if (!confirm(`Reassign EVERY task in this project to ${picked?.full_name || 'this user'}? This overrides any existing assignees.`)) return;
    setBusy(true);
    try {
      const res = await api.post(`/projects/${projectId}/tasks/bulk-assign`, { assignee_id: userId });
      toast.success(`Reassigned ${res.data?.tasks_updated || 0} tasks to ${res.data?.assignee?.full_name || 'user'}`);
      setOpen(false);
      setUserId('');
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to reassign tasks');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setUserId(''); }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/25"
        title="Reassign every task in this project to one user"
      >
        <UserCog className="h-3.5 w-3.5" /> Reassign all
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Reassign all tasks</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              Assigns every task in this project (including checklist tasks) to the person you pick.
              Any existing assignees on those tasks will be replaced.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Assign to</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select a user…</option>
                {usersArr.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}{u.job_title ? ` — ${u.job_title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button
                onClick={submit}
                disabled={busy || !userId}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Reassigning…' : 'Reassign all tasks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
