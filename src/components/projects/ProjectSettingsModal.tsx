import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onClose: () => void;
}

const PRESET_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6B7280'];

export default function ProjectSettingsModal({ projectId, onClose }: Props) {
  const [tab, setTab] = useState<'statuses' | 'stages'>('statuses');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Settings</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 border-b border-border">
          {(['statuses', 'stages'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'statuses' && <StatusesSection projectId={projectId} />}
        {tab === 'stages' && <StagesSection projectId={projectId} />}
      </div>
    </div>
  );
}

const DEFAULT_STATUSES = [
  { name: 'Open', color: '#6B7280', isDefault: true },
  { name: 'In Progress', color: '#3B82F6', isDefault: true },
  { name: 'Review', color: '#F59E0B', isDefault: true },
  { name: 'Done', color: '#10B981', isDefault: true },
  { name: 'Cancelled', color: '#EF4444', isDefault: true },
];

function StatusesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '' });

  const { data: statusesRaw } = useQuery({
    queryKey: ['project-custom-statuses', projectId],
    queryFn: () => api.get(`/projects/${projectId}/statuses`).then(r => {
      const d = r.data;
      const list = d?.statuses || d?.data?.statuses || d?.data || d;
      return Array.isArray(list) ? list : [];
    }),
  });
  const customStatuses = Array.isArray(statusesRaw) ? statusesRaw : [];

  // Merge: defaults first, then any custom ones not already in defaults
  const defaultNames = new Set(DEFAULT_STATUSES.map(d => d.name.toLowerCase()));
  const allStatuses = [
    ...DEFAULT_STATUSES,
    ...customStatuses
      .filter((s: any) => !defaultNames.has((s.name || s.label || '').toLowerCase()))
      .map((s: any) => ({ name: s.name || s.label, color: s.color || '#6B7280', isDefault: false, id: s.id })),
  ];

  const addMut = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/statuses`, { name: newName, color: newColor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-statuses', projectId] }); setNewName(''); toast.success('Status added'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/projects/${projectId}/statuses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-statuses', projectId] }); setEditingId(null); toast.success('Updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/statuses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-statuses', projectId] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Manage custom task statuses for this project.</p>
      <div className="space-y-1">
        {allStatuses.map((s: any) => {
          const id = s.id || s.name;
          const isEditing = editingId === id;

          if (isEditing) {
            return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary">
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 px-2 py-1 rounded bg-background border border-border text-sm" />
                <div className="flex gap-1">{PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                    className={`w-5 h-5 rounded-full border-2 ${editForm.color === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />
                ))}</div>
                <button onClick={() => updateMut.mutate({ id, name: editForm.name, color: editForm.color })}
                  className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Save</button>
                <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-secondary text-xs">✕</button>
              </div>
            );
          }

          return (
            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 group">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-sm flex-1">{s.name}</span>
              {!s.isDefault && (
                <>
                  <button onClick={() => { setEditingId(id); setEditForm({ name: s.name, color: s.color }); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => deleteMut.mutate(id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50">
          <span className="w-3 h-3 rounded-full flex-shrink-0 border border-border" style={{ background: newColor }} />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add new status..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addMut.mutate(); }} />
          <div className="flex gap-1">{PRESET_COLORS.slice(0, 5).map(c => (
            <button key={c} onClick={() => setNewColor(c)}
              className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />
          ))}</div>
          <button onClick={() => addMut.mutate()} disabled={!newName.trim()}
            className="p-1 rounded bg-primary text-primary-foreground disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StagesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '' });

  const { data: stagesRaw } = useQuery({
    queryKey: ['project-custom-stages', projectId],
    queryFn: () => api.get(`/projects/${projectId}/stages`).then(r => {
      const d = r.data;
      const list = d?.stages || d?.data?.stages || d?.data || d;
      return Array.isArray(list) ? list : [];
    }),
  });
  const stages = Array.isArray(stagesRaw) ? stagesRaw : [];

  const addMut = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/stages`, { name: newName, color: newColor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-stages', projectId] }); setNewName(''); toast.success('Stage added'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/projects/${projectId}/stages/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-stages', projectId] }); setEditingId(null); toast.success('Updated'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/stages/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-custom-stages', projectId] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Manage workflow stages for this project. Stages appear as colored pills on tasks.</p>
      <div className="space-y-1">
        {stages.map((s: any) => {
          const id = s.id || s.name;
          const name = s.name || s.label || s;
          const color = s.color || '#6B7280';
          if (editingId === id) {
            return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary">
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="flex-1 px-2 py-1 rounded bg-background border border-border text-sm" />
                <div className="flex gap-1">{PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} className={`w-5 h-5 rounded-full border-2 ${editForm.color === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />
                ))}</div>
                <button onClick={() => updateMut.mutate({ id, name: editForm.name, color: editForm.color })} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Save</button>
                <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-secondary text-xs">✕</button>
              </div>
            );
          }
          return (
            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 group">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: color }}>{typeof name === 'string' ? name : ''}</span>
              <div className="flex-1" />
              <button onClick={() => { setEditingId(id); setEditForm({ name: typeof name === 'string' ? name : '', color }); }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => deleteMut.mutate(id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New stage name" className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm" />
        <div className="flex gap-1">{PRESET_COLORS.slice(0, 5).map(c => (
          <button key={c} onClick={() => setNewColor(c)} className={`w-5 h-5 rounded-full border-2 ${newColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />
        ))}</div>
        <button onClick={() => addMut.mutate()} disabled={!newName.trim()} className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
