import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore } from '@/stores/unreadStore';
import {
  LayoutDashboard, Users, Building2, MessageSquare, FolderKanban,
  FileText, Clock, Wallet, BarChart3, Settings, Lock, Ticket,
  ListChecks, BookOpen, Receipt, Scale, RefreshCw, Inbox, KeyRound,
  CalendarClock, Mail,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  module?: string;
  adminOnly?: boolean;
  group: string;
  children?: NavItem[];
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, group: 'Workspace' },
  {
    label: 'CRM', path: '/admin/crm', icon: Users, module: 'crm', group: 'Workspace',
    children: [
      { label: 'Leads',              path: '/admin/crm',          icon: Users,         module: 'crm', group: 'Workspace' },
      { label: 'Upcoming Payments',  path: '/admin/crm/payments', icon: CalendarClock, module: 'crm', group: 'Workspace' },
    ],
  },
  { label: 'Clients', path: '/admin/clients', icon: Building2, module: 'clients', group: 'Workspace' },
  { label: 'Projects', path: '/admin/projects', icon: FolderKanban, module: 'projects', group: 'Workspace' },
  { label: 'Chat', path: '/admin/chat', icon: MessageSquare, module: 'chat', group: 'Workspace' },
  { label: 'Shared Inbox', path: '/admin/inbox', icon: Inbox, module: 'inbox', group: 'Communication' },
  { label: 'Email', path: '/admin/email', icon: Mail, module: 'email', group: 'Communication' },
  {
    label: 'Invoicing', path: '/admin/invoicing', icon: FileText, module: 'invoicing', group: 'Finance',
    children: [
      { label: 'All Invoices',      path: '/admin/invoicing',            icon: FileText,  module: 'invoicing', group: 'Finance' },
      { label: 'Invoice Settings',  path: '/admin/settings?tab=invoice', icon: Settings,  adminOnly: true,     group: 'Finance' },
    ],
  },
  { label: 'Payroll', path: '/admin/payroll', icon: Wallet, module: 'payroll', group: 'Finance' },
  {
    label: 'Balance Sheet', path: '/admin/balance-sheet', icon: Scale, group: 'Finance',
    children: [
      { label: 'Input Sheet',   path: '/admin/input-sheet',   icon: ListChecks, group: 'Finance' },
      { label: 'Expense Sheet', path: '/admin/expense-sheet', icon: Receipt,    group: 'Finance' },
    ],
  },
  { label: 'Subscriptions', path: '/admin/subscriptions', icon: RefreshCw, group: 'Finance' },
  { label: 'Password Manager', path: '/admin/vault', icon: Lock, module: 'vault', group: 'Operations' },
  { label: 'Tracker', path: '/admin/tracker', icon: Clock, module: 'tracker', group: 'Operations' },
  {
    label: 'Team & Users', path: '/admin/users', icon: Users, module: 'users', group: 'Operations',
    children: [
      { label: 'All Users',           path: '/admin/users', icon: Users,    module: 'users', group: 'Operations' },
      { label: 'Roles & Permissions', path: '/admin/roles', icon: KeyRound, adminOnly: true, group: 'Operations' },
    ],
  },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3, module: 'reports', group: 'Operations' },
  { label: 'Settings', path: '/admin/settings', icon: Settings, group: 'Operations' },
];

