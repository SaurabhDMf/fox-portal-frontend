/**
 * Role-based permission system
 * 
 * Roles hierarchy:
 *   super_admin / admin — full access to everything
 *   sales_manager — full CRM + team data, read-only on finance modules
 *   sales_rep — own CRM data only, no access to payroll/users/settings
 *   resource / freelancer — own tasks/projects, time tracker, own payroll
 *   client — portal only (invoices, projects, support)
 */

export type AppRole = 'super_admin' | 'admin' | 'sales_manager' | 'sales_rep' | 'resource' | 'freelancer' | 'client';

export type Module = 
  | 'dashboard' | 'crm' | 'invoicing' | 'clients' | 'projects' 
  | 'vault' | 'tickets' | 'tracker' | 'payroll' | 'users' 
  | 'reports' | 'settings' | 'chat';

export interface ModulePermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  /** If true, user only sees records they created or are assigned to */
  ownOnly: boolean;
  /** If true, user sees their team's data (for managers) */
  teamOnly: boolean;
}

const FULL: ModulePermission = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, ownOnly: false, teamOnly: false };
const VIEW_ONLY: ModulePermission = { canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false, ownOnly: false, teamOnly: false };
const OWN_CRUD: ModulePermission = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: false, ownOnly: true, teamOnly: false };
const TEAM_CRUD: ModulePermission = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, ownOnly: false, teamOnly: true };
const NONE: ModulePermission = { canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false, ownOnly: false, teamOnly: false };

/**
 * Permission matrix: role → module → permissions
 */
const permissionMatrix: Record<string, Record<Module, ModulePermission>> = {
  super_admin: {
    dashboard: FULL, crm: FULL, invoicing: FULL, clients: FULL, projects: FULL,
    vault: FULL, tickets: FULL, tracker: FULL, payroll: FULL, users: FULL,
    reports: FULL, settings: FULL, chat: FULL,
  },
  admin: {
    dashboard: FULL, crm: FULL, invoicing: FULL, clients: FULL, projects: FULL,
    vault: FULL, tickets: FULL, tracker: FULL, payroll: FULL, users: FULL,
    reports: FULL, settings: FULL, chat: FULL,
  },
  sales_manager: {
    dashboard: { ...FULL, ownOnly: false, teamOnly: true },
    crm: TEAM_CRUD,
    invoicing: VIEW_ONLY,
    clients: TEAM_CRUD,
    projects: VIEW_ONLY,
    vault: NONE,
    tickets: TEAM_CRUD,
    tracker: TEAM_CRUD,
    payroll: NONE,
    users: VIEW_ONLY,
    reports: { ...VIEW_ONLY, canExport: true },
    settings: NONE,
    chat: FULL,
  },
  sales_rep: {
    dashboard: { ...VIEW_ONLY, ownOnly: true },
    crm: OWN_CRUD,
    invoicing: NONE,
    clients: { ...VIEW_ONLY, ownOnly: true },
    projects: NONE,
    vault: NONE,
    tickets: OWN_CRUD,
    tracker: OWN_CRUD,
    payroll: NONE,
    users: NONE,
    reports: NONE,
    settings: NONE,
    chat: FULL,
  },
  resource: {
    dashboard: { ...VIEW_ONLY, ownOnly: true },
    crm: NONE,
    invoicing: NONE,
    clients: NONE,
    projects: { ...VIEW_ONLY, ownOnly: true },
    vault: NONE,
    tickets: OWN_CRUD,
    tracker: OWN_CRUD,
    payroll: { ...VIEW_ONLY, ownOnly: true },
    users: NONE,
    reports: NONE,
    settings: NONE,
    chat: FULL,
  },
  freelancer: {
    dashboard: { ...VIEW_ONLY, ownOnly: true },
    crm: NONE,
    invoicing: NONE,
    clients: NONE,
    projects: { ...VIEW_ONLY, ownOnly: true },
    vault: NONE,
    tickets: OWN_CRUD,
    tracker: OWN_CRUD,
    payroll: { ...VIEW_ONLY, ownOnly: true },
    users: NONE,
    reports: NONE,
    settings: NONE,
    chat: FULL,
  },
};

/**
 * Get permissions for a role + module.
 * Falls back to NONE if role/module not found.
 */
export function getPermission(role: string | undefined, module: Module): ModulePermission {
  if (!role) return NONE;
  return permissionMatrix[role]?.[module] ?? NONE;
}

/**
 * Get all accessible modules for a role (canView = true)
 */
export function getAccessibleModules(role: string | undefined): Module[] {
  if (!role) return [];
  const matrix = permissionMatrix[role];
  if (!matrix) return [];
  return (Object.entries(matrix) as [Module, ModulePermission][])
    .filter(([, p]) => p.canView)
    .map(([m]) => m);
}

/**
 * Check if a role can access a specific module
 */
export function canAccessModule(role: string | undefined, module: Module): boolean {
  return getPermission(role, module).canView;
}

/**
 * Hook-friendly permission getter
 */
export function usePermission(module: Module) {
  // This is a plain function, not a hook - import useAuthStore where needed
  // Use getPermission(user.role, module) instead
  return { getPermission };
}

/**
 * Get role display label
 */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    sales_manager: 'Sales Manager',
    sales_rep: 'Sales Rep',
    resource: 'Resource',
    freelancer: 'Freelancer',
    client: 'Client',
  };
  return labels[role] || role;
}
