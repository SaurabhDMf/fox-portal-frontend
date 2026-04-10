import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectTask } from '@/lib/projectTypes';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
  onCreateTask?: () => void;
}

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Review', 'Done', 'Cancelled'];
const TYPE_FILTERS = ['All', 'Story', 'Task', 'Bug', 'Subtask'];

export default function TasksListView({ projectId, onTaskClick, onCreateTask }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const { data: tasksRaw, isLoading } = useQuery({
    queryKey: ['project-all-tasks', projectId],
    queryFn: async () => {
      const r = await api.get('/tasks', { params: { project_id: projectId } });
      return extractProjectArray<ProjectTask>(r.data, ['tasks']);
    },
  });
  const allTasks: ProjectTask[] = Array.isArray(tasksRaw) ? tasksRaw : [];

  const filtered = allTasks.filter(t => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (typeFilter !== 'All' && t.type !== typeFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.task_number?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none">
          {TYPE_FILTERS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
      </div>

      {/* Task List */}
      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading tasks…</p>}

      <div className="space-y-1">
        {filtered.map(task => {
          const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
          const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
          return (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <span className="text-sm">{tc.icon}</span>
              <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0">{task.task_number}</span>
              <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
              {task.epic_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded hidden sm:inline" style={{ background: `${task.epic_color || '#888'}22`, color: task.epic_color || '#888' }}>{task.epic_name}</span>
              )}
              {task.sprint_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground hidden sm:inline">{task.sprint_name}</span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{task.status}</span>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} title={task.priority} />
              {task.assignees && task.assignees.length > 0 ? (
                <div className="flex -space-x-1">
                  {task.assignees.slice(0, 3).map(a => (
                    <div key={a.id} className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary border border-card">{a.full_name?.[0]}</div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">—</span>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-2">{search || statusFilter !== 'All' || typeFilter !== 'All' ? 'No tasks match your filters' : 'No tasks yet'}</p>
          {onCreateTask && <button onClick={onCreateTask} className="text-sm text-primary hover:underline">Create a task →</button>}
        </div>
      )}
    </div>
  );
}