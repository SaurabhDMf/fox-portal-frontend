import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function SAPermissions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () => api.get('/permissions/matrix').then(r => r.data),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put('/permissions/override', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['permissions-matrix'] }); toast.success('Updated'); },
  });

  const matrix = data?.matrix || data || {};
  const roles = Object.keys(matrix);
  const modules = roles.length > 0 ? Object.keys(matrix[roles[0]] || {}) : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Permission Matrix</h1><p className="page-subtitle">Manage role-based access control</p></div>
      </div>
      {isLoading ? <div className="glass-card h-64 animate-pulse" /> : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3 sticky left-0 bg-card">Module</th>
                {roles.map(r => <th key={r} className="p-3 text-center capitalize">{r.replace('_', ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => (
                <tr key={mod} className="border-b border-border/50">
                  <td className="p-3 font-medium capitalize sticky left-0 bg-card">{mod.replace('_', ' ')}</td>
                  {roles.map(role => {
                    const perm = matrix[role]?.[mod] || {};
                    return (
                      <td key={role} className="p-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                            <button
                              key={action}
                              onClick={() => updateMut.mutate({ role, module: mod, [action]: !perm[action] })}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${perm[action] ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'}`}
                            >
                              {action.replace('can_', '').charAt(0).toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
