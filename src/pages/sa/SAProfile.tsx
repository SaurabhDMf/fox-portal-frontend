import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Camera, Save, Key, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SAProfile() {
  const { user, setAuth, accessToken, refreshToken, permissions } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState(user?.avatar_url || '');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setLogoPreview(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      return toast.error('Name and email are required');
    }
    setSaving(true);
    setTimeout(() => {
      setAuth({
        accessToken: accessToken || '',
        refreshToken: refreshToken || '',
        user: { ...user!, full_name: form.full_name, email: form.email, avatar_url: logoPreview },
        permissions,
      });
      setSaving(false);
      toast.success('Profile updated');
    }, 500);
  };

  const handleChangePassword = () => {
    if (!passwordForm.current) return toast.error('Enter current password');
    if (passwordForm.newPass.length < 8) return toast.error('New password must be at least 8 characters');
    if (passwordForm.newPass !== passwordForm.confirm) return toast.error('Passwords do not match');
    toast.success('Password updated successfully');
    setPasswordForm({ current: '', newPass: '', confirm: '' });
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all';
  const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account settings</p>
        </div>
      </div>

      {/* Avatar / Logo */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative group">
            {logoPreview ? (
              <img src={logoPreview} alt="Avatar" className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary/15 flex items-center justify-center text-primary text-2xl font-bold">
                {user?.full_name?.[0] || 'S'}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-xl bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <Camera className="h-5 w-5 text-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Click to upload a new profile photo.</p>
            <p className="text-xs mt-1">JPG, PNG or SVG. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="glass-card p-6 space-y-5 mt-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Account Details</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email Address</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-sm">
            <span className="text-xs text-muted-foreground block">Role</span>
            <span className="font-medium capitalize">{user?.role?.replace('_', ' ') || 'Super Admin'}</span>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-6 space-y-5 mt-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Current Password</label>
            <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} className={inputClass} placeholder="••••••••" />
          </div>
          <div>
            <label className={labelClass}>New Password</label>
            <input type="password" value={passwordForm.newPass} onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))} className={inputClass} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className={labelClass}>Confirm New Password</label>
            <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} className={inputClass} placeholder="Re-enter new password" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleChangePassword} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Key className="h-4 w-4" /> Update Password
          </button>
        </div>
      </div>
    </div>
  );
}
