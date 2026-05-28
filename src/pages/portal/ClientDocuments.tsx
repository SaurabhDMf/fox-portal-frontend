import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Download } from 'lucide-react';

export default function ClientDocuments() {
  const user = useAuthStore(s => s.user);
  const { data = [] } = useQuery({
    queryKey: ['my-documents'],
    queryFn: () => api.get('/documents', { params: { related_type: 'client', related_id: user?.id } }).then(r => r.data?.documents || r.data || []),
  });
  const docs = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Documents</h1><p className="page-subtitle">Shared files and documents</p></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((d: any) => (
          <div key={d.id} className="glass-card-hover p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">{d.file_type || 'DOC'}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{d.name}</div><div className="text-xs text-muted-foreground">{d.file_size || ''}</div></div>
            {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Download className="h-4 w-4" /></a>}
          </div>
        ))}
        {docs.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No documents shared</div>}
      </div>
    </div>
  );
}
