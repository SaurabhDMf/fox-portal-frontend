import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { dummyEpics } from '@/lib/projectDummyData';
import type { Epic } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function EpicsView({ projectId }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', color: '#3B82F6', start_date: '', due_date: '' });
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);

  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => api.get(`/projects/${projectId}/epics`).then(r => r.data?.epics || r.data || []),
  });
  const epics: Epic[] = Array.isArray(epicsRaw) && epicsRaw.length > 0 ? epicsRaw : dummyEpics;

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post(`/projects/${projectId}/epics`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-epics', projectId] }); setShowCreate(false); setForm({ title: '', color: '#3B82F6', start_date: '', due_date: '' }); toast.success('Epic created'); },
    onError: () => toast.error('Error creating epic'),
  });

  // Timeline calculation
  const allDates = epics.flatMap(e => [e.start_date, e.due_date].filter(Boolean)).map(d => new Date(d!).getTime());
  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = allDates.length > 0 ? Math.max(...allDates) : Date.now() + 86400000 * 90;
  const range = maxDate - minDate || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Epics Timeline</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-3 w-3" /> New Epic
        </button>
      </div>

      {/* Timeline */}
      <div className="glass-card p-4 space-y-3">
        {epics.map(epic => {
          const start = epic.start_date ? new Date(epic.start_date).getTime() : minDate;
          const end = epic.due_date ? new Date(epic.due_date).getTime() : maxDate;
          const left = ((start - minDate) / range) * 100;
          const width = Math.max(((end - start) / range) * 100, 5);

          return (
            <div key={epic.id} className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 transition-colors" onClick={() => setSelectedEpic(epic)}>
              <div className="w-40 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: epic.color }} />
                  <span className="text-sm font-medium truncate">{epic.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{epic.done_count || 0}/{epic.task_count || 0} tasks</span>
              </div>
              <div className="flex-1 relative h-8">
                <div className="absolute inset-0 bg-secondary rounded-full" />
                <div
                  className="absolute top-0 h-full rounded-full flex items-center justify-end px-2"
                  style={{ left: `${left}%`, width: `${width}%`, background: epic.color, opacity: 0.8 }}
                >
                  <span className="text-[10px] font-bold text-white">{epic.progress || 0}%</span>
                </div>
              </div>
            </div>
          );
        })}
        {epics.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No epics yet</p>}
      </div>

      {/* Epic side panel */}
      {selectedEpic && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: selectedEpic.color }} />
              <h3 className="font-semibold">{selectedEpic.title}</h3>
            </div>
            <button onClick={() => setSelectedEpic(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground text-xs">Progress</span><p className="font-semibold">{selectedEpic.progress || 0}%</p></div>
            <div><span className="text-muted-foreground text-xs">Tasks</span><p className="font-semibold">{selectedEpic.done_count || 0}/{selectedEpic.task_count || 0}</p></div>
            <div><span className="text-muted-foreground text-xs">Due</span><p className="font-semibold">{selectedEpic.due_date ? new Date(selectedEpic.due_date).toLocaleDateString() : '—'}</p></div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Epic</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Epic title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={!form.title || createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Epic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
