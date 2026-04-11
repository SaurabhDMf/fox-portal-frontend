import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { User, Building2, Mail, Phone, MapPin } from 'lucide-react';

export default function CPProfile() {
  const { data } = useQuery({
    queryKey: ['cp-profile'],
    queryFn: () => api.get('/client/me').then(r => r.data?.data || r.data || {}),
  });

  const profile = data || {};
  const user = profile.user || profile;
  const client = profile.client || profile;
  const manager = profile.account_manager || {};

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Profile</h1><p className="page-subtitle">Your account information</p></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Account */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> My Account</h2>
          <div className="flex items-center gap-3 mb-2">
            {user.avatar_url ? (
              <img src={user.avatar_url} className="w-12 h-12 rounded-full" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                {(user.full_name || user.name || 'U')[0]}
              </div>
            )}
            <div>
              <div className="font-medium">{user.full_name || user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company</h2>
          <div className="space-y-3">
            <InfoRow label="Company" value={client.company_name || client.organization_name} />
            <InfoRow label="Industry" value={client.industry} />
            <InfoRow label="Website" value={client.website} link />
            {(client.city || client.state || client.country) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</span>
                <span className="font-medium">{[client.city, client.state, client.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <InfoRow label="GST" value={client.gst_number} />
            <InfoRow label="PAN" value={client.pan_number} />
          </div>
        </div>

        {/* Account Manager */}
        {(manager.name || manager.account_manager_name) && (
          <div className="glass-card p-6 space-y-4 md:col-span-2">
            <h2 className="text-sm font-semibold">Your Account Manager</h2>
            <div className="flex items-center gap-4">
              {manager.avatar_url || manager.avatar ? (
                <img src={manager.avatar_url || manager.avatar} className="w-12 h-12 rounded-full" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                  {(manager.name || manager.account_manager_name || 'M')[0]}
                </div>
              )}
              <div>
                <div className="font-medium">{manager.name || manager.account_manager_name}</div>
                {(manager.email || manager.account_manager_email) && (
                  <a href={`mailto:${manager.email || manager.account_manager_email}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {manager.email || manager.account_manager_email}
                  </a>
                )}
                {manager.phone && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3.5 w-3.5" /> {manager.phone}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">Contact your account manager for any queries</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {link && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{value}</a>
      ) : (
        <span className="font-medium">{value || '—'}</span>
      )}
    </div>
  );
}
