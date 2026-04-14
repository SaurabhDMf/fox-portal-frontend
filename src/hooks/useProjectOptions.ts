import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { WORKFLOW_STAGES, BOARD_COLUMNS } from '@/lib/projectTypes';

export interface StatusOption {
  name: string;
  color: string;
  category?: 'todo' | 'in_progress' | 'done';
}

export interface StageOption {
  name: string;
  color: string;
}

const DEFAULT_STATUS_OBJECTS: StatusOption[] = BOARD_COLUMNS.map(name => ({ name, color: getDefaultStatusColor(name) }));
const DEFAULT_STAGE_OBJECTS: StageOption[] = WORKFLOW_STAGES.map(name => ({ name, color: getDefaultStageColor(name) }));

function getDefaultStatusColor(name: string): string {
  const map: Record<string, string> = {
    'Open': '#6B7280', 'In Progress': '#3B82F6', 'Review': '#F59E0B', 'Done': '#10B981', 'Cancelled': '#EF4444',
  };
  return map[name] || '#6B7280';
}

function getDefaultStageColor(name: string): string {
  const map: Record<string, string> = {
    'Design': '#8B5CF6', 'Development': '#3B82F6', 'Integration': '#06B6D4', 'Testing': '#F59E0B', 'Done': '#10B981',
  };
  return map[name] || '#6B7280';
}

function normalizeOptions(list: any[], defaults: { name: string; color: string }[]): { name: string; color: string; category?: 'todo' | 'in_progress' | 'done' }[] {
  // Always start with the predefined defaults
  const merged = [...defaults];
  if (!Array.isArray(list) || list.length === 0) return merged;

  // Add any custom statuses that aren't already in defaults
  const defaultNames = new Set(defaults.map(d => d.name.toLowerCase()));
  for (const s of list) {
    const name = typeof s === 'string' ? s : (s.name || s.label || s.status || s.stage || '');
    if (!name || defaultNames.has(name.toLowerCase())) continue;
    const color = typeof s === 'string' ? '#6B7280' : (s.color || '#6B7280');
    merged.push({ name, color, category: s?.category });
  }
  return merged;
}

export function useProjectStatuses(projectId: string) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['project-custom-statuses', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/statuses`);
        const list = r.data?.statuses || r.data?.data?.statuses || r.data?.data || r.data;
        if (Array.isArray(list) && list.length > 0) return normalizeOptions(list, DEFAULT_STATUS_OBJECTS);
      } catch {}
      return DEFAULT_STATUS_OBJECTS;
    },
    staleTime: 120_000,
  });

  const statusObjects: StatusOption[] = Array.isArray(data) && data.length > 0 ? data : DEFAULT_STATUS_OBJECTS;
  const statuses: string[] = statusObjects.map(s => s.name);

  const addStatus = useMutation({
    mutationFn: async (name: string) => {
      try { await api.post(`/projects/${projectId}/statuses`, { name }); } catch {}
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['project-custom-statuses', projectId] });
      qc.setQueryData(['project-custom-statuses', projectId], (old: StatusOption[] | undefined) => {
        const prev = Array.isArray(old) && old.length > 0 ? old : DEFAULT_STATUS_OBJECTS;
        if (prev.find(s => s.name === name)) return prev;
        return [...prev, { name, color: '#6B7280' }];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project-custom-statuses', projectId] }),
  });

  return { statuses, statusObjects, addStatus: addStatus.mutate };
}

export function useProjectStages(projectId: string) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['project-custom-stages', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/stages`);
        const list = r.data?.stages || r.data?.data?.stages || r.data?.data || r.data;
        if (Array.isArray(list) && list.length > 0) return normalizeOptions(list, DEFAULT_STAGE_OBJECTS);
      } catch {}
      return DEFAULT_STAGE_OBJECTS;
    },
    staleTime: 120_000,
  });

  const stageObjects: StageOption[] = Array.isArray(data) && data.length > 0 ? data : DEFAULT_STAGE_OBJECTS;
  const stages: string[] = stageObjects.map(s => s.name);

  const addStage = useMutation({
    mutationFn: async (name: string) => {
      try { await api.post(`/projects/${projectId}/stages`, { name }); } catch {}
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['project-custom-stages', projectId] });
      qc.setQueryData(['project-custom-stages', projectId], (old: StageOption[] | undefined) => {
        const prev = Array.isArray(old) && old.length > 0 ? old : DEFAULT_STAGE_OBJECTS;
        if (prev.find(s => s.name === name)) return prev;
        return [...prev, { name, color: '#6B7280' }];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project-custom-stages', projectId] }),
  });

  return { stages, stageObjects, addStage: addStage.mutate };
}
