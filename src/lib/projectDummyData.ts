import type { Project, ProjectTask, Sprint, Epic, ProjectMember } from './projectTypes';

export const dummyProjectsEnhanced: Project[] = [
  { id: 'p1', name: 'TechCorp Web Platform', description: 'Full-stack web application with React & Node.js', status: 'Active', priority: 'High', progress: 65, color: '#3B82F6', client_name: 'TechCorp India', due_date: '2026-06-15', start_date: '2026-01-10', active_sprint_name: 'Sprint 4', open_task_count: 12, members: [{ id: 'm1', user_id: 'u1', full_name: 'Neha Kapoor', role: 'lead' }, { id: 'm2', user_id: 'u5', full_name: 'Priya Singh', role: 'member' }, { id: 'm3', user_id: 'u6', full_name: 'Vikram Joshi', role: 'member' }] },
  { id: 'p2', name: 'Global Retail Mobile App', description: 'Cross-platform mobile app for inventory management', status: 'Active', priority: 'Critical', progress: 30, color: '#EF4444', client_name: 'Global Retail Inc', due_date: '2026-08-01', start_date: '2026-03-01', active_sprint_name: 'Sprint 2', open_task_count: 24, members: [{ id: 'm4', user_id: 'u2', full_name: 'Rahul Mehta', role: 'lead' }, { id: 'm5', user_id: 'u7', full_name: 'Sneha Reddy', role: 'member' }] },
  { id: 'p3', name: 'Dubai Logistics Dashboard', description: 'Real-time analytics dashboard with live tracking', status: 'On Hold', priority: 'Medium', progress: 80, color: '#F59E0B', client_name: 'Dubai Logistics LLC', due_date: '2026-05-20', start_date: '2026-02-01', open_task_count: 4, members: [{ id: 'm6', user_id: 'u5', full_name: 'Priya Singh', role: 'lead' }] },
  { id: 'p4', name: 'BrightMedia SEO Campaign', description: 'Complete SEO overhaul and content strategy', status: 'Completed', priority: 'Low', progress: 100, color: '#10B981', client_name: 'BrightMedia UK', due_date: '2026-03-30', start_date: '2026-01-15', open_task_count: 0, members: [{ id: 'm7', user_id: 'u3', full_name: 'Riya Sharma', role: 'lead' }, { id: 'm8', user_id: 'u4', full_name: 'Amit Verma', role: 'member' }] },
  { id: 'p5', name: 'SkyTech CRM Integration', description: 'API integration with existing CRM system', status: 'Active', priority: 'High', progress: 45, color: '#8B5CF6', client_name: 'SkyTech Solutions', due_date: '2026-07-10', start_date: '2026-02-15', active_sprint_name: 'Sprint 3', open_task_count: 18, members: [{ id: 'm9', user_id: 'u2', full_name: 'Rahul Mehta', role: 'lead' }, { id: 'm10', user_id: 'u5', full_name: 'Priya Singh', role: 'member' }, { id: 'm11', user_id: 'u6', full_name: 'Vikram Joshi', role: 'member' }, { id: 'm12', user_id: 'u7', full_name: 'Sneha Reddy', role: 'member' }] },
];

export const dummySprints: Sprint[] = [
  { id: 's1', name: 'Sprint 3', status: 'Completed', start_date: '2026-03-01', end_date: '2026-03-14', task_count: 12, done_count: 12 },
  { id: 's2', name: 'Sprint 4', status: 'Active', start_date: '2026-03-15', end_date: '2026-03-28', task_count: 10, done_count: 4 },
  { id: 's3', name: 'Sprint 5', status: 'Planned', start_date: '2026-03-29', end_date: '2026-04-11', task_count: 5, done_count: 0 },
];

export const dummyEpics: Epic[] = [
  { id: 'e1', title: 'User Authentication', color: '#3B82F6', start_date: '2026-01-10', due_date: '2026-02-28', progress: 100, task_count: 8, done_count: 8 },
  { id: 'e2', title: 'Dashboard Module', color: '#10B981', start_date: '2026-02-01', due_date: '2026-04-15', progress: 60, task_count: 15, done_count: 9 },
  { id: 'e3', title: 'API Integration', color: '#F59E0B', start_date: '2026-03-01', due_date: '2026-05-30', progress: 25, task_count: 20, done_count: 5 },
  { id: 'e4', title: 'Mobile Responsiveness', color: '#8B5CF6', start_date: '2026-04-01', due_date: '2026-06-15', progress: 0, task_count: 10, done_count: 0 },
];

