import type { ProjectTask } from './projectTypes';

/**
 * Compute a hierarchical "1", "1.1", "1.1.1" number for every task in a
 * project's task list, anchored to the unfiltered set so numbers stay stable
 * regardless of which filters are active.
 *
 * Rules:
 * - Root tasks (no parent_task_id, or parent not in this list) are sorted by
 *   created_at ascending and numbered 1, 2, 3...
 * - Children of each parent are sorted by created_at ascending and appended as
 *   `<parent>.1`, `<parent>.2`, ...
 * - Tasks that don't appear in the input map are not numbered (caller falls
 *   back to the original task_number).
 */
export function computeHierarchicalNumbers(allTasks: ProjectTask[]): Map<string, string> {
  const result = new Map<string, string>();
  if (!allTasks?.length) return result;

  const idSet = new Set(allTasks.map(t => t.id));
  const childrenByParent = new Map<string, ProjectTask[]>();
  const roots: ProjectTask[] = [];

  for (const t of allTasks) {
    const pid = (t as any).parent_task_id as string | undefined;
    if (pid && idSet.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(t);
    } else {
      roots.push(t);
    }
  }

  const sortByCreated = (a: ProjectTask, b: ProjectTask) => {
    const av = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bv = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (av !== bv) return av - bv;
    // Stable tiebreaker on id so ordering is deterministic.
    return String(a.id).localeCompare(String(b.id));
  };

  roots.sort(sortByCreated);
  for (const kids of childrenByParent.values()) kids.sort(sortByCreated);

  const walk = (task: ProjectTask, prefix: string) => {
    result.set(task.id, prefix);
    const kids = childrenByParent.get(task.id);
    if (!kids?.length) return;
    kids.forEach((k, i) => walk(k, `${prefix}.${i + 1}`));
  };

  roots.forEach((r, i) => walk(r, String(i + 1)));
  return result;
}
