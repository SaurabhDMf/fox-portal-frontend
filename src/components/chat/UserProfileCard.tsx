import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MessageSquare, X } from 'lucide-react';

interface Props {
  user: { id: string; full_name?: string; email?: string; job_title?: string; department?: string; avatar_url?: string };
  onClose: () => void;
  onOpenDM?: (roomId: string) => void;
}

export default function UserProfileCard({ user: u, onClose, onOpenDM }: Props) {
  const qc = useQueryClient();
  const dmMut = useMutation({
    mutationFn: () => api.post('/chat/direct', { user_id: u.id }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      const id = res.data?.data?.id || res.data?.id || res.data?.room?.id;
      if (id && onOpenDM) onOpenDM(id);
      onClose();
    },
  });

  const bg = `hsl(${Math.abs(hash(u.full_name || '')) % 360}, 60%, 45%)`;

  return (
    <div className="absolute z-50 bg-card border border-border rounded-xl shadow-xl p-4 w-64">
      <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2"
          style={{ backgroundColor: bg, color: '#fff' }}>
          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" /> : (u.full_name?.[0] || '?').toUpperCase()}
        </div>
        <h4 className="font-semibold text-sm">{u.full_name}</h4>
        {u.job_title && <p className="text-xs text-muted-foreground">{u.job_title}</p>}
        {u.department && <p className="text-xs text-muted-foreground">{u.department}</p>}
        {u.email && <p className="text-xs text-muted-foreground mt-1">{u.email}</p>}
        <button onClick={() => dmMut.mutate()} disabled={dmMut.isPending}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <MessageSquare className="h-3.5 w-3.5" /> Send Message
        </button>
      </div>
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
