import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// Project-level status (Active/On Hold/Completed/Cancelled), not to be confused
// with useProjectOptions' per-project task-board statuses. Mirrors CRM's
// lead custom-fields pattern.
const DEFAULT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'];

export function useCustomProjectStatuses(userId: string | undefined) {
  const storageKey = `project-custom-statuses-${userId || 'default'}`;

  const { data: remoteStatuses } = useQuery({
    queryKey: ['project-custom-statuses-list', userId],
    queryFn: () => api.get('/projects/custom-statuses').then(r => r.data?.statuses || []).catch(() => null),
    enabled: !!userId,
    retry: false,
  });

  const getLocal = (): string[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  };

  const [local, setLocal] = useState<string[]>(getLocal);

  useEffect(() => {
    if (remoteStatuses) {
      setLocal(remoteStatuses);
      localStorage.setItem(storageKey, JSON.stringify(remoteStatuses));
    }
  }, [remoteStatuses, storageKey]);

  const allStatuses = Array.from(new Set([...DEFAULT_STATUSES, ...local]));

  const addStatus = async (value: string) => {
    const v = value.trim();
    if (!v || allStatuses.includes(v)) return;
    const updated = [...local, v];
    setLocal(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    try { await api.post('/projects/custom-statuses', { value: v }); } catch {}
  };

  const removeStatus = async (value: string) => {
    if (DEFAULT_STATUSES.includes(value)) return;
    const updated = local.filter(s => s !== value);
    setLocal(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    try { await api.delete('/projects/custom-statuses', { data: { value } }); } catch {}
  };

  return { allStatuses, addStatus, removeStatus };
}
