import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Download, FileText } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'bg-info/15 text-info',
  nda: 'bg-purple-500/15 text-purple-500',
  sow: 'bg-warning/15 text-warning',
  proposal: 'bg-success/15 text-success',
  invoice: 'bg-destructive/15 text-destructive',
};

export default function CPDocuments() {
  const { data = [] } = useQuery({
    queryKey: ['cp-documents'],
    queryFn: () => api.get('/client/documents').then(r => r.data?.data || r.data?.documents || r.data || []),
  });
  const docs = Array.isArray(data) ? data : [];

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Documents</h1><p className="page-subtitle">Files shared with you</p></div></div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Title</th>
              <th className="p-4">Category</th>
              <th className="p-4">Type</th>
              <th className="p-4">Uploaded By</th>
              <th className="p-4">Date</th>
              <th className="p-4">Download</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc: any) => {
              const cat = (doc.category || 'other').toLowerCase();
              const catCls = CATEGORY_COLORS[cat] || 'bg-secondary text-muted-foreground';
              return (
                <tr key={doc.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{doc.title || doc.file_name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${catCls}`}>{cat}</span>
                  </td>
                  <td className="p-4 text-muted-foreground uppercase text-xs">{doc.file_type || '—'}</td>
                  <td className="p-4 text-muted-foreground">{doc.uploaded_by_name || '—'}</td>
                  <td className="p-4 text-muted-foreground">{fmtDate(doc.created_at)}</td>
                  <td className="p-4">
                    {(doc.file_url || doc.url) && (
                      <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
                        <Download className="h-4 w-4" /> Download
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">No documents found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
