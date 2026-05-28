export interface ProjectTask {
  id: string;
  task_number: string;
  title: string;
  description?: string;
  type: 'Story' | 'Task' | 'Bug' | 'Subtask';
  status: string;
  /** The current viewer's personal status on this task (from task_assignees.status). Falls back to `status` if absent. */
  my_status?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  stage?: string;
  assignees?: { id: string; full_name: string; avatar_url?: string; personal_status?: string }[];
  assignee_ids?: string[];
  reporter?: { id: string; full_name: string };
  // Legacy "Module" field — historically called epic_id on the backend (now backed by /modules)
  epic_id?: string;
  epic_name?: string;
  epic_color?: string;
  // New "Epic" layer (project_epics table) — sits between Module and Task
  project_epic_id?: string;
  project_epic_title?: string;
  project_epic_color?: string;
  project_module_id?: string;
  project_module_title?: string;
  sprint_id?: string;
  sprint_name?: string;
  client_name?: string;
  labels?: { id: string; name: string; color: string }[];
  label_ids?: string[];
  story_points?: number;
  due_date?: string;
  estimate_hours?: number;
  logged_hours?: number;
  parent_task_id?: string;
  subtasks?: ProjectTask[];
  tasks?: ProjectTask[];
  watchers_count?: number;
  is_watching?: boolean;
  comments_count?: number;
  attachments?: { id: string; file_name: string; file_url: string; file_type?: string; uploaded_by?: string; created_at?: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: 'Planned' | 'Active' | 'Completed';
  start_date?: string;
  end_date?: string;
  task_count?: number;
  done_count?: number;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  color: string;
  status?: string;
  sprint_id?: string;
  sprint_name?: string;
  owner_id?: string;
  owner_name?: string;
  owner_avatar?: string;
  start_date?: string;
  due_date?: string;
  task_count?: number;
  done_count?: number;
  total_tasks?: number;
  done_tasks?: number;
  open_tasks?: number;
  progress?: number;
}

export interface Epic {
  id: string;
  title: string;
  color: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  start_date?: string;
  due_date?: string;
  progress?: number;
  task_count?: number;
  done_count?: number;
  module_id?: string;
  module_title?: string;
  module_color?: string;
  sprint_id?: string;
  sprint_name?: string;
  total_tasks?: number;
  done_tasks?: number;
  open_tasks?: number;
  stories?: ProjectTask[];
}

export interface ProjectMember {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  role: string;
  user_role?: string;
  project_role?: string;
  can_create_tasks?: boolean;
  visible_to_client?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress?: number;
  color?: string;
  client_id?: string;
  client_name?: string;
  start_date?: string;
  due_date?: string;
  active_sprint_name?: string;
  open_task_count?: number;
  members?: ProjectMember[];
}

export const TASK_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  Story: { icon: '📖', color: 'hsl(157 87% 46%)' },
  Task: { icon: '✅', color: 'hsl(213 100% 62%)' },
  Bug: { icon: '🐛', color: 'hsl(4 100% 64%)' },
  Subtask: { icon: '↳', color: 'hsl(220 10% 50%)' },
};

export const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'hsl(4 100% 64%)',
  High: 'hsl(35 100% 63%)',
  Medium: 'hsl(213 100% 62%)',
  Low: 'hsl(220 10% 50%)',
};

export const BOARD_COLUMNS = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

export const WORKFLOW_STAGES = ['Design', 'Development', 'Integration', 'Testing', 'Done'];
