import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Download } from 'lucide-react';

export default function CPDocuments() {
  const { data = [] } = useQuery({
    queryKey: ['cp-documents'],
    queryFn: () => api.get('/client/documents').then(r => r.data?.data || r.data?.documents || r.data || []),
  });
  const docs = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Documents</h1><p className="page-subtitle">Shared files and documents</p></div></div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Title</th>
              <th className="p-4">Category</th>
              <th className="p-4">Date</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d: any) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground uppercase flex-shrink-0">
                      {d.file_type || d.category?.[0] || 'DOC'}
                    </div>
                    <span className="font-medium">{d.title || d.name}</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">{d.category || '—'}</td>
                <td className="p-4 text-muted-foreground">{d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="p-4">
                  {(d.file_url || d.url) && (
                    <a href={d.file_url || d.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">No documents shared</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
