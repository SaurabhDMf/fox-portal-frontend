import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function EmpProfile() {
  const user = useAuthStore(s => s.user);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: user?.full_name || '', department: user?.department || '', job_title: user?.job_title || '' });
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get(`/users/${user?.id}`).then(r => r.data),
    enabled: !!user?.id,
  });

  const p = profile || user || {};

  const saveProfile = async () => {
    try {
      await api.put(`/users/${user?.id}`, form);
      toast.success('Profile updated');
      setEditing(false);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const changePw = async () => {
    if (pw.newPw !== pw.confirm) return toast.error('Passwords do not match');
    try {
      await api.put('/auth/change-password', { current_password: pw.current, new_password: pw.newPw });
      toast.success('Password changed');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">My Profile</h1><p className="page-subtitle">Manage your account</p></div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl">{p.full_name?.[0]}</div>
          <div>
            <h2 className="text-lg font-bold">{p.full_name}</h2>
            <p className="text-sm text-muted-foreground">{p.email}</p>
            <span className="badge-primary capitalize mt-1 inline-block">{p.role?.replace('_', ' ')}</span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3 max-w-md">
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full Name" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Department" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Job Title" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex gap-2">
              <button onClick={saveProfile} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">Save</button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground block text-xs">Department</span>{p.department || '—'}</div>
              <div><span className="text-muted-foreground block text-xs">Job Title</span>{p.job_title || '—'}</div>
              <div><span className="text-muted-foreground block text-xs">Employment</span>{p.employment_type || '—'}</div>
              <div><span className="text-muted-foreground block text-xs">Joined</span>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</div>
            </div>
            <button onClick={() => setEditing(true)} className="mt-3 px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors">Edit Profile</button>
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Change Password</h3>
        <div className="max-w-sm space-y-3">
          <input type="password" placeholder="Current password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="password" placeholder="New password" value={pw.newPw} onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="password" placeholder="Confirm password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button onClick={changePw} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">Update Password</button>
        </div>
      </div>
    </div>
  );
}
