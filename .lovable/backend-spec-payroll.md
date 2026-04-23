# Payroll Module — Backend API Spec

Status: **Frontend implemented assuming these endpoints exist.**
Adapt/confirm with backend team. Standard JSON shape: `{ data: ... }` or top-level array.

## Salary Structure (per-user)

Stored on the user record. The frontend reads/writes via existing `/users/:id` endpoints.

Expected fields on user object (nullable):
```
salary_structure: {
  base_pay: number,         // monthly base
  hra: number,              // house rent allowance
  conveyance: number,
  medical: number,
  special_allowance: number,
  // statutory deductions (recurring)
  pf: number,               // provident fund
  esi: number,
  professional_tax: number,
  tds: number,              // monthly TDS
  // meta
  ctc: number,              // optional, computed/stored
  effective_from: string,   // ISO date
}
```

### `PUT /users/:id`
Accepts a `salary_structure` object as part of the user update payload.

## Payroll Runs

### `GET /payroll/runs`
Returns array (or `{ runs: [...] }`) of:
```
{
  id, period_label, period_start, period_end,
  status: 'Draft' | 'Pending' | 'Approved' | 'Paid',
  total_gross: number, total_deductions: number, total_net: number,
  employee_count: number, created_at, approved_at, paid_at
}
```

### `GET /payroll/runs/:id`
Returns a run with `employees` array:
```
{
  ...run,
  employees: [{
    id, user_id, full_name, job_title, avatar_url,
    base_pay, hra, conveyance, medical, special_allowance, // earnings
    bonus,                    // one-off bonus for this run
    pf, esi, professional_tax, tds, loan_recovery, other_deductions,
    lop_days, lop_amount,     // loss of pay
    overtime_hours, overtime_amount,
    gross_pay, total_deductions, net_pay,
    payslip_url               // PDF
  }]
}
```

### `POST /payroll/runs`
Create a run. Backend should auto-include all active employees with their current `salary_structure`.
Body:
```
{ period_label: string, period_start: ISO, period_end: ISO }
```

### `PUT /payroll/runs/:runId/employees/:userId`
Edit per-employee values for a run (override bonus/deductions/LOP).
Body: any subset of employee fields above.

### `POST /payroll/runs/:id/approve`
Approve the run. Returns updated run.

### `POST /payroll/runs/:id/pay`
Mark as paid (after disbursement). Returns updated run.

### `POST /payroll/runs/:id/payslips/send`
Email payslips to all employees in the run.

### `GET /payroll/runs/:id/payslips/:userId.pdf`
Download a single payslip.

### `DELETE /payroll/runs/:id`
Delete a draft run.

## Notes
- Frontend computes totals client-side as a fallback if backend doesn't pre-compute.
- LOP and overtime should be auto-pulled from the Tracker module by the backend.
- All amounts are in INR, integers or 2-decimal floats.