const teamNav: NavItem[] = [
  { label: 'Dashboard', path: '/team', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Projects', path: '/team/projects', icon: FolderKanban, module: 'projects', group: 'Workspace' },
  {
    label: 'CRM', path: '/team/crm', icon: Users, module: 'crm', group: 'Workspace',
    children: [
      { label: 'Leads',              path: '/team/crm',          icon: Users,         module: 'crm', group: 'Workspace' },
      { label: 'Upcoming Payments',  path: '/team/crm/payments', icon: CalendarClock, module: 'crm', group: 'Workspace' },
    ],
  },
  { label: 'Chat', path: '/team/chat', icon: MessageSquare, module: 'chat', group: 'Workspace' },
  { label: 'Shared Inbox', path: '/team/inbox', icon: Inbox, module: 'inbox', group: 'Communication' },
  { label: 'Email', path: '/team/email', icon: Mail, module: 'email', group: 'Communication' },
  { label: 'Invoicing', path: '/team/invoicing', icon: FileText, module: 'invoicing', group: 'Finance' },
  { label: 'Payroll', path: '/team/payroll', icon: Wallet, module: 'payroll', group: 'Finance' },
  { label: 'Expenses', path: '/team/expenses', icon: Receipt, module: 'expenses', group: 'Finance' },
  { label: 'Password Manager', path: '/team/vault', icon: Lock, module: 'vault', group: 'Operations' },
  { label: 'Tracker', path: '/team/tracker', icon: Clock, module: 'tracker', group: 'Operations' },
  { label: 'Profile', path: '/team/profile', icon: Users, group: 'Operations' },
];

// Sales gets the full backoffice menu — actual visibility is decided by
// per-role permissions (Roles & Permissions page), not by a hardcoded trim.
const salesNav: NavItem[] = [
  { label: 'Dashboard', path: '/sales', icon: LayoutDashboard, group: 'Workspace' },
  {
    label: 'CRM', path: '/sales/crm', icon: Users, module: 'crm', group: 'Workspace',
    children: [
      { label: 'Leads',              path: '/sales/crm',          icon: Users,         module: 'crm', group: 'Workspace' },
      { label: 'Upcoming Payments',  path: '/sales/crm/payments', icon: CalendarClock, module: 'crm', group: 'Workspace' },
    ],
  },
  { label: 'Clients', path: '/sales/clients', icon: Building2, module: 'clients', group: 'Workspace' },
  { label: 'Projects', path: '/sales/projects', icon: FolderKanban, module: 'projects', group: 'Workspace' },
  { label: 'Chat', path: '/sales/chat', icon: MessageSquare, module: 'chat', group: 'Workspace' },
  { label: 'Shared Inbox', path: '/sales/inbox', icon: Inbox, module: 'inbox', group: 'Communication' },
  { label: 'Email', path: '/sales/email', icon: Mail, module: 'email', group: 'Communication' },
  { label: 'Invoicing', path: '/sales/invoicing', icon: FileText, module: 'invoicing', group: 'Finance' },
  { label: 'Payroll', path: '/sales/payroll', icon: Wallet, module: 'payroll', group: 'Finance' },
  { label: 'Password Manager', path: '/sales/vault', icon: Lock, module: 'vault', group: 'Operations' },
  { label: 'Tracker', path: '/sales/tracker', icon: Clock, module: 'tracker', group: 'Operations' },
  { label: 'Reports', path: '/sales/reports', icon: BarChart3, module: 'reports', group: 'Operations' },
];

const portalNav: NavItem[] = [
  { label: 'Dashboard', path: '/client', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Invoices', path: '/client/invoices', icon: FileText, group: 'Workspace' },
  { label: 'Projects', path: '/client/projects', icon: FolderKanban, group: 'Workspace' },
  { label: 'Documents', path: '/client/documents', icon: BookOpen, group: 'Workspace' },
  { label: 'Messages', path: '/client/messages', icon: MessageSquare, group: 'Communication' },
  { label: 'Support', path: '/client/support', icon: Ticket, group: 'Communication' },
];

export const GROUP_ORDER = ['Workspace', 'Communication', 'Finance', 'Operations'];

function getNavItems(role: string): NavItem[] {
  const adminRoles = ['super_admin', 'admin'];
  const salesRoles = ['sales_manager', 'sales_rep', 'presales'];
  const clientRoles = ['client'];
  if (adminRoles.includes(role)) return adminNav;
  if (salesRoles.includes(role)) return salesNav;
  if (clientRoles.includes(role)) return portalNav;
  // All other roles (resource, freelancer, custom roles) → team nav
  return teamNav;
}

export const rootPaths = ['/admin', '/sales', '/team', '/client', '/emp', '/portal', '/client-portal'];

export function pathToModule(path: string): string {
  if (path.includes('/chat'))      return 'chat';
  if (path.includes('/projects'))  return 'projects';
  if (path.includes('/crm'))       return 'crm';
  if (path.includes('/invoicing')) return 'invoicing';
  if (path.includes('/tickets'))   return 'tickets';
  if (path.includes('/payroll'))   return 'payroll';
  return '';
}

export function useNavItems() {
  const { user, permissions, enabledModules } = useAuthStore();
  const location = useLocation();
  const role = user?.role || '';
  const navItems = getNavItems(role);

  const isSuperOrAdmin = ['super_admin', 'admin'].includes(role);
  const isAdmin = isSuperOrAdmin || ['sales_manager', 'sales_rep', 'presales'].includes(role);

  const isModuleAllowed = (mod?: string) => {
    if (!mod) return true;
    // admin / super_admin: show everything, period. They're never gated by the
    // role_permissions matrix in the menu — if you want to hide something
    // from an admin, demote their role.
    if (isSuperOrAdmin) return true;
    // If API permissions are loaded, they are the single source of truth
    if (permissions && Object.keys(permissions).length > 0) {
      const mp = permissions[mod];
      if (isAdmin) { if (mp && mp.can_view === false) return false; }
      else { if (!mp || !mp.can_view) return false; }
      return true;
    }
    // Permissions not yet loaded — fall back to enabledModules from login
    if (!isAdmin && enabledModules && enabledModules.length > 0 && !enabledModules.includes(mod)) return false;
    return true;
  };

  const isItemAllowed = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return false;
    return isModuleAllowed(item.module);
  };

  const visibleItems = navItems
    .filter(isItemAllowed)
    .map((item) => item.children ? { ...item, children: item.children.filter(isItemAllowed) } : item);

  const isItemActive = (path: string) => {
    const cleanPath = path.split('?')[0];
    return location.pathname === cleanPath || (!rootPaths.includes(cleanPath) && location.pathname.startsWith(cleanPath));
  };

  const isGroupActive = (item: NavItem) =>
    isItemActive(item.path) || (item.children?.some((c) => isItemActive(c.path)) ?? false);

  const { counts } = useUnreadStore();

  return { visibleItems, isItemActive, isGroupActive, counts, role };
}
