---
name: Payroll Module
description: Full payroll UI with tabs for Overview, per-user Salary Structure, and Payroll Runs (approve/pay/email/edit per-employee bonus & LOP)
type: feature
---

The Payroll module (`/admin/payroll`) is a tabbed interface:

**Tabs:**
- **Overview** — KPIs (employees, annual CTC, pending/paid runs), recent runs, top earners.
- **Salary Structure** — Per-employee salary breakdown editor. Earnings (base, HRA, conveyance, medical, special) and statutory deductions (PF, ESI, professional tax, TDS) stored under `user.salary_structure` via `PUT /users/:id`.
- **Payroll Runs** — List of runs with create / approve / mark-paid / email payslips actions. Run detail shows employee table where admin can edit per-run overrides: bonus, overtime, LOP days/amount, loan recovery, other deductions.

**Status flow:** Draft → Pending → Approved → Paid. Once Approved or Paid, employee rows are read-only.

**Backend endpoints expected** (see `.lovable/backend-spec-payroll.md`):
- `GET/POST /payroll/runs`, `GET /payroll/runs/:id`
- `POST /payroll/runs/:id/approve`, `POST /payroll/runs/:id/pay`
- `POST /payroll/runs/:id/payslips/send`
- `PUT /payroll/runs/:runId/employees/:userId`
- `PUT /users/:id` accepts `salary_structure` object

The frontend computes totals client-side as a fallback when backend doesn't pre-aggregate.
