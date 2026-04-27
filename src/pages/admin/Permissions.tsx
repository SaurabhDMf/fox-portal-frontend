import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Check, X, Loader2 } from 'lucide-react';

const MODULES = ['crm', 'invoicing', 'clients', 'chat', 'projects', 'tasks', 'expenses', 'vault', 'payroll', 'tracker', 'tickets', 'users', 'reports'] as const;
const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] as const;
const ACTION_LABELS: Record<string, string> = { can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_delete: 'Delete', can_export: 'Export' };

export default function Permissions() {
  const user = useAuthStore(s => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: async () => {
      const res = await api.get('/permissions/my');
      return res.data?.data || res.data;
    },
  });

  const permissions = data?.permissions as Record<string, Record<string, boolean>> | undefined;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Permissions</h1>
          <p className="page-subtitle">
            Read-only view of your current role permissions
            {data?.role && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium capitalize"><Shield className="h-3 w-3" />{data.role.replace('_', ' ')}</span>}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !permissions ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          Unable to load permissions data.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</th>
                  {ACTIONS.map(a => (
                    <th key={a} className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{ACTION_LABELS[a]}</th>
                  ))}
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scope</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map(mod => {
                  const mp = permissions[mod];
                  if (!mp) return (
                    <tr key={mod} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium capitalize">{mod}</td>
                      {ACTIONS.map(a => (
                        <td key={a} className="text-center px-3 py-3"><X className="h-4 w-4 text-muted-foreground/40 mx-auto" /></td>
                      ))}
                      <td className="text-center px-3 py-3 text-xs text-muted-foreground">—</td>
                    </tr>
                  );
                  return (
                    <tr key={mod} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium capitalize">{mod}</td>
                      {ACTIONS.map(a => (
                        <td key={a} className="text-center px-3 py-3">
                          {mp[a] ? (
                            <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                      ))}
                      <td className="text-center px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${mp.own_only ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                          {mp.own_only ? 'Own Only' : 'All'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
