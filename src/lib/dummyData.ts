// Dummy data for showcasing page designs when API returns empty

export const dummyLeads = [
  { id: 'd1', full_name: 'Arjun Patel', email: 'arjun@techcorp.in', phone: '+91 98765 43210', country: 'India', purpose: 'Web Development', status: 'New', lead_source: 'Website', deal_value: 25000, added_by_name: 'Riya Sharma', assigned_to_name: 'Neha Kapoor', company_name: 'TechCorp India', created_at: new Date().toISOString(), notes: 'Interested in full-stack web app', priority: 'High' },
  { id: 'd2', full_name: 'Sarah Johnson', email: 'sarah@globalretail.com', phone: '+1 555-0123', country: 'United States', purpose: 'Mobile App', status: 'Contacted', lead_source: 'LinkedIn', deal_value: 45000, added_by_name: 'Amit Verma', assigned_to_name: 'Neha Kapoor', company_name: 'Global Retail Inc', created_at: '2026-04-03T10:00:00Z', priority: 'Critical' },
  { id: 'd3', full_name: 'Ahmed Al Rashid', email: 'ahmed@dubailogistics.ae', phone: '+971 50 123 4567', country: 'UAE', purpose: 'UI/UX Design', status: 'Qualified', lead_source: 'Referral', deal_value: 18000, added_by_name: 'Riya Sharma', assigned_to_name: 'Rahul Mehta', company_name: 'Dubai Logistics LLC', created_at: '2026-04-02T08:30:00Z', priority: 'Medium' },
  { id: 'd4', full_name: 'Emma Wilson', email: 'emma@brightmedia.co.uk', phone: '+44 20 7946 0958', country: 'United Kingdom', purpose: 'Digital Marketing', status: 'Proposal Sent', lead_source: 'Google Ads', deal_value: 32000, added_by_name: 'Amit Verma', assigned_to_name: 'Neha Kapoor', company_name: 'BrightMedia UK', created_at: '2026-03-28T14:15:00Z', priority: 'High' },
  { id: 'd5', full_name: 'Chen Wei', email: 'chen@skytech.cn', phone: '+86 138 0013 8000', country: 'China', purpose: 'SEO', status: 'Negotiation', lead_source: 'Trade Show', deal_value: 55000, added_by_name: 'Riya Sharma', assigned_to_name: 'Rahul Mehta', company_name: 'SkyTech Solutions', created_at: '2026-03-25T09:00:00Z', priority: 'Critical' },
  { id: 'd6', full_name: 'Maria Garcia', email: 'maria@innovatech.es', phone: '+34 612 345 678', country: 'Spain', purpose: 'Consulting', status: 'Closed Won', lead_source: 'Website', deal_value: 40000, added_by_name: 'Amit Verma', assigned_to_name: 'Neha Kapoor', company_name: 'InnovaTech Spain', created_at: '2026-03-20T11:30:00Z', priority: 'Medium' },
  { id: 'd7', full_name: 'James Brown', email: 'james@failedcorp.com', phone: '+1 555-9999', country: 'Canada', purpose: 'Web Development', status: 'Closed Lost', lead_source: 'Cold Call', deal_value: 15000, added_by_name: 'Riya Sharma', assigned_to_name: 'Rahul Mehta', company_name: 'FailedCorp', created_at: '2026-03-15T16:00:00Z', priority: 'Low' },
];

export const dummyClients = [
  { id: 'c1', company_name: 'TechCorp India', industry: 'Technology', client_type: 'VIP', account_manager_name: 'Neha Kapoor', total_spend: 185000, website: 'https://techcorp.in' },
  { id: 'c2', company_name: 'Global Retail Inc', industry: 'Retail', client_type: 'Active', account_manager_name: 'Rahul Mehta', total_spend: 92000, website: 'https://globalretail.com' },
  { id: 'c3', company_name: 'Dubai Logistics LLC', industry: 'Services', client_type: 'New', account_manager_name: 'Neha Kapoor', total_spend: 18000, website: 'https://dubailogistics.ae' },
  { id: 'c4', company_name: 'BrightMedia UK', industry: 'Marketing', client_type: 'Active', account_manager_name: 'Rahul Mehta', total_spend: 64000 },
  { id: 'c5', company_name: 'SkyTech Solutions', industry: 'Technology', client_type: 'At-Risk', account_manager_name: 'Neha Kapoor', total_spend: 45000 },
  { id: 'c6', company_name: 'InnovaTech Spain', industry: 'Technology', client_type: 'Active', account_manager_name: 'Rahul Mehta', total_spend: 120000 },
];

