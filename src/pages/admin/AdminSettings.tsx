import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { User, Shield, Bell, Palette } from 'lucide-react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const notificationSettings = [
  { key: 'new_lead', label: 'New Lead Assigned', desc: 'Get notified when a lead is assigned to you' },
  { key: 'invoice_paid', label: 'Invoice Paid', desc: 'When a client pays an invoice' },
  { key: 'ticket_reply', label: 'Ticket Reply', desc: 'When someone replies to a ticket' },
  { key: 'task_assigned', label: 'Task Assigned', desc: 'When a task is assigned to you' },
  { key: 'chat_message', label: 'Chat Message', desc: 'New messages in your chat rooms' },
  { key: 'leave_approved', label: 'Leave Request Update', desc: 'When your leave request is reviewed' },
];

const accentColors = [
  { name: 'Indigo', value: '244 94% 62%' },
  { name: 'Emerald', value: '157 87% 46%' },
  { name: 'Blue', value: '213 100% 62%' },
  { name: 'Amber', value: '35 100% 63%' },
  { name: 'Rose', value: '4 100% 64%' },
  { name: 'Violet', value: '270 80% 60%' },
];

export default function AdminSettings() {
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState('profile');
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(notificationSettings.map(n => [n.key, true]))
  );
  const [selectedAccent, setSelectedAccent] = useState('244 94% 62%');

  const changePw = async () => {
    if (pw.newPw !== pw.confirm) return toast.error('Passwords do not match');
    if (pw.newPw.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await api.put('/auth/change-password', { current_password: pw.current, new_password: pw.newPw });
      toast.success('Password changed');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const toggleNotification = (key: string) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Preference updated');
  };

  const applyAccent = (value: string) => {
    setSelectedAccent(value);
    document.documentElement.style.setProperty('--primary', value);
    document.documentElement.style.setProperty('--accent', value);
    document.documentElement.style.setProperty('--ring', value);
    toast.success('Accent color applied');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your preferences</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Profile Information</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl">
              {user?.full_name?.[0]}
            </div>
            <div>
              <h3 className="text-lg font-bold">{user?.full_name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-xs text-muted-foreground">Full Name</label><p className="text-sm font-medium mt-0.5">{user?.full_name}</p></div>
            <div><label className="text-xs text-muted-foreground">Email</label><p className="text-sm font-medium mt-0.5">{user?.email}</p></div>
            <div><label className="text-xs text-muted-foreground">Role</label><p className="text-sm font-medium mt-0.5 capitalize">{user?.role?.replace('_', ' ')}</p></div>
            <div><label className="text-xs text-muted-foreground">Department</label><p className="text-sm font-medium mt-0.5">{user?.department || '—'}</p></div>
            <div><label className="text-xs text-muted-foreground">Job Title</label><p className="text-sm font-medium mt-0.5">{user?.job_title || '—'}</p></div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Change Password</h2>
          <div className="max-w-sm space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Current Password</label>
              <input type="password" placeholder="Enter current password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">New Password</label>
              <input type="password" placeholder="Enter new password" value={pw.newPw} onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Confirm New Password</label>
              <input type="password" placeholder="Confirm new password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <button onClick={changePw} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Notification Preferences</h2>
          <div className="space-y-1">
            {notificationSettings.map(n => (
              <div key={n.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground">{n.desc}</div>
                </div>
                <button
                  onClick={() => toggleNotification(n.key)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${notifications[n.key] ? 'bg-primary' : 'bg-secondary border border-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifications[n.key] ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appearance */}
      {tab === 'appearance' && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Accent Color</h2>
            <p className="text-xs text-muted-foreground">Choose the primary accent color for the interface</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {accentColors.map(c => (
                <button
                  key={c.value}
                  onClick={() => applyAccent(c.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${selectedAccent === c.value ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-secondary'}`}
                >
                  <div className="w-8 h-8 rounded-full" style={{ background: `hsl(${c.value})` }} />
                  <span className="text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Theme</h2>
            <div className="flex gap-3">
              <button className="flex-1 p-4 rounded-xl bg-primary/10 border-2 border-primary text-center">
                <div className="w-full h-16 rounded-lg bg-[hsl(240,30%,6%)] mb-2 border border-border" />
                <span className="text-xs font-medium">Dark</span>
              </button>
              <button className="flex-1 p-4 rounded-xl bg-secondary text-center opacity-50 cursor-not-allowed">
                <div className="w-full h-16 rounded-lg bg-muted mb-2 border border-border" />
                <span className="text-xs font-medium text-muted-foreground">Light (Coming Soon)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
