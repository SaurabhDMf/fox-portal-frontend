import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

interface Props {
  projectId: string;
  moduleId: string;
  sprintId?: string;
  mode: 'create' | 'edit';
  epic?: { id: string; title: string; color?: string; priority?: string; start_date?: string; due_date?: string };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EpicFormModal({ projectId, moduleId, sprintId, mode, epic, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: epic?.title || '',
    color: epic?.color || '#3B82F6',
    priority: (epic?.priority as typeof PRIORITIES[number]) || 'Medium',
    start_date: epic?.start_date?.split('T')[0] || '',
    due_date: epic?.due_date?.split('T')[0] || '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        title: form.title,
        color: form.color,
        priority: form.priority,
        module_id: moduleId,
      };
      if (sprintId) payload.sprint_id = sprintId;
      if (form.start_date) payload.start_date = form.start_date;
      if (form.due_date) payload.due_date = form.due_date;

      if (mode === 'edit' && epic) {
        return api.put(`/projects/${projectId}/epics/${epic.id}`, payload);
      }
      return api.post(`/projects/${projectId}/epics`, payload);
    },
    onSuccess: () => {
      toast.success(mode === 'edit' ? 'Epic updated' : 'Epic created');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || `Failed to ${mode} epic`),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'edit' ? 'Edit' : 'Create'} Epic</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <input placeholder="Epic Title *" value={form.title} onChange={e => set('title', e.target.value)} autoFocus
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />

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

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Start</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
          <div><label className="text-xs text-muted-foreground">Due</label><input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {mutation.isPending ? 'Saving...' : mode === 'edit' ? 'Save' : 'Create Epic'}
          </button>
        </div>
      </div>
    </div>
  );
}
