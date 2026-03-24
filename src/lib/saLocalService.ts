type PlanType = 'trial' | 'starter' | 'pro' | 'enterprise';
type OrgStatus = 'active' | 'trial' | 'suspended';

export interface SAOrganization {
  id: string;
  name: string;
  admin_email: string;
  admin_name: string;
  plan: PlanType;
  industry: string;
  seats: string;
  license_key: string;
  status: OrgStatus;
  created_at: string;
  updated_at?: string;
  last_password_reset_at?: string;
}

interface AuditLog {
  id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  organization_name: string;
  details: string;
  created_at: string;
}

interface CreateOrganizationInput {
  name: string;
  admin_email: string;
  admin_name: string;
  password?: string;
  plan: PlanType;
  industry: string;
  seats: string;
  license_key: string;
}

interface UpdateOrganizationInput {
  admin_email?: string;
  seats?: string;
  password?: string;
}

const ORGS_STORAGE_KEY = 'fox-portal-sa-organizations';
const AUDIT_STORAGE_KEY = 'fox-portal-sa-audit-log';

const PLAN_PRICE: Record<PlanType, number> = {
  trial: 0,
  starter: 29,
  pro: 79,
  enterprise: 199,
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const seedOrganizations: SAOrganization[] = [
  {
    id: createId(),
    name: 'Acme Logistics',
    admin_email: 'admin@acmelogistics.com',
    admin_name: 'Anita Roy',
    plan: 'pro',
    industry: 'Logistics',
    seats: '50',
    license_key: 'FOX-ACM1-PR07-9JK2-TR55',
    status: 'active',
    created_at: daysAgo(12),
  },
  {
    id: createId(),
    name: 'Nova Retail Group',
    admin_email: 'owner@novaretail.com',
    admin_name: 'Michael Chen',
    plan: 'starter',
    industry: 'Retail',
    seats: '10',
    license_key: 'FOX-NVR2-ST01-7MN8-QW31',
    status: 'active',
    created_at: daysAgo(7),
  },
  {
    id: createId(),
    name: 'Zenith Health Labs',
    admin_email: 'ops@zenithhealth.com',
    admin_name: 'Sara Malik',
    plan: 'trial',
    industry: 'Healthcare',
    seats: '25',
    license_key: 'FOX-ZHL3-TR14-6LP9-ER02',
    status: 'trial',
    created_at: daysAgo(2),
  },
];

const seedAuditLog: AuditLog[] = [
  {
    id: createId(),
    action: 'organization_created',
    actor_name: 'System',
    actor_email: 'system@foxportal.app',
    organization_name: 'Zenith Health Labs',
    details: 'Trial organization was created.',
    created_at: daysAgo(2),
  },
  {
    id: createId(),
    action: 'license_issued',
    actor_name: 'System',
    actor_email: 'system@foxportal.app',
    organization_name: 'Nova Retail Group',
    details: 'Starter plan license key generated.',
    created_at: daysAgo(7),
  },
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function ensureSeedData() {
  const existingOrgs = readStorage<SAOrganization[]>(ORGS_STORAGE_KEY, []);
  if (existingOrgs.length === 0) {
    writeStorage(ORGS_STORAGE_KEY, seedOrganizations);
  }
  const existingAudit = readStorage<AuditLog[]>(AUDIT_STORAGE_KEY, []);
  if (existingAudit.length === 0) {
    writeStorage(AUDIT_STORAGE_KEY, seedAuditLog);
  }
}

function getOrganizationsFromStorage() {
  ensureSeedData();
  return readStorage<SAOrganization[]>(ORGS_STORAGE_KEY, []);
}

function saveOrganizationsToStorage(orgs: SAOrganization[]) {
  writeStorage(ORGS_STORAGE_KEY, orgs);
}

function getAuditLogFromStorage() {
  ensureSeedData();
  return readStorage<AuditLog[]>(AUDIT_STORAGE_KEY, []);
}

function pushAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>) {
  const logs = getAuditLogFromStorage();
  const nextEntry: AuditLog = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...entry,
  };
  writeStorage(AUDIT_STORAGE_KEY, [nextEntry, ...logs]);
}

