import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, Search, X, Pencil, Eye, Users, UserCheck, UserX, Target, Trash2, Shield, Check, X as XIcon, MoreVertical, Power, AlertTriangle, KeyRound, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useModulePermission, useRole } from '@/hooks/usePermission';

import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const PERM_MODULES = ['crm', 'invoicing', 'clients', 'chat', 'projects', 'vault', 'payroll', 'tracker', 'tickets', 'users', 'reports'] as const;
const PERM_ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] as const;
const PERM_LABELS: Record<string, string> = { can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_delete: 'Delete', can_export: 'Export' };


const fallbackRoles = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'resource', label: 'Resource' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'client', label: 'Client' },
];
const departments = ['Sales', 'Marketing', 'Engineering', 'Design', 'HR', 'Finance', 'Operations', 'Support', 'Management', 'Other'];
const employmentTypes = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelancer', label: 'Freelancer' },
];
const tabs = ['All', 'Active', 'Inactive', 'On Leave'];

const emptyForm = {
  full_name: '', email: '', phone: '', role: 'sales_rep', employment_type: 'full_time',
  department: '', job_title: '', password: '', date_of_joining: '', reporting_to: '',
  salary: '', address: '', emergency_contact: '', emergency_phone: '', notes: '',
  bank_name: '', bank_account: '', ifsc_code: '', pan_number: '',
};

