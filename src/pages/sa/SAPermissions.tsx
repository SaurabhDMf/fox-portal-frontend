import { useState } from 'react';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';

type PermAction = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';

const ROLES = ['admin', 'sales_manager', 'sales_rep', 'resource', 'freelancer', 'client'] as const;
const MODULES = ['crm', 'invoicing', 'clients', 'projects', 'tickets', 'chat', 'vault', 'tracker', 'payroll', 'users', 'reports'] as const;
const ACTIONS: { key: PermAction; label: string; short: string }[] = [
  { key: 'can_view', label: 'View', short: 'V' },
  { key: 'can_create', label: 'Create', short: 'C' },
  { key: 'can_edit', label: 'Edit', short: 'E' },
  { key: 'can_delete', label: 'Delete', short: 'D' },
];

const STORAGE_KEY = 'fox-portal-permissions-matrix';

function getDefaultMatrix(): Record<string, Record<string, Record<PermAction, boolean>>> {
  const m: any = {};
  for (const role of ROLES) {
    m[role] = {};
    for (const mod of MODULES) {
      const isAdmin = role === 'admin';
      const isSales = role === 'sales_manager' || role === 'sales_rep';
      m[role][mod] = {
        can_view: isAdmin || (isSales && ['crm', 'invoicing', 'clients', 'projects', 'chat'].includes(mod)),
        can_create: isAdmin || (isSales && ['crm', 'invoicing', 'clients'].includes(mod)),
        can_edit: isAdmin || (isSales && ['crm', 'invoicing'].includes(mod)),
        can_delete: isAdmin,
      };
    }
  }
  return m;
}

function loadMatrix() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultMatrix();
  } catch { return getDefaultMatrix(); }
}

function saveMatrix(m: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export default function SAPermissions() {
  const [matrix, setMatrix] = useState(loadMatrix);
  const [expandedRole, setExpandedRole] = useState<string | null>('admin');

  const toggle = (role: string, mod: string, action: PermAction) => {
    const next = { ...matrix };
    next[role] = { ...next[role] };
    next[role][mod] = { ...next[role][mod], [action]: !next[role][mod][action] };
    setMatrix(next);
    saveMatrix(next);
  };

  const toggleAll = (role: string, mod: string, value: boolean) => {
    const next = { ...matrix };
    next[role] = { ...next[role] };
    next[role][mod] = { can_view: value, can_create: value, can_edit: value, can_delete: value };
    setMatrix(next);
    saveMatrix(next);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Permission Matrix</h1>
          <p className="page-subtitle">Manage role-based access control across all modules</p>
        </div>
      </div>

      <div className="space-y-3">
        {ROLES.map(role => {
          const isExpanded = expandedRole === role;
          return (
            <div key={role} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedRole(isExpanded ? null : role)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm capitalize">{role.replace('_', ' ')}</span>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="p-3">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a.key} className="p-3 text-center">{a.label}</th>
                        ))}
                        <th className="p-3 text-center">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => {
                        const perms = matrix[role]?.[mod] || {};
                        const allOn = ACTIONS.every(a => perms[a.key]);
                        return (
                          <tr key={mod} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="p-3 font-medium capitalize">{mod.replace('_', ' ')}</td>
                            {ACTIONS.map(a => (
                              <td key={a.key} className="p-3 text-center">
                                <button
                                  onClick={() => toggle(role, mod, a.key)}
                                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                    perms[a.key]
                                      ? 'bg-primary/20 text-primary border border-primary/30'
                                      : 'bg-secondary text-muted-foreground border border-border hover:border-muted-foreground/50'
                                  }`}
                                >
                                  {a.short}
                                </button>
                              </td>
                            ))}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => toggleAll(role, mod, !allOn)}
                                className={`text-[10px] px-2.5 py-1.5 rounded-md font-medium transition-all ${
                                  allOn
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {allOn ? 'Revoke' : 'Grant'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
