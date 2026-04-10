import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { BOARD_COLUMNS, type ProjectTask } from '@/lib/projectTypes';
import { extractProjectArray, extractProjectBoard } from '@/lib/projectResponse';

import TaskCard from './TaskCard';
import { useState } from 'react';
import { Plus, Play } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick: (task: ProjectTask) => void;
  onCreateTask: (status?: string) => void;
}

export default function KanbanBoard({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const [draggedTask, setDraggedTask] = useState<ProjectTask | null>(null);

  const { data: sprintsData } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray(r.data, ['sprints'])),
  });
  const sprints = Array.isArray(sprintsData) ? sprintsData : [];
  const [selectedSprint, setSelectedSprint] = useState<string>('');

  const { data: boardData, isLoading } = useQuery({
    queryKey: ['project-board', projectId, selectedSprint],
    queryFn: () => api.get(`/projects/${projectId}/board`, { params: selectedSprint ? { sprint_id: selectedSprint } : {} }).then(r => extractProjectBoard(r.data)),
  });

  const rawBoard = extractProjectBoard(boardData);
  const board: Record<string, ProjectTask[]> = {};
  BOARD_COLUMNS.forEach(col => { board[col] = rawBoard[col] || []; });

  const updateTaskMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => api.put(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-board', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['sprint-hierarchy', projectId] });
      toast.success('Task moved');
    },
    onError: () => toast.error('Failed to move task'),
  });

  const startSprintMut = useMutation({
    mutationFn: (sprintId: string) => api.post(`/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-sprints', projectId] }); toast.success('Sprint started'); },
  });

  const handleDrop = (status: string) => {
    if (draggedTask && draggedTask.status !== status) {
      updateTaskMut.mutate({ taskId: draggedTask.id, status });
    }
    setDraggedTask(null);
  };

  const activeSprint = sprints.find((s: any) => s.status === 'Active');

  return (
    <div className="space-y-4">
      {/* Sprint selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedSprint}
          onChange={e => setSelectedSprint(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">{activeSprint ? activeSprint.name : 'All Sprints'}</option>
          {sprints.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
        {sprints.filter((s: any) => s.status === 'Planned').map((s: any) => (
          <button key={s.id} onClick={() => startSprintMut.mutate(s.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
            <Play className="h-3 w-3" /> Start {s.name}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        {BOARD_COLUMNS.map(col => {
          const tasks = board[col] || [];
          return (
            <div
              key={col}
              className="min-w-[260px] w-[260px] flex-shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col}</h3>
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">{tasks.length}</span>
                </div>
                <button onClick={() => onCreateTask(col)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {isLoading ? [...Array(2)].map((_, i) => <div key={i} className="glass-card h-24 animate-pulse" />) :
                  tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                      draggable
                      onDragStart={() => setDraggedTask(task)}
                    />
                  ))
                }
                {tasks.length === 0 && !isLoading && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">Drop tasks here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
