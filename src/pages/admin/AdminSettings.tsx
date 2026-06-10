import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { User, Shield, Bell, Pencil, X, Building2, Plug, Mail, FileText } from 'lucide-react';
import CompanySettings from '@/components/settings/CompanySettings';
import IntegrationsSettings from '@/components/settings/IntegrationsSettings';
import EmailSettings from '@/components/settings/EmailSettings';
import ChangePasswordSection from '@/components/settings/ChangePasswordSection';
import ConnectedEmailCard from '@/components/settings/ConnectedEmailCard';
import InvoiceSettings from '@/components/settings/InvoiceSettings';

const tabs = [
  { id: 'profile',      label: 'Profile',      icon: User                        },
  { id: 'company',      label: 'Company',       icon: Building2                   },
  { id: 'invoice',      label: 'Invoice',       icon: FileText,  adminOnly: true  },
  { id: 'integrations', label: 'Integrations',  icon: Plug,      adminOnly: true  },
  { id: 'email',        label: 'Email',         icon: Mail,      adminOnly: true  },
  { id: 'security',     label: 'Security',      icon: Shield                      },
  { id: 'notifications',label: 'Notifications', icon: Bell                        },
];

const notificationSettings = [
  { key: 'new_lead', label: 'New Lead Assigned', desc: 'Get notified when a lead is assigned to you' },
  { key: 'invoice_paid', label: 'Invoice Paid', desc: 'When a client pays an invoice' },
  { key: 'ticket_reply', label: 'Ticket Reply', desc: 'When someone replies to a ticket' },
  { key: 'task_assigned', label: 'Task Assigned', desc: 'When a task is assigned to you' },
  { key: 'chat_message', label: 'Chat Message', desc: 'New messages in your chat rooms' },
  { key: 'leave_approved', label: 'Leave Request Update', desc: 'When your leave request is reviewed' },
];

export default function AdminSettings() {
  const user = useAuthStore(s => s.user);
  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'profile');
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '', department: user?.department || '', job_title: user?.job_title || '' });
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(notificationSettings.map(n => [n.key, true]))
  );

  const toggleNotification = (key: string) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Preference updated');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your preferences</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="space-y-4">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Profile Information</h2>
            <button onClick={() => { setEditingProfile(!editingProfile); setProfileForm({ full_name: user?.full_name || '', department: user?.department || '', job_title: user?.job_title || '' }); }} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              {editingProfile ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5" /> Edit Profile</>}
            </button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl">
              {user?.full_name?.[0]}
            </div>
            <div>
              <h3 className="text-lg font-bold">{user?.full_name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {editingProfile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Full Name</label>
                  <input value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Department</label>
                  <input value={profileForm.department} onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Job Title</label>
                  <input value={profileForm.job_title} onChange={e => setProfileForm(f => ({ ...f, job_title: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingProfile(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
                <button onClick={async () => {
                  setSaving(true);
                  try {
                    await api.put('/users/profile', profileForm);
                    const state = useAuthStore.getState();
                    if (state.user) {
                      setAuth({ ...state, user: { ...state.user, ...profileForm }, accessToken: state.accessToken!, refreshToken: state.refreshToken!, permissions: state.permissions });
                    }
                    toast.success('Profile updated');
                    setEditingProfile(false);
                  } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
                  finally { setSaving(false); }
                }} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-muted-foreground">Full Name</label><p className="text-sm font-medium mt-0.5">{user?.full_name}</p></div>
              <div><label className="text-xs text-muted-foreground">Email</label><p className="text-sm font-medium mt-0.5">{user?.email}</p></div>
              <div><label className="text-xs text-muted-foreground">Role</label><p className="text-sm font-medium mt-0.5 capitalize">{user?.role?.replace('_', ' ')}</p></div>
              <div><label className="text-xs text-muted-foreground">Department</label><p className="text-sm font-medium mt-0.5">{user?.department || '—'}</p></div>
              <div><label className="text-xs text-muted-foreground">Job Title</label><p className="text-sm font-medium mt-0.5">{user?.job_title || '—'}</p></div>
            </div>
          )}
        </div>
        <ConnectedEmailCard />
        </div>
      )}

      {/* Company Profile */}
      {tab === 'company' && <CompanySettings />}

      {/* Invoice Settings */}
      {tab === 'invoice' && isAdmin && <InvoiceSettings />}

      {/* Integrations */}
      {tab === 'integrations' && isAdmin && <IntegrationsSettings />}

      {/* Email (SMTP) */}
      {tab === 'email' && isAdmin && <EmailSettings />}

      {/* Security */}
      {tab === 'security' && <ChangePasswordSection />}

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

    </div>
  );
}
