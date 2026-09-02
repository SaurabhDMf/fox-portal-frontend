import type { ElementType } from 'react';
import {
  LayoutDashboard, Users, Building2, MessageSquare, FolderKanban,
  FileText, Clock, Wallet, BarChart3, Settings, Lock, Ticket,
  ListChecks, BookOpen, Receipt, Scale, RefreshCw, Inbox, KeyRound,
  Mail, Bell,
} from 'lucide-react';
import { sectionLabels } from '@/components/layouts/AppHeader';

// Icon per URL second-segment — mirrors sectionLabels' keys so every tab
// gets a sensible icon without a separate maintained list.
const iconRegistry: Record<string, ElementType> = {
  crm: Users,
  invoicing: FileText,
  invoices: FileText,
  clients: Building2,
  chat: MessageSquare,
  projects: FolderKanban,
  vault: Lock,
  inbox: Inbox,
  email: Mail,
  tickets: Ticket,
  tracker: Clock,
  payroll: Wallet,
  expenses: Receipt,
  users: Users,
  reports: BarChart3,
  settings: Settings,
  permissions: Lock,
  roles: KeyRound,
  subscriptions: RefreshCw,
  notifications: Bell,
  tasks: ListChecks,
  profile: Users,
  documents: BookOpen,
  messages: MessageSquare,
  support: Ticket,
  'balance-sheet': Scale,
  'input-sheet': ListChecks,
  'expense-sheet': Receipt,
};

export function tabIcon(iconKey?: string): ElementType {
  if (!iconKey || iconKey === 'dashboard') return LayoutDashboard;
  return iconRegistry[iconKey] || LayoutDashboard;
}

// Derives a tab's { label, iconKey } from a pathname alone — used so tabs
// opened by navigation this feature didn't explicitly wire (or created on
// initial load / refresh) still get a correct label and icon.
export function deriveTabMeta(pathname: string): { label: string; iconKey: string } {
  const parts = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
  if (parts.length <= 1) return { label: 'Dashboard', iconKey: 'dashboard' };
  const seg = parts[1];
  const label = sectionLabels[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  return { label, iconKey: seg };
}