export default function AdminUsers() {
  const perm = useModulePermission('users');
  const role = useRole();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<any>(null);
  const [permanentDeleteConfirmName, setPermanentDeleteConfirmName] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [showView, setShowView] = useState<any>(null);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [showTarget, setShowTarget] = useState<any>(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetMonth, setTargetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formTab, setFormTab] = useState('basic');
  const [viewTab, setViewTab] = useState<'details' | 'permissions'>('details');
  const [viewPerms, setViewPerms] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const qc = useQueryClient();

  const { data: apiRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      const d = res.data?.data || res.data;
      const list = Array.isArray(d) ? d : d?.roles || [];
      return list.map((r: any) => ({ value: r.name, label: r.label || r.name }));
    },
  });
  const roles = (apiRoles && apiRoles.length > 0) ? apiRoles : fallbackRoles;

  const { data = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search } }).then(r => {
      const d = r.data;
      const list = d?.users || d?.data || (Array.isArray(d) ? d : []);
      console.log('[AdminUsers] raw response:', d, 'parsed list:', list);
      return list;
    }),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/users/invite', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowAdd(false);
      setForm({ ...emptyForm });
      toast.success('User added successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Error adding user'),
  });

  const editMut = useMutation({
    mutationFn: (d: { id: string; data: typeof form }) => api.put(`/users/${d.id}`, d.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowEdit(null);
      toast.success('User updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting user'),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error activating user'),
  });

  const permanentDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}/permanent`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User permanently deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error permanently deleting user'),
  });

  const targetMut = useMutation({
    mutationFn: (d: { id: string; monthly_target: number; target_month: string }) =>
      api.post(`/users/${d.id}/sales-target`, { monthly_target: d.monthly_target, target_month: d.target_month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['my-performance'] });
      setShowTarget(null);
      setTargetAmount('');
      toast.success('Sales target set successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error setting target'),
  });

  const rawUsers = Array.isArray(data) ? data : [];
  const allUsers = rawUsers;
  const users = allUsers.filter((u: any) => {
    if (tab === 'All') return true;
    if (tab === 'Active') return u.status === 'active';
    if (tab === 'Inactive') return u.status === 'inactive' || u.status === 'terminated';
    if (tab === 'On Leave') return u.status === 'on_leave';
    return true;
  });

  const counts = {
    All: allUsers.length,
    Active: allUsers.filter((u: any) => u.status === 'active').length,
    Inactive: allUsers.filter((u: any) => u.status === 'inactive' || u.status === 'terminated').length,
    'On Leave': allUsers.filter((u: any) => u.status === 'on_leave').length,
  };

  const populateForm = (u: any) => {
    setForm({
      full_name: u.full_name || '', email: u.email || '', phone: u.phone || '', role: u.role || 'sales_rep',
      employment_type: u.employment_type || 'full_time', department: u.department || '', job_title: u.job_title || '',
      password: '', date_of_joining: u.date_of_joining ? u.date_of_joining.substring(0, 10) : '',
      reporting_to: u.manager_id || u.reporting_to || '',
      salary: u.salary || '', address: u.address || '', emergency_contact: u.emergency_contact || '',
      emergency_phone: u.emergency_phone || '', notes: u.notes || '',
      bank_name: u.bank_name || '', bank_account: u.bank_account || '', ifsc_code: u.ifsc_code || '', pan_number: u.pan_number || '',
    });
  };

  const openEdit = async (u: any) => {
    setFormTab('basic');
    try {
      const res = await api.get(`/users/${u.id}`);
      const full = res.data?.data || res.data;
      populateForm(full);
      setShowEdit(full);
    } catch {
      populateForm(u);
      setShowEdit(u);
    }
  };

  const openView = async (u: any) => {
    setViewTab('details');
    setViewPerms(null);
    try {
      const res = await api.get(`/users/${u.id}`);
      setShowView(res.data?.data || res.data);
    } catch {
      setShowView(u);
    }
    // Fetch user permissions
    if (isAdmin) {
      try {
        const pRes = await api.get(`/permissions/user/${u.id}`);
        const pd = pRes.data?.data || pRes.data;
        setViewPerms(pd?.permissions || null);
      } catch {
        setViewPerms(null);
      }
    }
  };

  const openAdd = () => {
    setForm({ ...emptyForm });
    setFormTab('basic');
    setShowAdd(true);
  };

  const openTarget = (u: any) => {
    setShowTarget(u);
    setTargetAmount(u.monthly_target?.toString() || u.sales_target?.toString() || '');
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "text-xs text-muted-foreground font-medium";

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-2">
        {['basic', 'work', 'payroll', 'other'].map(t => (
          <button key={t} onClick={() => setFormTab(t)} className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${formTab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            {t === 'basic' ? 'Basic Info' : t === 'work' ? 'Work Details' : t === 'payroll' ? 'Payroll & Bank' : 'Other'}
          </button>
        ))}
      </div>

      {formTab === 'basic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Full Name *</label><input placeholder="Enter full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Email *</label><input type="email" placeholder="Enter email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label><input placeholder="Enter phone number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /></div>
          {!showEdit && <div><label className={labelCls}>Password *</label><input type="password" placeholder="Set password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} /></div>}
          <div className="md:col-span-2"><label className={labelCls}>Address</label><input placeholder="Enter address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} /></div>
        </div>
      )}

      {formTab === 'work' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
           <div>
            <label className={labelCls}>Role *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Department</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Job Title</label><input placeholder="e.g. Senior Developer" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Employment Type</label>
            <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} className={inputCls}>
              {employmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Date of Joining</label><input type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Reporting To</label>
            <select value={form.reporting_to} onChange={e => setForm(f => ({ ...f, reporting_to: e.target.value }))} className={inputCls}>
              <option value="">Select Manager</option>
              {rawUsers.filter((u: any) => ['admin', 'sales_manager', 'super_admin'].includes(u.role)).map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role?.replace(/_/g, ' ')})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {formTab === 'payroll' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Salary (Monthly)</label><input type="number" placeholder="Enter salary" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>PAN Number</label><input placeholder="Enter PAN" value={form.pan_number} onChange={e => setForm(f => ({ ...f, pan_number: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Bank Name</label><input placeholder="Enter bank name" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Bank Account Number</label><input placeholder="Enter account number" value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>IFSC Code</label><input placeholder="Enter IFSC code" value={form.ifsc_code} onChange={e => setForm(f => ({ ...f, ifsc_code: e.target.value }))} className={inputCls} /></div>
        </div>
      )}

      {formTab === 'other' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Emergency Contact Name</label><input placeholder="Enter name" value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Emergency Contact Phone</label><input placeholder="Enter phone" value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} className={inputCls} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Notes</label><textarea placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} /></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Team & Users</h1><p className="page-subtitle">Manage your employees</p></div>
        {perm.canCreate && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
          <div><div className="text-lg font-bold">{counts.All}</div><div className="text-xs text-muted-foreground">Total Users</div></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--success))]/10"><UserCheck className="h-4 w-4 text-[hsl(var(--success))]" /></div>
          <div><div className="text-lg font-bold">{counts.Active}</div><div className="text-xs text-muted-foreground">Active</div></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--warning))]/10"><UserX className="h-4 w-4 text-[hsl(var(--warning))]" /></div>
          <div><div className="text-lg font-bold">{counts['On Leave']}</div><div className="text-xs text-muted-foreground">On Leave</div></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><UserX className="h-4 w-4 text-destructive" /></div>
          <div><div className="text-lg font-bold">{counts.Inactive}</div><div className="text-xs text-muted-foreground">Inactive</div></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              {t} ({counts[t as keyof typeof counts]})
            </button>
          ))}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Employee</th>
              <th className="p-4">Role</th>
              <th className="p-4">Department</th>
              <th className="p-4">Job Title</th>
              <th className="p-4">Type</th>
              <th className="p-4">Sales Target</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            users.map((u: any) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{u.full_name?.[0]}</div>
                    <div>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4"><span className="badge-primary">{u.role?.replace(/_/g, ' ')}</span></td>
                <td className="p-4 text-muted-foreground">{u.department || '—'}</td>
                <td className="p-4 text-muted-foreground">{u.job_title || '—'}</td>
                <td className="p-4 text-muted-foreground">{u.employment_type || '—'}</td>
                <td className="p-4">
                  {(u.monthly_target || u.sales_target) ? (
                    <span className="text-sm font-medium">${Number(u.monthly_target || u.sales_target).toLocaleString()}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={u.status === 'active' ? 'badge-success' : u.status === 'on_leave' ? 'badge-warning' : 'badge-danger'}>
                    {u.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(u)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="View"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => openTarget(u)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Set Sales Target"><Target className="h-4 w-4" /></button>
                    {isAdmin && u.id !== currentUserId && u.role !== 'super_admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="More actions"><MoreVertical className="h-4 w-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(u.status === 'inactive' || u.status === 'terminated' || u.is_active === 0) ? (
                            <DropdownMenuItem onClick={() => activateMut.mutate(u.id)} className="gap-2">
                              <Power className="h-4 w-4 text-[hsl(var(--success))]" /> Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setDeleteTarget(u)} className="gap-2">
                              <UserX className="h-4 w-4 text-[hsl(var(--warning))]" /> Deactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setPermanentDeleteTarget(u); setPermanentDeleteConfirmName(''); }} className="gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete Permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="p-12 text-center">
                <div className="text-muted-foreground text-sm mb-3">No users found</div>
                <button onClick={openAdd} className="text-sm text-primary hover:underline">Invite your first team member →</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New User</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>Full Name *</label><input placeholder="Enter full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Email *</label><input type="email" placeholder="Enter email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Password *</label><input type="password" placeholder="Set password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} /></div>
              <div>
                <label className={labelCls}>Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Employment Type</label>
                <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} className={inputCls}>
                  {employmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Job Title</label><input placeholder="e.g. Senior Developer" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className={inputCls} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Phone</label><input type="tel" placeholder="+1234567890" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} /></div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.full_name || !form.email || !form.password} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit User — {showEdit.full_name}</h2>
              <button onClick={() => setShowEdit(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            {renderFormFields()}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowEdit(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => editMut.mutate({ id: showEdit.id, data: form })} disabled={editMut.isPending || !form.full_name || !form.email} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {editMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Sales Target Modal */}
      {showTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Set Sales Target</h2>
              <button onClick={() => setShowTarget(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">{showTarget.full_name?.[0]}</div>
              <div>
                <div className="font-medium text-sm">{showTarget.full_name}</div>
                <div className="text-xs text-muted-foreground">{showTarget.role?.replace(/_/g, ' ')}</div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Target Period</label>
              <input type="month" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monthly Sales Target ($)</label>
              <input type="number" placeholder="e.g. 50000" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={inputCls} min="0" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTarget(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => targetMut.mutate({ id: showTarget.id, monthly_target: Number(targetAmount), target_month: targetMonth })}
                disabled={targetMut.isPending || !targetAmount}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {targetMut.isPending ? 'Saving...' : 'Set Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">User Details</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowView(null); openEdit(showView); }} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => setShowView(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl">{showView.full_name?.[0]}</div>
              <div>
                <h3 className="text-lg font-bold">{showView.full_name}</h3>
                <p className="text-sm text-muted-foreground">{showView.email}</p>
                <span className={showView.status === 'active' ? 'badge-success' : showView.status === 'on_leave' ? 'badge-warning' : 'badge-danger'}>{showView.status?.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex gap-1 border-b border-border pb-2">
              <button onClick={() => setViewTab('details')} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${viewTab === 'details' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                <Eye className="h-3.5 w-3.5" /> Details
              </button>
              {isAdmin && (
                <button onClick={() => setViewTab('permissions')} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${viewTab === 'permissions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                  <Shield className="h-3.5 w-3.5" /> Permissions
                </button>
              )}
            </div>

            {viewTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Details</h4>
                <div className="space-y-2">
                  <div><span className="text-xs text-muted-foreground">Role</span><p className="text-sm font-medium capitalize">{showView.role?.replace(/_/g, ' ')}</p></div>
                  <div><span className="text-xs text-muted-foreground">Department</span><p className="text-sm font-medium">{showView.department || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Job Title</span><p className="text-sm font-medium">{showView.job_title || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Employment Type</span><p className="text-sm font-medium">{showView.employment_type?.replace(/_/g, ' ') || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Date of Joining</span><p className="text-sm font-medium">{showView.date_of_joining ? new Date(showView.date_of_joining).toLocaleDateString() : '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Reporting To</span><p className="text-sm font-medium">{showView.manager_name || showView.reporting_to || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Sales Target</span><p className="text-sm font-medium">{(showView.monthly_target || showView.sales_target) ? `$${Number(showView.monthly_target || showView.sales_target).toLocaleString()}` : '—'}</p></div>
                </div>
              </div>
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h4>
                <div className="space-y-2">
                  <div><span className="text-xs text-muted-foreground">Phone</span><p className="text-sm font-medium">{showView.phone || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Address</span><p className="text-sm font-medium">{showView.address || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Emergency Contact</span><p className="text-sm font-medium">{showView.emergency_contact || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Emergency Phone</span><p className="text-sm font-medium">{showView.emergency_phone || '—'}</p></div>
                </div>
              </div>
              <div className="glass-card p-4 space-y-3 md:col-span-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payroll & Bank Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div><span className="text-xs text-muted-foreground">Salary (Monthly)</span><p className="text-sm font-medium">{showView.salary ? `$${Number(showView.salary).toLocaleString()}` : '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">PAN Number</span><p className="text-sm font-medium">{showView.pan_number || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Bank Name</span><p className="text-sm font-medium">{showView.bank_name || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Bank Account</span><p className="text-sm font-medium">{showView.bank_account || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">IFSC Code</span><p className="text-sm font-medium">{showView.ifsc_code || '—'}</p></div>
                </div>
              </div>
              {showView.notes && (
                <div className="glass-card p-4 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
                  <p className="text-sm">{showView.notes}</p>
                </div>
              )}
            </div>
            )}

            {viewTab === 'permissions' && (
              <div className="glass-card overflow-hidden">
                {viewPerms ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Module</th>
                          {PERM_ACTIONS.map(a => (
                            <th key={a} className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground uppercase">{PERM_LABELS[a]}</th>
                          ))}
                          <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground uppercase">Scope</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERM_MODULES.map(mod => {
                          const mp = viewPerms[mod];
                          return (
                            <tr key={mod} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                              <td className="px-3 py-2 font-medium capitalize">{mod}</td>
                              {PERM_ACTIONS.map(a => (
                                <td key={a} className="text-center px-2 py-2">
                                  {mp?.[a] ? <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XIcon className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />}
                                </td>
                              ))}
                              <td className="text-center px-2 py-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${mp?.own_only ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                                  {mp?.own_only ? 'Own' : 'All'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">No permissions data available for this user.</div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowView(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.full_name}</strong>? They will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={!!permanentDeleteTarget} onOpenChange={(open) => { if (!open) { setPermanentDeleteTarget(null); setPermanentDeleteConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete User Permanently
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">This cannot be undone. All data associated with <strong>{permanentDeleteTarget?.full_name}</strong> will be unlinked.</span>
              <span className="block text-sm">Type <strong>{permanentDeleteTarget?.full_name}</strong> to confirm:</span>
              <input
                value={permanentDeleteConfirmName}
                onChange={(e) => setPermanentDeleteConfirmName(e.target.value)}
                placeholder="Type user's full name..."
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={permanentDeleteConfirmName !== permanentDeleteTarget?.full_name}
              onClick={() => {
                if (permanentDeleteTarget && permanentDeleteConfirmName === permanentDeleteTarget.full_name) {
                  permanentDeleteMut.mutate(permanentDeleteTarget.id);
                  setPermanentDeleteTarget(null);
                  setPermanentDeleteConfirmName('');
                }
              }}
            >
              {permanentDeleteMut.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