export const dummyBoardTasks: Record<string, ProjectTask[]> = {
  'Open': [
    { id: 'tk1', task_number: 'PRJ-12', title: 'Add dark mode toggle to settings', type: 'Story', status: 'Open', priority: 'Medium', assignees: [{ id: 'u5', full_name: 'Priya Singh' }], labels: [{ id: 'l1', name: 'UI', color: '#3B82F6' }], story_points: 3, epic_name: 'Dashboard Module', epic_color: '#10B981' },
    { id: 'tk2', task_number: 'PRJ-13', title: 'Fix pagination on clients list', type: 'Bug', status: 'Open', priority: 'High', assignees: [{ id: 'u7', full_name: 'Sneha Reddy' }], story_points: 2 },
    { id: 'tk3', task_number: 'PRJ-14', title: 'Create onboarding flow wireframes', type: 'Story', status: 'Open', priority: 'Low', story_points: 5, labels: [{ id: 'l2', name: 'Design', color: '#8B5CF6' }] },
  ],
  'In Progress': [
    { id: 'tk4', task_number: 'PRJ-10', title: 'Implement WebSocket for real-time chat', type: 'Story', status: 'In Progress', priority: 'Critical', assignees: [{ id: 'u5', full_name: 'Priya Singh' }, { id: 'u7', full_name: 'Sneha Reddy' }], story_points: 8, epic_name: 'API Integration', epic_color: '#F59E0B', labels: [{ id: 'l3', name: 'Backend', color: '#EF4444' }] },
    { id: 'tk5', task_number: 'PRJ-11', title: 'Design invoice print template', type: 'Task', status: 'In Progress', priority: 'Medium', assignees: [{ id: 'u6', full_name: 'Vikram Joshi' }], story_points: 3 },
  ],
  'Review': [
    { id: 'tk6', task_number: 'PRJ-8', title: 'Add unit tests for auth module', type: 'Task', status: 'Review', priority: 'High', assignees: [{ id: 'u5', full_name: 'Priya Singh' }], story_points: 5, epic_name: 'User Authentication', epic_color: '#3B82F6' },
    { id: 'tk7', task_number: 'PRJ-9', title: 'Refactor API error handling', type: 'Task', status: 'Review', priority: 'Medium', assignees: [{ id: 'u7', full_name: 'Sneha Reddy' }], story_points: 3 },
  ],
  'Done': [
    { id: 'tk8', task_number: 'PRJ-5', title: 'Setup CI/CD pipeline', type: 'Task', status: 'Done', priority: 'High', assignees: [{ id: 'u5', full_name: 'Priya Singh' }], story_points: 5 },
    { id: 'tk9', task_number: 'PRJ-6', title: 'Login page responsive design', type: 'Story', status: 'Done', priority: 'Medium', assignees: [{ id: 'u6', full_name: 'Vikram Joshi' }], story_points: 3 },
    { id: 'tk10', task_number: 'PRJ-7', title: 'Fix JWT token refresh bug', type: 'Bug', status: 'Done', priority: 'Critical', assignees: [{ id: 'u5', full_name: 'Priya Singh' }], story_points: 2 },
  ],
  'Cancelled': [],
};

export const dummyBacklogTasks: ProjectTask[] = [
  { id: 'bt1', task_number: 'PRJ-15', title: 'Implement file upload for vault', type: 'Story', status: 'Open', priority: 'High', story_points: 8, epic_id: 'e3', epic_name: 'API Integration', epic_color: '#F59E0B' },
  { id: 'bt2', task_number: 'PRJ-16', title: 'Add email notification system', type: 'Story', status: 'Open', priority: 'Medium', story_points: 13, epic_id: 'e3', epic_name: 'API Integration', epic_color: '#F59E0B' },
  { id: 'bt3', task_number: 'PRJ-17', title: 'Create analytics dashboard widgets', type: 'Story', status: 'Open', priority: 'Low', story_points: 5, epic_id: 'e2', epic_name: 'Dashboard Module', epic_color: '#10B981' },
  { id: 'bt4', task_number: 'PRJ-18', title: 'Mobile nav drawer', type: 'Task', status: 'Open', priority: 'Medium', story_points: 3, epic_id: 'e4', epic_name: 'Mobile Responsiveness', epic_color: '#8B5CF6' },
  { id: 'bt5', task_number: 'PRJ-19', title: 'Fix date picker timezone issue', type: 'Bug', status: 'Open', priority: 'High', story_points: 2 },
  { id: 'bt6', task_number: 'PRJ-20', title: 'Add CSV export for reports', type: 'Story', status: 'Open', priority: 'Low', story_points: 3 },
];

export const dummyMembers: ProjectMember[] = [
  { id: 'm1', user_id: 'u1', full_name: 'Neha Kapoor', email: 'neha@foxportal.com', role: 'lead' },
  { id: 'm2', user_id: 'u5', full_name: 'Priya Singh', email: 'priya@foxportal.com', role: 'member' },
  { id: 'm3', user_id: 'u6', full_name: 'Vikram Joshi', email: 'vikram@foxportal.com', role: 'member' },
  { id: 'm4', user_id: 'u7', full_name: 'Sneha Reddy', email: 'sneha@foxportal.com', role: 'member' },
];

export const dummyTaskComments = [
  { id: 'tc1', user_name: 'Priya Singh', text: 'Started working on this. Should be done by EOD.', created_at: '2026-04-04T10:30:00Z', is_own: true },
  { id: 'tc2', user_name: 'Neha Kapoor', text: 'Great, please make sure to add unit tests as well.', created_at: '2026-04-04T11:00:00Z', is_own: false },
  { id: 'tc3', user_name: 'Priya Singh', text: 'Will do! Also found a related issue with the token refresh.', created_at: '2026-04-04T14:15:00Z', is_own: true },
];

export const dummyActivityLog = [
  { id: 'al1', user_name: 'Priya Singh', action: 'changed status from Open to In Progress', created_at: '2026-04-04T09:00:00Z' },
  { id: 'al2', user_name: 'Neha Kapoor', action: 'assigned to Priya Singh', created_at: '2026-04-03T16:00:00Z' },
  { id: 'al3', user_name: 'Rahul Mehta', action: 'created this task', created_at: '2026-04-03T14:00:00Z' },
];

export const dummyTimeLogs = [
  { id: 'tl1', user_name: 'Priya Singh', hours: 3, date: '2026-04-04', description: 'Implemented core functionality' },
  { id: 'tl2', user_name: 'Priya Singh', hours: 2, date: '2026-04-03', description: 'Research and planning' },
  { id: 'tl3', user_name: 'Sneha Reddy', hours: 1.5, date: '2026-04-04', description: 'Code review and testing' },
];