function seatsToNumber(seats: string) {
  if (seats.toLowerCase() === 'unlimited') return 999;
  const parsed = Number(seats);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const saLocalService = {
  async getOrganizations(search = '') {
    const orgs = getOrganizationsFromStorage();
    const term = search.trim().toLowerCase();

    const filtered = !term
      ? orgs
      : orgs.filter((org) =>
          [org.name, org.admin_email, org.admin_name, org.industry, org.license_key]
            .join(' ')
            .toLowerCase()
            .includes(term)
        );

    return [...filtered].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  },

  async createOrganization(input: CreateOrganizationInput) {
    const orgs = getOrganizationsFromStorage();
    const next: SAOrganization = {
      id: createId(),
      name: input.name,
      admin_email: input.admin_email,
      admin_name: input.admin_name,
      plan: input.plan,
      industry: input.industry,
      seats: input.seats,
      license_key: input.license_key,
      status: input.plan === 'trial' ? 'trial' : 'active',
      created_at: new Date().toISOString(),
    };

    saveOrganizationsToStorage([next, ...orgs]);
    pushAuditLog({
      action: 'organization_created',
      actor_name: 'Super Admin',
      actor_email: 'superadmin@foxportal.app',
      organization_name: next.name,
      details: `Created ${next.plan} organization with ${next.seats} seats.`,
    });

    return next;
  },

  async updateOrganization(id: string, updates: UpdateOrganizationInput) {
    const orgs = getOrganizationsFromStorage();
    const existing = orgs.find((org) => org.id === id);
    if (!existing) throw new Error('Organization not found');

    const updated = orgs.map((org) =>
      org.id === id
        ? {
            ...org,
            admin_email: updates.admin_email ?? org.admin_email,
            seats: updates.seats ?? org.seats,
            updated_at: new Date().toISOString(),
            last_password_reset_at: updates.password ? new Date().toISOString() : org.last_password_reset_at,
          }
        : org
    );

    saveOrganizationsToStorage(updated);

    const changed: string[] = [];
    if (typeof updates.admin_email === 'string' && updates.admin_email !== existing.admin_email) changed.push('access email');
    if (typeof updates.seats === 'string' && updates.seats !== existing.seats) changed.push('seat count');
    if (updates.password) changed.push('admin password');

    pushAuditLog({
      action: 'organization_updated',
      actor_name: 'Super Admin',
      actor_email: 'superadmin@foxportal.app',
      organization_name: existing.name,
      details: changed.length > 0 ? `Updated ${changed.join(', ')}.` : 'Organization details updated.',
    });

    return updated.find((org) => org.id === id)!;
  },

  async organizationAction(id: string, action: 'suspend' | 'activate') {
    const orgs = getOrganizationsFromStorage();
    const existing = orgs.find((org) => org.id === id);
    if (!existing) throw new Error('Organization not found');

    const status: OrgStatus = action === 'activate' ? 'active' : 'suspended';
    const updated = orgs.map((org) => (org.id === id ? { ...org, status, updated_at: new Date().toISOString() } : org));
    saveOrganizationsToStorage(updated);

    pushAuditLog({
      action: action === 'activate' ? 'organization_activated' : 'organization_suspended',
      actor_name: 'Super Admin',
      actor_email: 'superadmin@foxportal.app',
      organization_name: existing.name,
      details: action === 'activate' ? 'Organization reactivated.' : 'Organization access suspended.',
    });

    return { success: true };
  },

  async getStats() {
    const orgs = getOrganizationsFromStorage();

    const plan_breakdown = orgs.reduce<Record<string, number>>((acc, org) => {
      acc[org.plan] = (acc[org.plan] ?? 0) + 1;
      return acc;
    }, {});

    const activeOrgs = orgs.filter((org) => org.status === 'active');
    const mrr = activeOrgs.reduce((sum, org) => sum + PLAN_PRICE[org.plan], 0);

    return {
      total_organizations: orgs.length,
      mrr,
      active_count: orgs.filter((org) => org.status === 'active').length,
      trial_count: orgs.filter((org) => org.status === 'trial').length,
      suspended_count: orgs.filter((org) => org.status === 'suspended').length,
      plan_breakdown,
      recent_organizations: [...orgs]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 5),
    };
  },

  async getUsers(search = '') {
    const users = getOrganizationsFromStorage().map((org) => ({
      id: `${org.id}-admin`,
      full_name: org.admin_name || 'Company Admin',
      email: org.admin_email,
      organization_name: org.name,
      role: 'admin',
      status: org.status === 'suspended' ? 'inactive' : 'active',
      seats: seatsToNumber(org.seats),
    }));

    const term = search.trim().toLowerCase();
    return !term
      ? users
      : users.filter((user) =>
          [user.full_name, user.email, user.organization_name, user.role].join(' ').toLowerCase().includes(term)
        );
  },

  async getPlans() {
    const orgs = getOrganizationsFromStorage();
    const counts = orgs.reduce<Record<string, number>>((acc, org) => {
      acc[org.plan] = (acc[org.plan] ?? 0) + 1;
      return acc;
    }, {});

    return (['trial', 'starter', 'pro', 'enterprise'] as PlanType[]).map((plan) => ({
      name: plan,
      org_count: counts[plan] ?? 0,
    }));
  },

  async getAuditLog() {
    return getAuditLogFromStorage().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  },
};