export const dummyProjects = [
  { id: 'p1', name: 'TechCorp Web Platform', description: 'Full-stack web application with React & Node.js', status: 'Active', priority: 'High', progress: 65, client_name: 'TechCorp India', due_date: '2026-06-15T00:00:00Z' },
  { id: 'p2', name: 'Global Retail Mobile App', description: 'Cross-platform mobile app for inventory management', status: 'Active', priority: 'Critical', progress: 30, client_name: 'Global Retail Inc', due_date: '2026-08-01T00:00:00Z' },
  { id: 'p3', name: 'Dubai Logistics Dashboard', description: 'Real-time analytics dashboard with live tracking', status: 'On Hold', priority: 'Medium', progress: 80, client_name: 'Dubai Logistics LLC', due_date: '2026-05-20T00:00:00Z' },
  { id: 'p4', name: 'BrightMedia SEO Campaign', description: 'Complete SEO overhaul and content strategy', status: 'Completed', priority: 'Low', progress: 100, client_name: 'BrightMedia UK', due_date: '2026-03-30T00:00:00Z' },
  { id: 'p5', name: 'SkyTech CRM Integration', description: 'API integration with existing CRM system', status: 'Active', priority: 'High', progress: 45, client_name: 'SkyTech Solutions', due_date: '2026-07-10T00:00:00Z' },
];

export const dummyTickets = [
  { id: 't1', title: 'Login page not loading on Safari', description: 'Users report blank screen on Safari 17.x when trying to access the login page', category: 'Bug Report', priority: 'Critical', status: 'Open', client_name: 'TechCorp India', assigned_to_name: 'Priya Singh', created_at: '2026-04-04T09:00:00Z' },
  { id: 't2', title: 'Add export to CSV feature', description: 'Need ability to export all reports data to CSV format for monthly review', category: 'Feature Request', priority: 'Medium', status: 'Open', client_name: 'Global Retail Inc', assigned_to_name: 'Rahul Mehta', created_at: '2026-04-03T14:00:00Z' },
  { id: 't3', title: 'Invoice PDF formatting issue', description: 'The generated PDF has misaligned columns in the line items table', category: 'Bug Report', priority: 'High', status: 'In Progress', client_name: 'Dubai Logistics LLC', assigned_to_name: 'Priya Singh', created_at: '2026-04-02T11:00:00Z' },
  { id: 't4', title: 'Billing clarification needed', description: 'Client needs clarification on extra charges in last invoice', category: 'Billing', priority: 'Low', status: 'Waiting', client_name: 'BrightMedia UK', assigned_to_name: 'Neha Kapoor', created_at: '2026-04-01T08:30:00Z' },
  { id: 't5', title: 'API rate limit exceeded', description: 'Getting 429 errors during peak hours on the analytics endpoint', category: 'Technical', priority: 'High', status: 'Resolved', client_name: 'SkyTech Solutions', assigned_to_name: 'Rahul Mehta', created_at: '2026-03-30T16:00:00Z' },
];

export const dummyUsers = [
  { id: 'u1', full_name: 'Neha Kapoor', email: 'neha@foxportal.com', role: 'sales_manager', department: 'Sales', job_title: 'Sales Manager', employment_type: 'full_time', status: 'active', monthly_target: 150000, phone: '+91 99887 76655' },
  { id: 'u2', full_name: 'Rahul Mehta', email: 'rahul@foxportal.com', role: 'sales_manager', department: 'Sales', job_title: 'Senior Sales Manager', employment_type: 'full_time', status: 'active', monthly_target: 200000, phone: '+91 98765 12345' },
  { id: 'u3', full_name: 'Riya Sharma', email: 'riya@foxportal.com', role: 'sales_rep', department: 'Sales', job_title: 'Pre-Sales Executive', employment_type: 'full_time', status: 'active', monthly_target: 75000 },
  { id: 'u4', full_name: 'Amit Verma', email: 'amit@foxportal.com', role: 'sales_rep', department: 'Sales', job_title: 'Pre-Sales Executive', employment_type: 'full_time', status: 'active', monthly_target: 75000 },
  { id: 'u5', full_name: 'Priya Singh', email: 'priya@foxportal.com', role: 'resource', department: 'Engineering', job_title: 'Full Stack Developer', employment_type: 'full_time', status: 'active' },
  { id: 'u6', full_name: 'Vikram Joshi', email: 'vikram@foxportal.com', role: 'resource', department: 'Design', job_title: 'UI/UX Designer', employment_type: 'contract', status: 'active' },
  { id: 'u7', full_name: 'Sneha Reddy', email: 'sneha@foxportal.com', role: 'freelancer', department: 'Engineering', job_title: 'React Developer', employment_type: 'freelancer', status: 'active' },
  { id: 'u8', full_name: 'Karan Gupta', email: 'karan@foxportal.com', role: 'admin', department: 'Management', job_title: 'Operations Head', employment_type: 'full_time', status: 'on_leave' },
];

