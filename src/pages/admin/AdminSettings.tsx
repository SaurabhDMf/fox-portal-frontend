import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const user = useAuthStore(s => s.user);
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const changePw = async () => {
    if (pw.newPw !== pw.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/change-password', { current_password: pw.current, new_password: pw.newPw });
      toast.success('Password changed');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your preferences</p></div>
      </div>

      {/* Profile */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-muted-foreground">Name</label><p className="text-sm font-medium">{user?.full_name}</p></div>
          <div><label className="text-xs text-muted-foreground">Email</label><p className="text-sm font-medium">{user?.email}</p></div>
          <div><label className="text-xs text-muted-foreground">Role</label><p className="text-sm font-medium capitalize">{user?.role?.replace('_', ' ')}</p></div>
          <div><label className="text-xs text-muted-foreground">Department</label><p className="text-sm font-medium">{user?.department || '—'}</p></div>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Change Password</h2>
        <div className="max-w-sm space-y-3">
          <input type="password" placeholder="Current password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="password" placeholder="New password" value={pw.newPw} onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="password" placeholder="Confirm new password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button onClick={changePw} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
