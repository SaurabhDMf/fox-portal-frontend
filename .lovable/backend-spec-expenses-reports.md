# Backend API Spec — Expenses & Reports Modules

Use this as the prompt/spec for the backend implementation. The frontend at `/admin/expenses` and `/admin/reports` is already built against these endpoints.

---

## 1. Expenses Module

### Database — `expenses` table (MySQL)

```sql
CREATE TABLE expenses (
  id              CHAR(36) PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
  expense_date    DATE NOT NULL,
  vendor          VARCHAR(255) NULL,
  payment_method  VARCHAR(50)  NULL,    -- Cash / Bank Transfer / UPI / Credit Card / Debit Card / Cheque / Other
  reference_no    VARCHAR(100) NULL,
  notes           TEXT NULL,
  attachment_url  TEXT NULL,
  created_by      CHAR(36) NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expense_date (expense_date),
  INDEX idx_category (category)
);
```

Allowed categories (validate, but allow free text fallback):
`Office Rent, Utilities, Software & Subscriptions, Marketing & Ads, Travel, Meals & Entertainment, Equipment & Hardware, Office Supplies, Professional Services, Internet & Phone, Taxes & Fees, Bank Charges, Contractor Payments, Miscellaneous`

### REST endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET    | `/api/v1/expenses` | query: `from`, `to`, `category`, `q` | `{ expenses: Expense[] }` |
| GET    | `/api/v1/expenses/:id` | — | `{ expense: Expense }` |
| POST   | `/api/v1/expenses` | Expense (no id) | `{ expense: Expense }` |
| PUT    | `/api/v1/expenses/:id` | Partial Expense | `{ expense: Expense }` |
| DELETE | `/api/v1/expenses/:id` | — | `{ success: true }` |

Permissions: gate behind a new module key `expenses` (add to roles/permissions matrix). Only admin/super_admin/finance roles by default.

### Expense JSON shape

```json
{
  "id": "uuid",
  "title": "AWS monthly bill",
  "category": "Software & Subscriptions",
  "amount": 12500.00,
  "expense_date": "2026-04-15",
  "vendor": "Amazon Web Services",
  "payment_method": "Bank Transfer",
  "reference_no": "INV-1234",
  "notes": "Production cluster",
  "attachment_url": "https://...",
  "created_by": "uuid",
  "created_at": "2026-04-15T10:00:00Z",
  "updated_at": "2026-04-15T10:00:00Z"
}
```

Validation: `title`, `category`, `amount > 0`, `expense_date` required. Optional fields accept `null`.

---

## 2. Reports Module — required data sources

The Reports page (`/admin/reports`) consumes these existing endpoints. Make sure each returns the listed fields:

### Leads (`GET /api/v1/leads`)
Required fields per lead: `id`, `status`, `created_at`, `assigned_to` (or `assigned_user_id`), `converted` (boolean OR derive from `status === 'Closed Won'`).
Used for: leads-per-pre-sales-user chart, conversion rate, monthly trend.

### Users (`GET /api/v1/users`)
Required fields: `id`, `full_name`, `role`. Pre-sales roles considered: `sales_rep`, `sales_manager`, `pre_sales`.

### Invoices (`GET /api/v1/invoices`)
Required: `id`, `total` (or `amount`), `status` (`paid`/`pending`/etc), `paid_at` or `created_at`, `due_date`.
Used for: Payment In monthly aggregation.

### Expenses (`GET /api/v1/expenses`)
See above — used for Payment Out + Expense breakdown.

### Payroll runs (`GET /api/v1/payroll/runs`)
Required: `id`, `period_end` (or `created_at`), `total_net` (or `total_amount`), `status`.
Used for: Payment Out (payroll component).

---

## 3. Optional aggregation endpoints (recommended for performance)

If the lists grow large, add server-side aggregation endpoints — frontend can be migrated later:

```
GET /api/v1/reports/sales-summary?year=2026
  -> { total_leads, total_converted, conversion_rate, leads_by_user: [{user_id, name, received, converted}], leads_by_month: [{month: 1..12, received, converted}] }

GET /api/v1/reports/finance-summary?year=2026
  -> { payment_in_by_month: [{month, paid, pending}], expenses_by_month: [{month, value}], payroll_by_month: [{month, value}] }

GET /api/v1/reports/expense-summary?year=2026
  -> { by_category: [{category, value}], monthly_by_category: [{month, [category]: value}] }
```

For now, the frontend computes these client-side from the list endpoints — both approaches work.

---

## 4. Permissions matrix entry

Add `expenses` as a new module to the roles/permissions system, with the standard flags: `can_view`, `can_create`, `can_edit`, `can_delete`, `can_export`, `own_only`.

Default access: `super_admin`, `admin` → full; `sales_manager` → view only; others → no access.

---

## 5. Notes

- All money fields stored as DECIMAL, returned as numeric (frontend formats as INR).
- Use `null` for empty optional fields, not empty string.
- `is_active` / soft-delete is NOT required for v1 — hard delete is fine.
- Expose new module flag `expenses` in `enabled_modules` returned by `/auth/login` and `/auth/refresh`.
