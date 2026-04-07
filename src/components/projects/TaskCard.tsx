import { TASK_TYPE_CONFIG, PRIORITY_COLORS, type ProjectTask } from '@/lib/projectTypes';

interface TaskCardProps {
  task: ProjectTask;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export default function TaskCard({ task, onClick, draggable, onDragStart }: TaskCardProps) {
  const typeConfig = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;

  return (
    <div
      className="glass-card-hover p-3 space-y-2 cursor-pointer select-none"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {/* Epic chip */}
      {task.epic_name && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: task.epic_color }} />
          <span className="text-[10px] font-medium text-muted-foreground truncate">{task.epic_name}</span>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-2">
        <span className="text-sm flex-shrink-0" title={task.type}>{typeConfig.icon}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-mono text-muted-foreground">{task.task_number}</span>
          <p className="text-sm font-medium leading-tight">{task.title}</p>
        </div>
      </div>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map(l => (
            <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${l.color}22`, color: l.color }}>{l.name}</span>
          ))}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: priorityColor }} title={task.priority} />
          {task.story_points != null && (
            <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{task.story_points} SP</span>
          )}
        </div>
        {/* Assignee avatars */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map(a => (
              <div key={a.id} className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary border-2 border-card" title={a.full_name}>
                {a.full_name?.[0]}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground border-2 border-card">+{task.assignees.length - 3}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
