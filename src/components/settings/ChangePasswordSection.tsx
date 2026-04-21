import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

export default function ChangePasswordSection() {
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });

  const mut = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', {
        currentPassword: pw.current,
        newPassword: pw.newPw,
      }),
    onSuccess: () => {
      toast.success('Password changed');
      setPw({ current: '', newPw: '', confirm: '' });
    },
    onError: (e: any) =>
      toast.error(
        e.response?.data?.message || e.response?.data?.error || 'Error changing password'
      ),
  });

  const handleSubmit = () => {
    if (!pw.current || !pw.newPw || !pw.confirm) {
      return toast.error('All fields are required');
    }
    if (pw.newPw !== pw.confirm) {
      return toast.error('New passwords do not match');
    }
    if (pw.newPw.length < 8) {
      return toast.error('New password must be at least 8 characters');
    }
    mut.mutate();
  };

  const PwField = ({
    label,
    field,
  }: {
    label: string;
    field: 'current' | 'newPw' | 'confirm';
  }) => (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type={show[field] ? 'text' : 'password'}
          value={pw[field]}
          onChange={e => setPw(p => ({ ...p, [field]: e.target.value }))}
          placeholder={label}
          className={inputCls + ' pr-10'}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-sm font-semibold">Change Password</h2>
      <div className="max-w-sm space-y-3">
        <PwField label="Current Password" field="current" />
        <PwField label="New Password" field="newPw" />
        <PwField label="Confirm New Password" field="confirm" />
        <p className="text-[11px] text-muted-foreground">
          Password must be at least 8 characters.
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mut.isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {mut.isPending ? 'Saving...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
