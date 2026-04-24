---
name: Payroll Module
description: Role-scoped payroll. Admin/super_admin see full UI (Overview, Salary Structure, Runs). All other roles with payroll access see only their own payslips list.
type: feature
---

The Payroll module (`/admin/payroll`, `/emp/payroll`) is **role-scoped**:

**Admin / Super Admin** — full tabbed interface:
- **Overview** — KPIs (employees, annual CTC, pending/paid runs), recent runs, top earners.
- **Salary Structure** — Per-employee salary breakdown editor. Earnings (base, HRA, conveyance, medical, special) and statutory deductions (PF, ESI, professional tax, TDS) stored under `user.salary_structure` via `PUT /users/:id`.
- **Payroll Runs** — List of runs with create / approve / mark-paid / email payslips actions. Run detail shows employee table where admin can edit per-run overrides: bonus, overtime, LOP days/amount, loan recovery, other deductions.

**All other roles** (resource, freelancer, sales_*, etc. with payroll permission) — `MyPayslips` view only:
- Lists Approved/Paid runs where the user appears as an employee.
- Click "View Payslip" opens the standard `PayslipView` modal (printable professional layout).
- No salary structure editing, no other employees' data, no run controls.
- Implementation: in `Payroll.tsx` the component checks `currentUser.role` and short-circuits to `<MyPayslips />` for non-admins. Falls back to fetching each run's detail (`GET /payroll/runs/:id`) when the list response doesn't inline employees.

**Status flow:** Draft → Pending → Approved → Paid. Once Approved or Paid, employee rows are read-only. Only Approved/Paid runs are visible in `MyPayslips`.

**Backend endpoints expected** (see `.lovable/backend-spec-payroll.md`):
- `GET/POST /payroll/runs`, `GET /payroll/runs/:id`
- `POST /payroll/runs/:id/approve`, `POST /payroll/runs/:id/pay`
- `POST /payroll/runs/:id/payslips/send`
- `PUT /payroll/runs/:runId/employees/:userId`
- `PUT /users/:id` accepts `salary_structure` object

The frontend computes totals client-side as a fallback when backend doesn't pre-aggregate.
