import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import UserPicker from './UserPicker';

const COLORS = ['#6c63fa', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Done'];

interface Props {
  projectId: string;
  sprintId: string;
  mode: 'create' | 'edit';
  module?: { id: string; title: string; description?: string; color: string; status?: string; owner_id?: string };
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModuleFormModal({ projectId, sprintId, mode, module, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: module?.title || '',
    description: module?.description || '',
    color: module?.color || '#6c63fa',
    status: module?.status || 'Open',
    owner_id: module?.owner_id || '',
    start_date: '',
    due_date: '',
  });

  // Removed project-members query — using UserPicker with /users/active instead

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        title: form.title,
        description: form.description || undefined,
        color: form.color,
        status: form.status,
        sprint_id: sprintId,
      };
      if (form.owner_id) payload.owner_id = form.owner_id;
      if (form.start_date) payload.start_date = form.start_date;
      if (form.due_date) payload.due_date = form.due_date;

      if (mode === 'edit' && module) {
        return api.put(`/projects/${projectId}/modules/${module.id}`, payload);
      }
      return api.post(`/projects/${projectId}/modules`, payload);
    },
    onSuccess: () => {
      toast.success(mode === 'edit' ? 'Module updated' : 'Module created');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || `Failed to ${mode} module`),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'edit' ? 'Edit' : 'Create'} Module</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <input placeholder="Module Title *" value={form.title} onChange={e => set('title', e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />

        <textarea placeholder="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Color</label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <UserPicker
            value={form.owner_id || null}
            onChange={(id) => set('owner_id', id || '')}
            label="Owner"
            placeholder="No owner"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Start</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
          <div><label className="text-xs text-muted-foreground">Due</label><input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {mutation.isPending ? 'Saving...' : mode === 'edit' ? 'Save' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  );
}
