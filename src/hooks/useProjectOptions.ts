import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { WORKFLOW_STAGES, BOARD_COLUMNS } from '@/lib/projectTypes';

const DEFAULT_STATUSES = [...BOARD_COLUMNS];
const DEFAULT_STAGES = [...WORKFLOW_STAGES];

export function useProjectStatuses(projectId: string) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['project-custom-statuses', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/statuses`);
        const list = r.data?.statuses || r.data?.data?.statuses || r.data?.data || r.data;
        if (Array.isArray(list) && list.length > 0) return list.map((s: any) => typeof s === 'string' ? s : s.name || s.label || s.status);
      } catch {}
      return DEFAULT_STATUSES;
    },
    staleTime: 120_000,
  });

  const statuses: string[] = Array.isArray(data) && data.length > 0 ? data : DEFAULT_STATUSES;

  const addStatus = useMutation({
    mutationFn: async (name: string) => {
      try {
        await api.post(`/projects/${projectId}/statuses`, { name });
      } catch {
        // If endpoint doesn't exist, just add locally
      }
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['project-custom-statuses', projectId] });
      qc.setQueryData(['project-custom-statuses', projectId], (old: string[] | undefined) => {
        const prev = Array.isArray(old) && old.length > 0 ? old : DEFAULT_STATUSES;
        return prev.includes(name) ? prev : [...prev, name];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project-custom-statuses', projectId] }),
  });

  return { statuses, addStatus: addStatus.mutate };
}

export function useProjectStages(projectId: string) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['project-custom-stages', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/stages`);
        const list = r.data?.stages || r.data?.data?.stages || r.data?.data || r.data;
        if (Array.isArray(list) && list.length > 0) return list.map((s: any) => typeof s === 'string' ? s : s.name || s.label || s.stage);
      } catch {}
      return DEFAULT_STAGES;
    },
    staleTime: 120_000,
  });

  const stages: string[] = Array.isArray(data) && data.length > 0 ? data : DEFAULT_STAGES;

  const addStage = useMutation({
    mutationFn: async (name: string) => {
      try {
        await api.post(`/projects/${projectId}/stages`, { name });
      } catch {
        // If endpoint doesn't exist, just add locally
      }
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['project-custom-stages', projectId] });
      qc.setQueryData(['project-custom-stages', projectId], (old: string[] | undefined) => {
        const prev = Array.isArray(old) && old.length > 0 ? old : DEFAULT_STAGES;
        return prev.includes(name) ? prev : [...prev, name];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project-custom-stages', projectId] }),
  });

  return { stages, addStage: addStage.mutate };
}
