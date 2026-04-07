export interface ProjectTask {
  id: string;
  task_number: string;
  title: string;
  description?: string;
  type: 'Story' | 'Task' | 'Bug' | 'Subtask';
  status: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  assignees?: { id: string; full_name: string; avatar_url?: string }[];
  assignee_ids?: string[];
  reporter?: { id: string; full_name: string };
  epic_id?: string;
  epic_name?: string;
  epic_color?: string;
  sprint_id?: string;
  sprint_name?: string;
  labels?: { id: string; name: string; color: string }[];
  label_ids?: string[];
  story_points?: number;
  due_date?: string;
  estimate_hours?: number;
  logged_hours?: number;
  parent_task_id?: string;
  subtasks?: ProjectTask[];
  watchers_count?: number;
  is_watching?: boolean;
  comments_count?: number;
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

export interface Epic {
  id: string;
  title: string;
  color: string;
  start_date?: string;
  due_date?: string;
  progress?: number;
  task_count?: number;
  done_count?: number;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  role: 'lead' | 'member' | 'viewer';
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
