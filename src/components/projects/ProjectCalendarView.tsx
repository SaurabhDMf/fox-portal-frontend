import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, ListTodo } from 'lucide-react';
import api from '@/lib/api';
import type { ProjectTask } from '@/lib/projectTypes';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
}

type ViewMode = 'week' | 'month';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
  'In Progress': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  Review: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  Done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Calendar view for a project. Groups tasks by due_date and shows them either
 * as a week strip or a full month grid. Only tasks with a due_date show up
 * (everything else is listed in the "Not scheduled" panel on the side).
 */
export default function ProjectCalendarView({ projectId, onTaskClick }: Props) {
  const [view, setView] = useState<ViewMode>('week');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const { data: raw, isLoading } = useQuery({
    queryKey: ['project-all-tasks', { projectId }],
    queryFn: async () => {
      const r = await api.get(`/tasks`, { params: { project_id: projectId } });
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    },
    staleTime: 30_000,
  });
  const tasks: ProjectTask[] = raw ?? [];

  const { scheduled, unscheduled } = useMemo(() => {
    const byDay = new Map<string, ProjectTask[]>();
    const noDate: ProjectTask[] = [];
    for (const t of tasks) {
      const raw = (t as any).due_date;
      if (!raw) { noDate.push(t); continue; }
      const key = String(raw).slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(t);
    }
    return { scheduled: byDay, unscheduled: noDate };
  }, [tasks]);

  // Range: current week (Mon..Sun) or full month grid (Mon-first, 6 rows)
  const range = useMemo<Date[]>(() => {
    if (view === 'week') {
      const day = new Date(cursor);
      const dow = (day.getDay() + 6) % 7; // Monday = 0
      day.setDate(day.getDate() - dow);
      day.setHours(0, 0, 0, 0);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(day);
        d.setDate(day.getDate() + i);
        return d;
      });
    }
    // Month grid starting Monday of the week containing the 1st
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const dow = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - dow);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
  }, [view, cursor]);

  const heading = view === 'week'
    ? `${range[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — ${range[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shift = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setCursor(new Date())} className="px-3 py-1 rounded-md text-xs font-medium hover:bg-secondary">
            Today
          </button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-base font-semibold">{heading}</h3>
        <div className="ml-auto inline-flex rounded-lg bg-secondary p-0.5">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'week' ? 'bg-background shadow' : 'text-muted-foreground'}`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'month' ? 'bg-background shadow' : 'text-muted-foreground'}`}
          >
            Month
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card h-64 animate-pulse" />
      ) : (
        <div className={view === 'month' ? 'grid grid-cols-[1fr_240px] gap-4' : 'grid grid-cols-[1fr_240px] gap-4'}>
          {/* Calendar body */}
          <div className="glass-card p-3">
            {/* Weekday header */}
            <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="px-1">{d}</div>
              ))}
            </div>

            {view === 'week' ? (
              <div className="grid grid-cols-7 gap-2">
                {range.map(d => {
                  const items = scheduled.get(dayKey(d)) || [];
                  const isToday = isSameDay(d, today);
                  return (
                    <div key={d.toISOString()} className={`rounded-lg border p-2 min-h-[280px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/40'}`}>
                      <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-1.5">
                        {items.length === 0 ? (
                          <div className="text-[10px] text-muted-foreground italic">—</div>
                        ) : items.map(t => (
                          <button
                            key={t.id}
                            onClick={() => onTaskClick?.(t)}
                            className={`w-full text-left text-[11px] px-2 py-1.5 rounded border ${STATUS_COLORS[t.status] || 'bg-secondary text-foreground border-border'} hover:brightness-125 transition`}
                          >
                            <div className="line-clamp-2 leading-tight">{t.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 grid-rows-6 gap-1">
                {range.map(d => {
                  const items = scheduled.get(dayKey(d)) || [];
                  const isToday = isSameDay(d, today);
                  const inMonth = d.getMonth() === cursor.getMonth();
                  return (
                    <div
                      key={d.toISOString()}
                      className={`rounded border p-1.5 min-h-[100px] text-xs ${
                        isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/30'
                      } ${!inMonth ? 'opacity-40' : ''}`}
                    >
                      <div className={`text-[11px] font-semibold mb-1 ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map(t => (
                          <button
                            key={t.id}
                            onClick={() => onTaskClick?.(t)}
                            className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate ${STATUS_COLORS[t.status] || 'bg-secondary text-foreground border-border'} hover:brightness-125`}
                            title={t.title}
                          >
                            {t.title}
                          </button>
                        ))}
                        {items.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+ {items.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unscheduled panel */}
          <div className="glass-card p-3 h-fit">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
              <ListTodo className="h-3.5 w-3.5" /> Not scheduled ({unscheduled.length})
            </div>
            {unscheduled.length === 0 ? (
              <div className="text-xs text-muted-foreground italic flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> Every task has a due date
              </div>
            ) : (
              <div className="space-y-1 max-h-[540px] overflow-y-auto">
                {unscheduled.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick?.(t)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded bg-secondary border border-border hover:bg-secondary/80 transition"
                  >
                    <div className="line-clamp-2 leading-tight">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{t.status}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">
              Click any task to set or edit its due date.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
