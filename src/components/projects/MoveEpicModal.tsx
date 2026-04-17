import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Module } from '@/lib/projectTypes';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  epicId: string;
  epicTitle: string;
  currentModuleId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveEpicModal({ projectId, epicId, epicTitle, currentModuleId, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [selectedModuleId, setSelectedModuleId] = useState<string>(currentModuleId || '');

  const { data: modulesRaw, isLoading } = useQuery({
    queryKey: ['project-modules-all', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/modules`)
        .then(r => extractProjectArray<Module>(r.data, ['modules', 'epics'])),
  });
  const modules: Module[] = Array.isArray(modulesRaw) ? modulesRaw : [];

  const moveMut = useMutation({
    mutationFn: () => {
      const target = modules.find(m => m.id === selectedModuleId);
      if (!target) throw new Error('Select a module');
      const payload: Record<string, any> = { module_id: target.id };
      if (target.sprint_id) payload.sprint_id = target.sprint_id;
      return api.put(`/projects/${projectId}/epics/${epicId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['project-modules', projectId] });
      toast.success('Epic moved');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to move epic'),
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Move Epic</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <p className="text-sm text-muted-foreground">
          Move <span className="font-medium text-foreground">"{epicTitle}"</span> to a different module. The epic's sprint will follow the target module.
        </p>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Target Module</label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading modules…</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No modules available in this project.</p>
          ) : (
            <select
              value={selectedModuleId}
              onChange={e => setSelectedModuleId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a module…</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>
                  {m.title}{m.sprint_name ? ` — ${m.sprint_name}` : ''}{m.id === currentModuleId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button
            onClick={() => moveMut.mutate()}
            disabled={!selectedModuleId || selectedModuleId === currentModuleId || moveMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {moveMut.isPending ? 'Moving…' : 'Move Epic'}
          </button>
        </div>
      </div>
    </div>
  );
}
