
## Jira Hierarchy Implementation Plan

### Current State
- Task types exist: Feature, Bug, Task, Story, Subtask
- Epics, Sprints, Backlog views exist
- Tasks can have `epic_id` and `sprint_id`
- Subtasks have `parent_task_id`

### Changes Needed

#### 1. Update Task Type Labels
- Rename "Feature" → keep as optional or merge into Story
- Ensure types match Jira: **Story, Task, Bug, Sub-task**
- Update `TASK_TYPE_CONFIG` in `projectTypes.ts`

#### 2. Epic → Story/Task/Bug linking
- When creating a task, allow selecting a parent Epic
- Epics view should show child Stories/Tasks/Bugs underneath
- Backlog should group tasks by Epic (already done)

#### 3. Sub-task support
- When viewing a Story/Task/Bug, allow creating Sub-tasks under it
- Sub-tasks show nested under their parent in backlog & board
- TaskDetailDrawer already has subtasks section — ensure create works

#### 4. Sprint as container
- Sprint view shows tasks assigned to it (fetch sprint tasks from API)
- Backlog view: drag tasks into sprints (already done)
- Board filters by active sprint automatically

#### 5. CreateTaskModal improvements
- Add Epic selector dropdown
- Add Sprint selector dropdown
- Add Parent Task selector (for sub-tasks)
- Type defaults to "Story" instead of "Task"

#### 6. Board view
- Filter board by active sprint by default
- Show sprint selector to switch between sprints

### Files to modify
- `src/lib/projectTypes.ts` — update types & config
- `src/components/projects/CreateTaskModal.tsx` — add epic/sprint/parent selectors
- `src/components/projects/KanbanBoard.tsx` — sprint filter
- `src/components/projects/SprintsView.tsx` — show sprint tasks
- `src/components/projects/EpicsView.tsx` — show epic children
- `src/components/projects/TaskDetailDrawer.tsx` — subtask creation
- `src/components/projects/BacklogView.tsx` — minor hierarchy tweaks
