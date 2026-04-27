import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Shield, Plus, Pencil, Trash2, Lock, ChevronDown, ChevronRight, Check, X as XIcon, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const MODULES = ['crm', 'invoicing', 'clients', 'chat', 'projects', 'tasks', 'expenses', 'vault', 'payroll', 'tracker', 'tickets', 'users', 'reports'] as const;
const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] as const;
const ACTION_LABELS: Record<string, string> = { can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_delete: 'Delete', can_export: 'Export' };

type PermMatrix = Record<string, Record<string, boolean>>;

const emptyPermissions = (): PermMatrix =>
  Object.fromEntries(MODULES.map(m => [m, { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, own_only: false }]));

interface RoleForm {
  name: string;
  label: string;
  description: string;
  permissions: PermMatrix;
}

const emptyForm = (): RoleForm => ({ name: '', label: '', description: '', permissions: emptyPermissions() });

export default function RolesPermissions() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : d?.roles || [];
    },
  });

  const createMut = useMutation({
    mutationFn: (d: RoleForm) => api.post('/roles', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setShowModal(false); toast.success('Role created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error creating role'),
  });

  const updateMut = useMutation({
    mutationFn: (d: RoleForm & { originalName: string }) => api.put(`/roles/${d.originalName}`, { label: d.label, description: d.description, permissions: d.permissions }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setShowModal(false); setEditingRole(null); toast.success('Role updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error updating role'),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => api.delete(`/roles/${name}`, { skipConfirm: true } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting role'),
  });

  const openCreate = () => { setForm(emptyForm()); setEditingRole(null); setShowModal(true); };
  const openEdit = (role: any) => {
    setForm({ name: role.name, label: role.label || role.name, description: role.description || '', permissions: role.permissions || emptyPermissions() });
    setEditingRole(role.name);
    setShowModal(true);
  };

  const togglePerm = (mod: string, action: string) => {
    setForm(f => ({
      ...f,
      permissions: { ...f.permissions, [mod]: { ...f.permissions[mod], [action]: !f.permissions[mod]?.[action] } },
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.label.trim()) return toast.error('Name and label are required');
    if (editingRole) {
      updateMut.mutate({ ...form, originalName: editingRole });
    } else {
      createMut.mutate(form);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">Manage roles and their access levels</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> Create Role
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : roles.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">No roles found.</div>
      ) : (
        <div className="space-y-3">
          {roles.map((role: any) => {
            const isSystem = role.is_system;
            const isOpen = expanded === role.name;
            const perms = role.permissions as PermMatrix | undefined;
            return (
              <div key={role.name} className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setExpanded(isOpen ? null : role.name)}>
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{role.label || role.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">({role.name})</span>
                        {isSystem && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                            <Lock className="h-2.5 w-2.5" /> System
                          </span>
                        )}
                      </div>
                      {role.description && <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>}
                    </div>
                  </div>
                  {!isSystem && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(role)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(role)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && perms && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</th>
                          {ACTIONS.map(a => <th key={a} className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{ACTION_LABELS[a]}</th>)}
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Own Only</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map(mod => {
                          const mp = perms[mod];
                          return (
                            <tr key={mod} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-2.5 font-medium capitalize">{mod}</td>
                              {ACTIONS.map(a => (
                                <td key={a} className="text-center px-3 py-2.5">
                                  {mp?.[a] ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <XIcon className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                                </td>
                              ))}
                              <td className="text-center px-3 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${mp?.own_only ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                                  {mp?.own_only ? 'Own' : 'All'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editingRole ? 'Edit Role' : 'Create Role'}</h2>
              <button onClick={() => { setShowModal(false); setEditingRole(null); }} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Name (slug) *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} placeholder="e.g. team_lead" disabled={!!editingRole} className={`${inputCls} ${editingRole ? 'opacity-50 cursor-not-allowed' : ''}`} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Label *</label>
                  <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Team Lead" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief role description" className={inputCls} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Permission Matrix</h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</th>
                        {ACTIONS.map(a => <th key={a} className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{ACTION_LABELS[a]}</th>)}
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Own Only</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => (
                        <tr key={mod} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium capitalize">{mod}</td>
                          {ACTIONS.map(a => (
                            <td key={a} className="text-center px-3 py-2.5">
                              <button onClick={() => togglePerm(mod, a)} className={`w-5 h-5 rounded border transition-all mx-auto flex items-center justify-center ${form.permissions[mod]?.[a] ? 'bg-primary border-primary' : 'border-border hover:border-muted-foreground'}`}>
                                {form.permissions[mod]?.[a] && <Check className="h-3 w-3 text-primary-foreground" />}
                              </button>
                            </td>
                          ))}
                          <td className="text-center px-3 py-2.5">
                            <button onClick={() => togglePerm(mod, 'own_only')} className={`w-5 h-5 rounded border transition-all mx-auto flex items-center justify-center ${form.permissions[mod]?.own_only ? 'bg-amber-500 border-amber-500' : 'border-border hover:border-muted-foreground'}`}>
                              {form.permissions[mod]?.own_only && <Check className="h-3 w-3 text-white" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end p-6 border-t border-border">
              <button onClick={() => { setShowModal(false); setEditingRole(null); }} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deleteTarget?.label || deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMut.mutate(deleteTarget.name); setDeleteTarget(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
