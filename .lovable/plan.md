## Plan: Convert from SaaS to Single-Company App

### Remove
- **SA Portal**: Delete all `/sa` routes, pages (`SADashboard`, `SAOrganizations`, `SAUsers`, `SAPermissions`, `SAProfile`, `SAAuditLog`, `SAPlans`)
- **SA sidebar nav**: Remove `saNav` array and `super_admin` role handling
- **saLocalService**: Delete the mock data service entirely
- **Organization concepts**: Remove org-related fields from auth store

### Keep (unchanged)
- **Admin Portal** (`/admin`) — CRM, Invoicing, Clients, Projects, Tickets, Chat, Vault, Tracker, Payroll, Users, Reports, Settings
- **Employee Portal** (`/emp`) — Dashboard, Tasks, Projects, Chat, Tracker, Payroll, Profile
- **Client Portal** (`/portal`) — Dashboard, Invoices, Projects, Documents, Messages, Support
- **Backend API login** — POST `/auth/login` on Railway
- **Role-based routing** — admin→`/admin`, resource/freelancer→`/emp`, client→`/portal`

### Update
- **Login page**: Default redirect to `/admin` (no more `/sa` option)
- **Auth store**: Remove `super_admin` from role switch, simplify `getRedirectPath`
- **Root redirect**: `/` → `/admin` if authenticated
- **ProtectedRoute**: Remove `super_admin` from allowed roles

This removes all the backend calls that were causing 500 errors (SA endpoints) and simplifies the app to a single-company tool.