// Mock data service for local/demo token sessions
// When the user is authenticated via saLocalService (fake token), 
// API calls should return mock data instead of hitting the real backend.

const mockLeads = [
  { id: '1', full_name: 'John Carter', company_name: 'TechVault Inc', status: 'New', deal_value: 15000, email: 'john@techvault.com', phone: '+1-555-0101', lead_by: 'Alex Kim' },
  { id: '2', full_name: 'Priya Sharma', company_name: 'DataBridge Solutions', status: 'Contacted', deal_value: 28000, email: 'priya@databridge.io', phone: '+1-555-0102', lead_by: 'Lisa Monroe' },
  { id: '3', full_name: 'David Park', company_name: 'CloudFirst Labs', status: 'Qualified', deal_value: 42000, email: 'david@cloudfirst.com', phone: '+1-555-0103', lead_by: 'Alex Kim' },
  { id: '4', full_name: 'Emma Wilson', company_name: 'PixelForge Media', status: 'Proposal', deal_value: 18500, email: 'emma@pixelforge.co', phone: '+1-555-0104', lead_by: 'Lisa Monroe' },
  { id: '5', full_name: 'Marcus Johnson', company_name: 'SwiftLogic AI', status: 'Closed Won', deal_value: 65000, email: 'marcus@swiftlogic.ai', phone: '+1-555-0105', lead_by: 'Alex Kim' },
];

const mockClients = [
  { id: '1', company_name: 'TechVault Inc', industry: 'Technology', client_type: 'Regular', website: 'https://techvault.com', account_manager_name: 'Alex Kim', total_spend: 45000, contacts: [{ name: 'John Carter', email: 'john@techvault.com', role: 'CEO' }] },
  { id: '2', company_name: 'DataBridge Solutions', industry: 'SaaS', client_type: 'VIP', website: 'https://databridge.io', account_manager_name: 'Lisa Monroe', total_spend: 120000, contacts: [{ name: 'Priya Sharma', email: 'priya@databridge.io', role: 'CTO' }] },
  { id: '3', company_name: 'CloudFirst Labs', industry: 'Cloud Computing', client_type: 'Regular', website: 'https://cloudfirst.com', account_manager_name: 'Alex Kim', total_spend: 78000, contacts: [{ name: 'David Park', email: 'david@cloudfirst.com', role: 'VP Engineering' }] },
];

const mockInvoices = [
  { id: '1', invoice_number: 'INV-2025-001', client_name: 'TechVault Inc', client_id: '1', total: 15000, status: 'Paid', due_date: '2025-01-15', created_at: '2025-01-01' },
  { id: '2', invoice_number: 'INV-2025-002', client_name: 'DataBridge Solutions', client_id: '2', total: 28000, status: 'Overdue', due_date: '2025-02-01', created_at: '2025-01-15' },
  { id: '3', invoice_number: 'INV-2025-003', client_name: 'CloudFirst Labs', client_id: '3', total: 42000, status: 'Pending', due_date: '2025-03-01', created_at: '2025-02-15' },
  { id: '4', invoice_number: 'INV-2025-004', client_name: 'TechVault Inc', client_id: '1', total: 9500, status: 'Overdue', due_date: '2025-01-20', created_at: '2025-01-05' },
];

const mockUsers = [
  { id: '1', full_name: 'Alex Kim', email: 'alex.kim@company.com', role: 'sales_manager', status: 'active', department: 'Sales', job_title: 'Sales Manager' },
  { id: '2', full_name: 'Lisa Monroe', email: 'lisa.monroe@company.com', role: 'sales_rep', status: 'active', department: 'Sales', job_title: 'Sales Representative' },
  { id: '3', full_name: 'Raj Patel', email: 'raj.patel@company.com', role: 'resource', status: 'active', department: 'Engineering', job_title: 'Full Stack Developer' },
  { id: '4', full_name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'freelancer', status: 'active', department: 'Design', job_title: 'UI/UX Designer' },
];

