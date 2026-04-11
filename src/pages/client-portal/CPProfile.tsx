import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { User, Building2, Mail, Phone } from 'lucide-react';

export default function CPProfile() {
  const { data } = useQuery({
    queryKey: ['cp-profile'],
    queryFn: () => api.get('/client/me').then(r => r.data?.data || r.data || {}),
  });
  const profile = data || {};
  const manager = profile.account_manager || {};

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Profile</h1><p className="page-subtitle">Your account information</p></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Info */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Personal Info</h2>
          <div className="space-y-3">
            <InfoRow label="Name" value={profile.full_name || profile.name} />
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Phone" value={profile.phone} />
          </div>
        </div>

        {/* Company Info */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company</h2>
          <div className="space-y-3">
            <InfoRow label="Company" value={profile.company_name || profile.organization_name} />
            <InfoRow label="Industry" value={profile.industry} />
            <InfoRow label="Website" value={profile.website} link />
          </div>
        </div>

        {/* Account Manager */}
        {manager.name && (
          <div className="glass-card p-6 space-y-4 md:col-span-2">
            <h2 className="text-sm font-semibold">Your Account Manager</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                {manager.name?.[0] || 'M'}
              </div>
              <div>
                <div className="font-medium">{manager.name}</div>
                {manager.email && (
                  <a href={`mailto:${manager.email}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {manager.email}
                  </a>
                )}
                {manager.phone && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3.5 w-3.5" /> {manager.phone}
                  </div>
                )}
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
