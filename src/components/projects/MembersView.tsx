import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectMember } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, X, Shield, User, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/usePermission';

interface Props {
  projectId: string;
}

const ROLE_CONFIG: Record<string, { icon: typeof Shield; label: string; class: string }> = {
  lead: { icon: Shield, label: 'Lead', class: 'badge-primary' },
  member: { icon: User, label: 'Member', class: 'badge-info' },
  viewer: { icon: Eye, label: 'Viewer', class: 'badge-neutral' },
};

export default function MembersView({ projectId }: Props) {
  const role = useRole();
  const canManage = role === 'admin' || role === 'super_admin' || role === 'manager' || role === 'sales_manager';
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('member');

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray<ProjectMember>(r.data, ['members', 'users'])),
  });
  const members: ProjectMember[] = Array.isArray(membersRaw) ? membersRaw : [];

  const { data: usersRaw } = useQuery({
    queryKey: ['all-users', search],
    queryFn: () => api.get('/users', { params: search ? { search } : undefined }).then(r => {
      const d = r.data;
      return d?.users || d?.data?.users || d?.data?.items || d?.items || d?.data || d || [];
    }),
    enabled: showAdd,
  });
  const allUsers = Array.isArray(usersRaw) ? usersRaw : [];
  const memberUserIds = new Set(members.map(m => m.user_id));
  const availableUsers = allUsers.filter((u: any) => !memberUserIds.has(u.id) && (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())));

  const addMut = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/members`, { user_id: selectedUserId, role: selectedRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); setShowAdd(false); setSelectedUserId(''); toast.success('Member added'); },
  });

  const removeMut = useMutation({
    mutationFn: (memberId: string) => api.delete(`/projects/${projectId}/members/${memberId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); toast.success('Member removed'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Team Members ({members.length})</h3>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3 w-3" /> Add Member
          </button>
        )}
      </div>

      <div className="space-y-2">
        {members.map(member => {
          const rc = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
          return (
            <div key={member.id} className="glass-card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                {member.full_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.full_name}</p>
                {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
              </div>
              <span className={rc.class}>{rc.label}</span>
              {canManage && member.role !== 'lead' && (
                <button onClick={() => removeMut.mutate(member.id)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Member modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Member</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableUsers.map((u: any) => (
                <div key={u.id} onClick={() => setSelectedUserId(u.id)} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedUserId === u.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary'}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{u.full_name?.[0]}</div>
                  <div><p className="text-sm font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                </div>
              ))}
              {availableUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No users found</p>}
            </div>
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="lead">Lead</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => addMut.mutate()} disabled={!selectedUserId || addMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {addMut.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