export const dummyPayrollRuns = [
  {
    id: 'pr1', period_label: 'March 2026', period_start: '2026-03-01', period_end: '2026-03-31', status: 'Paid', total_net: 485000,
    employees: [
      { id: 'u1', full_name: 'Neha Kapoor', base_pay: 85000, deductions: 12000, net_pay: 73000 },
      { id: 'u2', full_name: 'Rahul Mehta', base_pay: 95000, deductions: 15000, net_pay: 80000 },
      { id: 'u3', full_name: 'Riya Sharma', base_pay: 55000, deductions: 8000, net_pay: 47000 },
      { id: 'u5', full_name: 'Priya Singh', base_pay: 75000, deductions: 11000, net_pay: 64000 },
      { id: 'u6', full_name: 'Vikram Joshi', base_pay: 60000, deductions: 5000, net_pay: 55000 },
    ],
  },
  { id: 'pr2', period_label: 'April 2026', period_start: '2026-04-01', period_end: '2026-04-30', status: 'Pending', total_net: 490000 },
  { id: 'pr3', period_label: 'February 2026', period_start: '2026-02-01', period_end: '2026-02-28', status: 'Paid', total_net: 478000 },
];

export const dummyVaultFolders = [
  { id: 'vf1', name: 'Client Credentials' },
  { id: 'vf2', name: 'Internal Tools' },
  { id: 'vf3', name: 'Social Media' },
];

export const dummyVaultCreds = [
  { id: 'vc1', title: 'AWS Console', username: 'admin@foxportal.com', category: 'Dev Tools', url: 'https://aws.amazon.com', folder_id: 'vf2' },
  { id: 'vc2', title: 'GitHub Organization', username: 'foxportal-dev', category: 'Dev Tools', url: 'https://github.com', folder_id: 'vf2' },
  { id: 'vc3', title: 'Client Hosting Panel', username: 'techcorp-admin', category: 'CRM', url: 'https://hosting.techcorp.in', folder_id: 'vf1' },
  { id: 'vc4', title: 'Company LinkedIn', username: 'marketing@foxportal.com', category: 'Social Media', url: 'https://linkedin.com', folder_id: 'vf3' },
  { id: 'vc5', title: 'Stripe Dashboard', username: 'finance@foxportal.com', category: 'Finance', url: 'https://dashboard.stripe.com', folder_id: 'vf2' },
];

export const dummyChatRooms = [
  { id: 'cr1', name: 'General', type: 'group', last_message: 'Hey team, standup at 10am tomorrow', member_count: 8, unread_count: 3 },
  { id: 'cr2', name: 'Sales Team', type: 'group', last_message: 'New lead from Dubai - looks promising!', member_count: 4, unread_count: 1 },
  { id: 'cr3', name: 'Neha Kapoor', type: 'direct', last_message: 'Updated the proposal, please review', member_count: 2, unread_count: 0 },
  { id: 'cr4', name: 'Dev Team', type: 'group', last_message: 'Deployed v2.1 to staging', member_count: 5, unread_count: 5 },
];

export const dummyTrackerSummary = {
  today_hours: '6h 45m',
  checked_in_at: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
  monthly_hours: '142',
  leave_balance: 12,
  pending_expenses: 2450,
  leave_balances: {
    annual: { used: 5, total: 20 },
    sick: { used: 2, total: 10 },
    personal: { used: 1, total: 5 },
  },
};

export const dummyLeaveRequests = [
  { id: 'lr1', leave_type: 'Annual', start_date: '2026-04-10', end_date: '2026-04-14', reason: 'Family vacation', status: 'Approved' },
  { id: 'lr2', leave_type: 'Sick', start_date: '2026-03-22', end_date: '2026-03-23', reason: 'Not feeling well', status: 'Approved' },
  { id: 'lr3', leave_type: 'Personal', start_date: '2026-04-20', end_date: '2026-04-20', reason: 'Personal appointment', status: 'Pending' },
];

export const dummyTimeEntries = [
  { id: 'te1', date: '2026-04-04', hours: 8, project_name: 'TechCorp Web Platform', description: 'Frontend development - dashboard module', is_billable: true },
  { id: 'te2', date: '2026-04-03', hours: 6, project_name: 'Global Retail Mobile App', description: 'API integration for inventory sync', is_billable: true },
  { id: 'te3', date: '2026-04-03', hours: 2, project_name: 'Internal', description: 'Team standup and sprint planning', is_billable: false },
  { id: 'te4', date: '2026-04-02', hours: 7.5, project_name: 'SkyTech CRM Integration', description: 'CRM API endpoint development', is_billable: true },
];

export const dummyExpenses = [
  { id: 'ex1', title: 'Client Lunch - TechCorp', category: 'Meals', amount: 1200, expense_date: '2026-04-03', status: 'Submitted' },
  { id: 'ex2', title: 'Figma Annual License', category: 'Software', amount: 15000, expense_date: '2026-04-01', status: 'Approved' },
  { id: 'ex3', title: 'Mumbai-Delhi Flight', category: 'Travel', amount: 8500, expense_date: '2026-03-28', status: 'Draft' },
  { id: 'ex4', title: 'Mechanical Keyboard', category: 'Equipment', amount: 4500, expense_date: '2026-03-25', status: 'Approved' },
];

export const dummyDashboardStats = {
  revenue_mtd: 135500,
  revenue_trend: '+12.5%',
  active_clients: 6,
  open_leads: 5,
  overdue_amount: 8500,
};
