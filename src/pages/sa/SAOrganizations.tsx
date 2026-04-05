import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saLocalService } from '@/lib/saLocalService';
import api from '@/lib/api';
import { useState } from 'react';
import { Building2, Plus, Search, Users, FileText, X, Key, RefreshCw, Pencil, Eye, Copy, Check, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import toast from 'react-hot-toast';

const plans = [
  { value: 'trial', label: 'Trial (Free)' },
  { value: 'starter', label: 'Starter ($29/mo)' },
  { value: 'pro', label: 'Pro ($79/mo)' },
  { value: 'enterprise', label: 'Enterprise ($199/mo)' },
];

const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Services', 'Other'];
const seatOptions = ['5', '10', '25', '50', '100', '250', '500', 'Unlimited'];
const roleOptions = [
  { value: 'admin', label: 'Company Admin' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'resource', label: 'Resource' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'client', label: 'Client' },
];

function generatePassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateLicenseKey() {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FOX-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export default function SAOrganizations() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [viewOrg, setViewOrg] = useState<any>(null);
  const [copiedField, setCopiedField] = useState('');
  const [form, setForm] = useState({
    name: '', owner_email: '', owner_name: '', password: '',
    industry: '', size: '1-10',
  });
  const [editForm, setEditForm] = useState({
    admin_email: '', seats: '', role: 'admin', password: '',
  });
  const qc = useQueryClient();

  const invalidateSAQueries = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['sa-orgs'] }),
      qc.invalidateQueries({ queryKey: ['sa-stats'] }),
      qc.invalidateQueries({ queryKey: ['sa-users'] }),
      qc.invalidateQueries({ queryKey: ['sa-plans'] }),
      qc.invalidateQueries({ queryKey: ['sa-audit'] }),
    ]);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['sa-orgs', search],
    queryFn: () => saLocalService.getOrganizations(search),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/sa/organizations', {
      name: d.name,
      owner_email: d.owner_email,
      owner_name: d.owner_name,
      password: d.password,
      industry: d.industry,
      size: d.size,
    }).then(res => res.data),
    onSuccess: async (data) => { await invalidateSAQueries(); resetCreateForm(); toast.success(`Organization "${data?.organization?.name || form.name}" created`); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message || 'Error creating organization'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => saLocalService.updateOrganization(id, data),
    onSuccess: async () => { await invalidateSAQueries(); setEditOrg(null); toast.success('Organization updated'); },
    onError: (e: any) => toast.error(e.message || 'Error updating'),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) => saLocalService.organizationAction(id, action),
    onSuccess: async () => { await invalidateSAQueries(); toast.success('Done'); },
    onError: (e: any) => toast.error(e.message || 'Action failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => saLocalService.deleteOrganization(id),
    onSuccess: async () => { await invalidateSAQueries(); toast.success('Organization deleted'); },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const resetCreateForm = () => {
    setShowCreate(false);
    setForm({
      name: '', owner_email: '', owner_name: '', password: '',
      industry: '', size: '1-10',
    });
  };

  const openEdit = (org: any) => {
    setEditOrg(org);
    setEditForm({
      admin_email: org.admin_email || org.owner_email || '',
      seats: org.seats || '10',
      role: org.role || 'admin',
      password: '',
    });
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";
  const labelClass = "text-xs font-medium text-muted-foreground mb-1 block";

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-subtitle">Manage all platform organizations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> New Organization
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search organizations..." className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card h-52 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(orgs) ? orgs : []).map((org: any) => (
            <div key={org.id} className="glass-card-hover p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {org.name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{org.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{org.admin_email || org.owner_email}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setViewOrg(org)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="View">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openEdit(org)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{org.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this organization and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMut.mutate(org.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge-primary">{org.plan}</span>
                <span className={org.status === 'active' ? 'badge-success' : org.status === 'suspended' ? 'badge-danger' : 'badge-warning'}>{org.status}</span>
                <span className="px-2 py-0.5 rounded-md border border-border bg-secondary text-xs capitalize">
                  {(org.role || 'admin').replace('_', ' ')}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {org.seats || org.user_count || 0} seats</span>
                <span className="flex items-center gap-1"><Key className="h-3 w-3" /> {org.license_key ? '••••' + org.license_key.slice(-4) : 'N/A'}</span>
              </div>
              <div className="flex gap-2 pt-1">
                {org.status === 'active' && (
                  <button onClick={() => actionMut.mutate({ id: org.id, action: 'suspend' })} className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Suspend</button>
                )}
                {org.status === 'suspended' && (
                  <button onClick={() => actionMut.mutate({ id: org.id, action: 'activate' })} className="text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20 transition-colors">Activate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Organization</h2>
              <button onClick={resetCreateForm} className="p-1.5 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Company Name *</label>
                <input placeholder="Acme Corporation" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Admin Email *</label>
                <input type="email" placeholder="admin@acme.com" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Admin Username</label>
                <input placeholder="John Doe" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input type="password" placeholder="Enter password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Industry</label>
                  <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inputClass}>
                    <option value="">Select Industry</option>
                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Seats</label>
                  <select value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} className={inputClass}>
                    {seatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className={inputClass}>
                  {plans.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputClass}>
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>License Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input readOnly value={form.license_key} className={`${inputClass} pr-10 font-mono text-xs`} />
                    <button onClick={() => handleCopy(form.license_key, 'license')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors">
                      {copiedField === 'license' ? <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, license_key: generateLicenseKey() }))} className="px-3 py-2 rounded-lg bg-secondary border border-border hover:bg-muted transition-colors" title="Regenerate">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={resetCreateForm} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.admin_email} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit: {editOrg.name}</h2>
              <button onClick={() => setEditOrg(null)} className="p-1.5 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Access Email</label>
                <input type="email" value={editForm.admin_email} onChange={e => setEditForm(f => ({ ...f, admin_email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Number of Seats</label>
                <select value={editForm.seats} onChange={e => setEditForm(f => ({ ...f, seats: e.target.value }))} className={inputClass}>
                  {seatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className={inputClass}>
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Reset Password</label>
                <div className="flex gap-2">
                  <input value={editForm.password} readOnly placeholder="Click generate to reset" className={`${inputClass} font-mono text-xs`} />
                  <button onClick={() => setEditForm(f => ({ ...f, password: generatePassword() }))} className="px-3 py-2 rounded-lg bg-secondary border border-border hover:bg-muted transition-colors flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <RefreshCw className="h-3.5 w-3.5" /> Generate
                  </button>
                </div>
                {editForm.password && (
                  <p className="text-xs text-[hsl(var(--warning))] mt-1">New password will be set on save</p>
                )}
              </div>
            </div>

            {/* Read-only details */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization Details (Read Only)</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">Plan</span>
                  <span className="font-medium">{editOrg.plan}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">Status</span>
                  <span className="font-medium capitalize">{editOrg.status}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">Industry</span>
                  <span className="font-medium">{editOrg.industry || 'N/A'}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">Role</span>
                  <span className="font-medium capitalize">{(editForm.role || editOrg.role || 'admin').replace('_', ' ')}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">License Key</span>
                  <span className="font-mono text-xs">{editOrg.license_key || 'N/A'}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 col-span-2">
                  <span className="text-xs text-muted-foreground block">Created</span>
                  <span className="font-medium">{editOrg.created_at ? new Date(editOrg.created_at).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditOrg(null)} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => {
                  const data: any = {};
                  if (editForm.admin_email !== (editOrg.admin_email || editOrg.owner_email)) data.admin_email = editForm.admin_email;
                  if (editForm.seats !== (editOrg.seats || '10')) data.seats = editForm.seats;
                  if (editForm.role !== (editOrg.role || 'admin')) data.role = editForm.role;
                  if (editForm.password) data.password = editForm.password;
                  if (Object.keys(data).length === 0) return toast('No changes to save');
                  updateMut.mutate({ id: editOrg.id, data });
                }}
                disabled={updateMut.isPending}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {updateMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
                  {viewOrg.name?.[0]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{viewOrg.name}</h2>
                  <p className="text-xs text-muted-foreground">{viewOrg.admin_email || viewOrg.owner_email}</p>
                </div>
              </div>
              <button onClick={() => setViewOrg(null)} className="p-1.5 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Plan', value: viewOrg.plan },
                { label: 'Status', value: viewOrg.status },
                { label: 'Role', value: (viewOrg.role || 'admin').replace('_', ' ') },
                { label: 'Industry', value: viewOrg.industry || 'N/A' },
                { label: 'Seats', value: viewOrg.seats || viewOrg.user_count || '0' },
                { label: 'License Key', value: viewOrg.license_key || 'N/A', mono: true },
                { label: 'Created', value: viewOrg.created_at ? new Date(viewOrg.created_at).toLocaleDateString() : 'N/A' },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-secondary/50">
                  <span className="text-xs text-muted-foreground block">{item.label}</span>
                  <span className={`font-medium capitalize ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setViewOrg(null); openEdit(viewOrg); }} className="px-4 py-2.5 rounded-lg bg-secondary text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => setViewOrg(null)} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
