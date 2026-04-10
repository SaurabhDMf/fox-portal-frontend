import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectTask } from '@/lib/projectTypes';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
  onCreateTask?: () => void;
}

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const getAssignedTo = (task: ProjectTask) => {
  if (!task.assignees?.length) return '—';
  return task.assignees.map((assignee) => assignee.full_name).filter(Boolean).join(', ');
};

const getClassification = (task: ProjectTask) => {
  const values = [task.type, task.epic_name, task.sprint_name].filter(Boolean);
  return values.length > 0 ? values.join(' / ') : task.type || '—';
};

export default function TasksListView({ projectId, onTaskClick, onCreateTask }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: tasksRaw, isLoading } = useQuery({
    queryKey: ['project-all-tasks', projectId],
    queryFn: async () => {
      const r = await api.get('/tasks', { params: { project_id: projectId } });
      return extractProjectArray<ProjectTask>(r.data, ['tasks']);
    },
  });
  const allTasks: ProjectTask[] = Array.isArray(tasksRaw) ? tasksRaw : [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allTasks.filter((task) => {
      if (statusFilter !== 'All' && task.status !== statusFilter) return false;
      if (!query) return true;

      return [
        task.title,
        task.task_number,
        task.priority,
        task.status,
        task.type,
        task.epic_name,
        task.sprint_name,
        task.assignees?.map((assignee) => assignee.full_name).join(' '),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [allTasks, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none">
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task name</TableHead>
              <TableHead>Created date</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stories / Epic / Sprint</TableHead>
              <TableHead>Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Loading tasks…</TableCell>
              </TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(task => (
                <TableRow key={task.id} className="cursor-pointer" onClick={() => onTaskClick?.(task)}>
                  <TableCell>
                    <div className="min-w-[220px]">
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.task_number || task.type}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(task.created_at)}</TableCell>
                  <TableCell>{getAssignedTo(task)}</TableCell>
                  <TableCell>{formatDate(task.due_date)}</TableCell>
                  <TableCell>{task.priority || '—'}</TableCell>
                  <TableCell>{task.status || '—'}</TableCell>
                  <TableCell>{getClassification(task)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTaskClick?.(task);
                      }}
                      className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors"
                    >
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {search || statusFilter !== 'All' ? 'No tasks match your filters' : 'No tasks yet'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}