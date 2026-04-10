import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import { WORKFLOW_STAGES } from '@/lib/projectTypes';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  taskId: string;
  projectId: string;
  currentStage?: string;
  onClose: () => void;
}

export default function HandoffModal({ taskId, projectId, currentStage, onClose }: Props) {
  const qc = useQueryClient();
  const [toStage, setToStage] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [note, setNote] = useState('');

  const { data: stagesRaw } = useQuery({
    queryKey: ['task-stages'],
    queryFn: async () => {
      try {
        const r = await api.get('/tasks/stages');
        return r.data?.stages || WORKFLOW_STAGES;
      } catch { return WORKFLOW_STAGES; }
    },
  });
  const stages: string[] = Array.isArray(stagesRaw) ? stagesRaw : WORKFLOW_STAGES;

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];

  const handoffMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { to_stage: toStage };
      if (assigneeId) payload.assignee_id = assigneeId;
      if (note.trim()) payload.note = note.trim();
      return api.post(`/tasks/${taskId}/handoff`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
      qc.invalidateQueries({ queryKey: ['task-handoffs', taskId] });
      qc.invalidateQueries({ queryKey: ['task-activity', taskId] });
      onClose();
      toast.success('Task handed off');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Handoff failed'),
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hand Off Task</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {currentStage && <p className="text-xs text-muted-foreground">Current stage: <span className="font-semibold text-foreground">{currentStage}</span></p>}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Move to Stage *</label>
          <select value={toStage} onChange={e => setToStage(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Select stage...</option>
            {stages.filter(s => s !== currentStage).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Assign to</label>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">No specific assignee</option>
            {members.map((m: any) => <option key={m.user_id || m.id} value={m.user_id || m.id}>{m.full_name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Design approved, ready for frontend" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => handoffMut.mutate()} disabled={!toStage || handoffMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {handoffMut.isPending ? 'Handing off...' : 'Hand Off'}
          </button>
        </div>
      </div>
    </div>
  );
}
