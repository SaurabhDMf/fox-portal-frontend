import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectTask } from '@/lib/projectTypes';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
  onCreateTask?: () => void;
}

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

const fmtDate = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

export default function TasksListView({ projectId, onTaskClick, onCreateTask }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: raw, isLoading } = useQuery({
    queryKey: ['project-all-tasks', projectId],
    queryFn: async () => {
      const r = await api.get('/tasks', { params: { project_id: projectId } });
      return extractProjectArray<ProjectTask>(r.data, ['tasks']);
    },
    placeholderData: keepPreviousData,
  });
  const tasks: ProjectTask[] = Array.isArray(raw) ? raw : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (!q) return true;
      return [t.title, t.task_number, t.priority, t.status, t.type, t.epic_name, t.sprint_name,
        (t as any).assignee_name, (t as any).story_title,
        t.assignees?.map(a => a.full_name).join(' ')]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [tasks, search, statusFilter]);

  const assigneeDisplay = (t: ProjectTask) => {
    const name = (t as any).assignee_name || t.assignees?.[0]?.full_name;
    if (!name) return '—';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[120px]">{name}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          All Tasks <span className="text-xs font-normal">({filtered.length})</span>
        </h3>
        {onCreateTask && (
          <button onClick={onCreateTask} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3 w-3" /> Create Task
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none">
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Story</TableHead>
              <TableHead>Epic</TableHead>
              <TableHead>Sprint</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">Loading tasks…</TableCell></TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(t => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => onTaskClick?.(t)}>
                  <TableCell>
                    <div className="min-w-[180px]">
                      <p className="font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.task_number || ''}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{t.type || '—'}</TableCell>
                  <TableCell className="text-xs">{(t as any).stage || '—'}</TableCell>
                  <TableCell className="text-xs">{t.status || '—'}</TableCell>
                  <TableCell className="text-xs">{t.priority || '—'}</TableCell>
                  <TableCell className="text-xs">{assigneeDisplay(t)}</TableCell>
                  <TableCell className="text-xs">{(t as any).story_title || (t as any).parent_task_title || '—'}</TableCell>
                  <TableCell className="text-xs">{t.epic_name || (t as any).epic_title || '—'}</TableCell>
                  <TableCell className="text-xs">{t.sprint_name || (t as any).sprint_title || '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(t.due_date)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(t.created_at)}</TableCell>
                  <TableCell>
                    <button type="button" onClick={e => { e.stopPropagation(); onTaskClick?.(t); }}
                      className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors">
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                {search || statusFilter !== 'All' ? 'No tasks match your filters' : 'No tasks yet'}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