const mockTickets = [
  { id: '1', subject: 'Login issue on mobile', status: 'Open', priority: 'High', client_name: 'TechVault Inc', created_at: '2025-03-20' },
  { id: '2', subject: 'Invoice discrepancy', status: 'In Progress', priority: 'Medium', client_name: 'DataBridge Solutions', created_at: '2025-03-18' },
  { id: '3', subject: 'Feature request: Dark mode', status: 'Open', priority: 'Low', client_name: 'CloudFirst Labs', created_at: '2025-03-15' },
];

const mockProjects = [
  { id: '1', name: 'Website Redesign', client_name: 'TechVault Inc', status: 'In Progress', budget: 25000, progress: 65, start_date: '2025-01-10', end_date: '2025-04-30' },
  { id: '2', name: 'Mobile App MVP', client_name: 'DataBridge Solutions', status: 'Planning', budget: 50000, progress: 15, start_date: '2025-02-01', end_date: '2025-06-30' },
  { id: '3', name: 'API Integration', client_name: 'CloudFirst Labs', status: 'Completed', budget: 18000, progress: 100, start_date: '2024-11-01', end_date: '2025-02-28' },
];

const mockPayrollRuns = [
  { id: '1', period: 'March 2025', status: 'Completed', total_amount: 45000, employee_count: 4, run_date: '2025-03-01' },
  { id: '2', period: 'February 2025', status: 'Completed', total_amount: 45000, employee_count: 4, run_date: '2025-02-01' },
];

const mockDashboardAdmin = {
  revenue_mtd: 85000,
  active_clients: 3,
  open_leads: 4,
  overdue_amount: 37500,
  revenue_trend: '+12%',
};

export function isLocalToken(): boolean {
  try {
    const stored = localStorage.getItem('ubp-auth');
    if (!stored) return false;
    const { state } = JSON.parse(stored);
    return state?.accessToken && !state.accessToken.startsWith('eyJ');
  } catch {
    return false;
  }
}

// Returns mock response data for a given URL, or null if no mock available
export function getMockResponse(method: string, url: string, params?: any): any | null {
  const path = url.replace(/^\/api\/v1/, '');

  // GET requests
  if (method === 'get' || method === 'GET') {
    if (path === '/dashboard/admin') return mockDashboardAdmin;
    
    if (path.startsWith('/leads')) {
      if (params?.client_id) return { leads: mockLeads.filter(l => l.company_name.includes('Tech')) };
      return { leads: mockLeads };
    }
    
    if (path.startsWith('/clients') && path.match(/\/clients\/[^/]+$/)) {
      const id = path.split('/').pop();
      return mockClients.find(c => c.id === id) || mockClients[0];
    }
    if (path.startsWith('/clients')) return { clients: mockClients };
    
    if (path.startsWith('/invoices')) {
      if (params?.status === 'Overdue') return { invoices: mockInvoices.filter(i => i.status === 'Overdue') };
      if (params?.client_id) return { invoices: mockInvoices.filter(i => i.client_id === params.client_id) };
      return { invoices: mockInvoices };
    }
    
    if (path.startsWith('/users')) return mockUsers;
    
    if (path.startsWith('/tickets')) {
      if (params?.status) return { tickets: mockTickets.filter(t => t.status === params.status) };
      return { tickets: mockTickets };
    }
    
    if (path.startsWith('/projects') && path.match(/\/projects\/[^/]+$/)) {
      const id = path.split('/').pop();
      return mockProjects.find(p => p.id === id) || mockProjects[0];
    }
    if (path.startsWith('/projects')) return { projects: mockProjects };
    
    if (path.startsWith('/payroll/runs')) return mockPayrollRuns;
    
    if (path.startsWith('/vault') || path.startsWith('/credentials')) return { folders: [], credentials: [] };
    if (path.startsWith('/tracker') || path.startsWith('/time-entries')) return [];
    if (path.startsWith('/reports')) return {};
    if (path.startsWith('/chat') || path.startsWith('/messages')) return [];
    if (path.startsWith('/organization/profile')) return { company_name: 'Demo Company', industry: 'Technology' };
  }

  // POST/PUT/PATCH/DELETE - return success with the sent data
  if (['post', 'POST', 'put', 'PUT', 'patch', 'PATCH', 'delete', 'DELETE'].includes(method)) {
    return { success: true, message: 'Operation completed (demo mode)' };
  }

  return null;
}
