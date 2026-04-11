import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { BOARD_COLUMNS, WORKFLOW_STAGES } from '@/lib/projectTypes';
import { Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import UserPicker from './UserPicker';

const PRIORITIES = ['High', 'Medium', 'Low'];
const STAGES = WORKFLOW_STAGES;

interface SubtaskEditModalProps {
  subtask: any;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export function SubtaskEditModal({ subtask, onClose, onSuccess }: SubtaskEditModalProps) {
  const [form, setForm] = useState({
    title: subtask.title || '',
    assignee_id: subtask.assignee_ids?.[0] || subtask.assignees?.[0]?.id || subtask.assignee_id || '',
    due_date: subtask.due_date ? subtask.due_date.slice(0, 10) : '',
    status: subtask.status || 'Open',
    priority: subtask.priority || 'Medium',
    stage: subtask.stage || '',
  });

  // Using UserPicker instead of manual query

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, any> = { title: form.title, status: form.status, priority: form.priority };
      if (form.assignee_id) body.assignee_id = form.assignee_id; else body.assignee_id = null;
      if (form.due_date) body.due_date = form.due_date; else body.due_date = null;
      if (form.stage) body.stage = form.stage; else body.stage = null;
      return api.put(`/tasks/${subtask.id}`, body);
    },
    onSuccess: (res) => {
      const updated = res.data?.task || res.data?.data?.task || res.data?.data || res.data;
      onSuccess({ ...subtask, ...updated, ...form });
      toast.success('Subtask updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Subtask</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <UserPicker
            value={form.assignee_id || null}
            onChange={(id) => setForm(f => ({ ...f, assignee_id: id || '' }))}
            label="Assigned To"
            placeholder="Unassigned"
          />
          <div>
            <label className="text-xs text-muted-foreground">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              {BOARD_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Stage</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.title.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {saveMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SubtaskDeleteConfirmProps {
  subtaskId: string;
  subtaskTitle: string;
  onClose: () => void;
  onDeleted: (subtaskId: string) => void;
}

export function SubtaskDeleteConfirm({ subtaskId, subtaskTitle, onClose, onDeleted }: SubtaskDeleteConfirmProps) {
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/tasks/${subtaskId}`),
    onSuccess: () => {
      onDeleted(subtaskId);
      toast.success('Subtask deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
        <h2 className="text-lg font-semibold">Delete Subtask</h2>
        <p className="text-sm text-muted-foreground">Delete "<strong>{subtaskTitle}</strong>"? This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {deleteMut.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SubtaskRowActionsProps {
  subtask: any;
  onEdit: (subtask: any) => void;
  onDelete: (subtask: any) => void;
}

export function SubtaskRowActions({ subtask, onEdit, onDelete }: SubtaskRowActionsProps) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={(e) => { e.stopPropagation(); onEdit(subtask); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit subtask">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(subtask); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete subtask">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
