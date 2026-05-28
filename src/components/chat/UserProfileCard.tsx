import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MessageSquare, X, Mail, Briefcase, Building2, Phone, Loader2 } from 'lucide-react';

interface Props {
  user: { id: string; full_name?: string; email?: string; job_title?: string; department?: string; avatar_url?: string };
  onClose: () => void;
  onOpenDM?: (roomId: string) => void;
}

export default function UserProfileCard({ user: u, onClose, onOpenDM }: Props) {
  const qc = useQueryClient();

  // Fetch full profile for richer details (email, position, dept, phone)
  const { data: full, isLoading } = useQuery({
    queryKey: ['user-profile', u.id],
    queryFn: () => api.get(`/users/${u.id}`).then(r => r.data?.data || r.data),
    enabled: !!u.id,
    staleTime: 60_000,
  });

  const profile = { ...u, ...(full || {}) } as any;

  const dmMut = useMutation({
    mutationFn: () => api.post('/chat/direct', { user_id: u.id }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      const id = res.data?.data?.id || res.data?.id || res.data?.room?.id;
      if (id && onOpenDM) onOpenDM(id);
      onClose();
    },
  });

  const bg = `hsl(${Math.abs(hash(profile.full_name || '')) % 360}, 60%, 45%)`;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-2xl w-72 overflow-hidden">
      {/* Header band */}
      <div className="relative h-16" style={{ background: `linear-gradient(135deg, ${bg}, hsl(var(--primary)))` }}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-md bg-background/20 hover:bg-background/40 text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Avatar overlapping the band */}
      <div className="px-4 pb-4 -mt-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ring-4 ring-card mb-3"
          style={{ backgroundColor: bg, color: '#fff' }}
        >
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            : (profile.full_name?.[0] || '?').toUpperCase()}
        </div>

        <h4 className="font-semibold text-base leading-tight">{profile.full_name || 'Unknown User'}</h4>
        {profile.role && (
          <p className="text-[11px] uppercase tracking-wider text-primary font-medium mt-0.5">
            {String(profile.role).replace(/_/g, ' ')}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading details…
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {profile.job_title && (
              <Row icon={<Briefcase className="h-3.5 w-3.5" />} text={profile.job_title} />
            )}
            {profile.department && (
              <Row icon={<Building2 className="h-3.5 w-3.5" />} text={profile.department} />
            )}
            {profile.email && (
              <Row icon={<Mail className="h-3.5 w-3.5" />} text={profile.email} />
            )}
            {profile.phone && (
              <Row icon={<Phone className="h-3.5 w-3.5" />} text={profile.phone} />
            )}
            {!profile.job_title && !profile.department && !profile.email && !profile.phone && (
              <p className="text-xs text-muted-foreground italic">No additional details available</p>
            )}
          </div>
        )}

        <button
          onClick={() => dmMut.mutate()}
          disabled={dmMut.isPending}
          className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {dmMut.isPending ? 'Opening…' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-foreground/80 min-w-0">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
