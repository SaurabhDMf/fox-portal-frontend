import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectMember } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, X, Shield, User, Eye, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/usePermission';
import { Switch } from '@/components/ui/switch';

interface Props {
  projectId: string;
}

const PROJECT_ROLE_CONFIG: Record<string, { label: string; class: string }> = {
  lead: { label: 'Lead', class: 'badge-primary' },
  member: { label: 'Member', class: 'badge-info' },
  viewer: { label: 'Viewer', class: 'badge-neutral' },
};

export default function MembersView({ projectId }: Props) {
  const role = useRole();
  const canManage = role === 'admin' || role === 'super_admin' || role === 'manager' || role === 'sales_manager';
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [addTab, setAddTab] = useState<'users' | 'clients'>('users');
  const [memberTab, setMemberTab] = useState<'users' | 'clients'>('users');

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray<ProjectMember>(r.data, ['members', 'users'])),
  });
  const members: ProjectMember[] = Array.isArray(membersRaw) ? membersRaw : [];

  const teamMembers = members.filter(m => (m as any).user_role !== 'client');
  const clientMembers = members.filter(m => (m as any).user_role === 'client');

  // Fetch available users for the Users tab in the Add modal
  const { data: usersRaw } = useQuery({
    queryKey: ['add-member-available-users', projectId, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.get('/users/active', { params }).then(r => {
        const d = r.data;
        return d?.users || d?.data?.users || d?.data?.items || d?.items || d?.data || d || [];
      });
    },
    enabled: showAdd && addTab === 'users',
  });
  const allUsers = Array.isArray(usersRaw) ? usersRaw : [];
  const memberUserIds = new Set(members.map(m => m.user_id));
  const filteredUsers = allUsers.filter((u: any) => !memberUserIds.has(u.id));

  // Fetch available client companies for the Clients tab in the Add modal
  const { data: clientCompaniesRaw } = useQuery({
    queryKey: ['add-available-clients', projectId, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.get(`/projects/${projectId}/available-clients`, { params }).then(r => {
        const d = r.data;
        return d?.data || d?.clients || d?.items || d || [];
      });
    },
    enabled: showAdd && addTab === 'clients',
  });
  const clientCompanies = Array.isArray(clientCompaniesRaw) ? clientCompaniesRaw : [];

  const addMut = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/members`, { user_id: selectedUserId, role: selectedRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); setShowAdd(false); setSelectedUserId(''); toast.success('Member added'); },
  });

  const linkClientMut = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/projects/${projectId}/client`, { client_id: selectedUserId });
      return res.data?.data || res.data;
    },
    onSuccess: (updatedProject: any) => {
      // Update project caches with the authoritative server response
      const merge = (old: any) => {
        if (!old) return updatedProject;
        const base = old.data ? old.data : old;
        const merged = { ...base, ...updatedProject };
        return old.data ? { ...old, data: merged } : merged;
      };
      qc.setQueryData(['project-detail', projectId], merge);
      qc.setQueryData(['project', projectId], merge);
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      setShowAdd(false);
      setSelectedUserId('');
      toast.success(`Client linked${updatedProject?.client_name ? `: ${updatedProject.client_name}` : ''}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to link client'),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); toast.success('Member removed'); },
  });

  const toggleTaskMut = useMutation({
    mutationFn: ({ userId, canCreate }: { userId: string; canCreate: boolean }) =>
      api.put(`/projects/${projectId}/members/${userId}`, { can_create_tasks: canCreate }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); toast.success('Permission updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update permission'),
  });

  const toggleVisibilityMut = useMutation({
    mutationFn: ({ userId, visible }: { userId: string; visible: boolean }) =>
      api.put(`/projects/${projectId}/members/${userId}`, { visible_to_client: visible }),
    onMutate: async ({ userId, visible }) => {
      await qc.cancelQueries({ queryKey: ['project-members', projectId] });
      const prev = qc.getQueryData<ProjectMember[]>(['project-members', projectId]);
      qc.setQueryData<ProjectMember[]>(['project-members', projectId], (old) =>
        Array.isArray(old) ? old.map(m => m.user_id === userId ? { ...m, visible_to_client: visible } as any : m) : old
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['project-members', projectId], ctx.prev);
      toast.error(e.response?.data?.message || 'Failed to update visibility');
    },
    onSuccess: () => toast.success('Visibility updated'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });

  const displayMembers = memberTab === 'clients' ? clientMembers : teamMembers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Team & Client Members ({members.length})</h3>
        {canManage && (
          <button onClick={() => { setAddTab(memberTab); setShowAdd(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3 w-3" /> {memberTab === 'clients' ? 'Add Client' : 'Add Member'}
          </button>
        )}
      </div>

      {/* Member list tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
        <button onClick={() => setMemberTab('users')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${memberTab === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <User className="h-3 w-3" /> Users ({teamMembers.length})
        </button>
        <button onClick={() => setMemberTab('clients')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${memberTab === 'clients' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <Building2 className="h-3 w-3" /> Clients ({clientMembers.length})
        </button>
      </div>

      <div className="space-y-2">
        {displayMembers.map(member => {
          const projectRole = (member as any).project_role || member.role || 'member';
          const rc = PROJECT_ROLE_CONFIG[projectRole] || PROJECT_ROLE_CONFIG.member;
          const isClient = (member as any).user_role === 'client';
          return (
            <div key={member.id} className="glass-card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                {member.full_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.full_name}</p>
                {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
              </div>
              {canManage && isClient && (
                <label className="flex items-center gap-1.5 cursor-pointer" title="Allow client to create tasks">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Can create tasks</span>
                  <Switch
                    checked={!!member.can_create_tasks}
                    onCheckedChange={(checked) => toggleTaskMut.mutate({ userId: member.user_id, canCreate: checked })}
                  />
                </label>
              )}
              {canManage && !isClient && (
                <label className="flex items-center gap-1.5 cursor-pointer" title="Show this member to clients in the client portal">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Visible to Client</span>
                  <Switch
                    checked={!!(member as any).visible_to_client}
                    onCheckedChange={(checked) => toggleVisibilityMut.mutate({ userId: member.user_id, visible: checked })}
                  />
                </label>
              )}
              <span className={rc.class}>{rc.label}</span>
              {canManage && projectRole !== 'lead' && (
                <button onClick={() => removeMut.mutate(member.user_id)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {displayMembers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No {memberTab === 'clients' ? 'clients' : 'team members'} added yet</p>
        )}
      </div>

      {/* Add Member/Client modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{addTab === 'clients' ? 'Add Client' : 'Add Member'}</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>

            {/* Tabs inside modal */}
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
              <button onClick={() => { setAddTab('users'); setSelectedUserId(''); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${addTab === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <User className="h-3 w-3" /> Users
              </button>
              <button onClick={() => { setAddTab('clients'); setSelectedUserId(''); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${addTab === 'clients' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Building2 className="h-3 w-3" /> Clients
              </button>
            </div>

            <input placeholder={`Search ${addTab}...`} value={search} onChange={e => setSearch(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {addTab === 'users' && filteredUsers.map((u: any) => (
                <div key={u.id} onClick={() => setSelectedUserId(u.id)} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedUserId === u.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary'}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{u.full_name?.[0]}</div>
                  <div><p className="text-sm font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                </div>
              ))}
              {addTab === 'users' && filteredUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No users found</p>}

              {addTab === 'clients' && clientCompanies.map((c: any) => (
                <div key={c.id} onClick={() => setSelectedUserId(c.id)} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedUserId === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary'}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.email, c.account_manager_name && `AM: ${c.account_manager_name}`].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              ))}
              {addTab === 'clients' && clientCompanies.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No clients found</p>}
            </div>
            {addTab === 'users' && (
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="lead">Lead</option>
              </select>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button
                onClick={() => addTab === 'clients' ? linkClientMut.mutate() : addMut.mutate()}
                disabled={!selectedUserId || addMut.isPending || linkClientMut.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {addTab === 'clients'
                  ? (linkClientMut.isPending ? 'Linking...' : 'Add Client')
                  : (addMut.isPending ? 'Adding...' : 'Add Member')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
