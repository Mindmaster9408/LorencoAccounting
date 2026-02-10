# TEST CREDENTIALS — Mock Mode

## Quick Start

```bash
cd backend
npm run dev
```

Then open:
- **POS Frontend:** http://localhost:3000/pos
- **Payroll Frontend:** http://localhost:3000/payroll
- **Health Check:** http://localhost:3000/api/health

---

## Test Accounts

| Account | Email | Password | Role | Modules |
|---------|-------|----------|------|---------|
| **POS User** | `pos@test.com` | `pos123` | `store_manager` | POS |
| **Payroll User** | `payroll@test.com` | `payroll123` | `payroll_admin` | Payroll |
| **Super Admin** | `admin@test.com` | `admin123` | `super_admin` | ALL |

### POS User (`pos@test.com`)
- **Role:** Store Manager — can manage products, sales, customers, inventory
- **Company:** The Infinite Legacy (Pty) Ltd + Test Branch Trading
- **Permissions:** Full POS CRUD, void sales, adjust inventory, view reports

### Payroll User (`payroll@test.com`)
- **Role:** Payroll Admin — can manage pay runs, payslips, attendance
- **Company:** The Infinite Legacy (Pty) Ltd
- **Permissions:** Full payroll CRUD, create/view periods, manage attendance

### Super Admin (`admin@test.com`)
- **Role:** Super Admin / Business Owner — full access to everything
- **Company:** Both companies
- **Permissions:** All modules, can approve payroll, manage users, view audit log

---

## Mock Data Overview

### Companies (2)
| ID | Name | Modules |
|----|------|---------|
| 1 | The Infinite Legacy (Pty) Ltd | POS + Payroll |
| 2 | Test Branch Trading | POS only |

### Products (20)
6 categories: Beverages, Snacks, Groceries, Dairy, Tobacco, Toiletries.
SA-relevant products with realistic prices (VAT-inclusive for non-basic, zero-rated for basic goods).

### Customers (5)
- Walk-in Customer (default)
- 3 retail customers (with loyalty points)
- 1 wholesale account (Green Valley School — 30-day terms)

### Employees (12)
- 3 linked to test user accounts
- 9 additional employees across Retail, Finance, Warehouse, Logistics, Operations
- Various salary levels (R7,000 – R65,000/month)
- 1 part-time (hourly rate R55/hour)
- 1 terminated (Thandiwe Zulu — is_active: false)

### Sales (3)
- 2 completed sales with items & payments
- 1 voided sale (demonstrates void workflow)

### Payroll Periods (3)
- June 2024 — **paid** (with completed payslips)
- July 2024 — **approved** (ready to pay)
- August 2024 — **draft** (awaiting processing)

### Payroll Transactions (4)
- 3 completed payslips for June (EMP-001, EMP-004, EMP-005)
- 1 draft payslip for August (EMP-001)
- Includes PAYE, UIF, pension deduction items

### Attendance Records (12)
- 2 days of attendance (Aug 1-2)
- Mixed statuses: present, late, absent, leave, half_day

### Payroll Items Master (12)
- 6 earnings: Basic, Normal OT, Sunday OT, Commission, Travel, Bonus
- 6 deductions: PAYE, UIF Employee, UIF Employer, Pension, Medical Aid, Staff Loan

---

## Testing Checklist

### POS (Checkout Charlie) — Login as `pos@test.com`

- [ ] Login at http://localhost:3000/pos
- [ ] Products load in grid/list view
- [ ] Search products by name/barcode
- [ ] Filter products by category
- [ ] Create a new product
- [ ] Edit an existing product
- [ ] Delete (soft) a product
- [ ] View customer list
- [ ] Create a new customer
- [ ] Create a new sale with items
- [ ] Apply discount to sale
- [ ] View sales history
- [ ] Void a sale (requires reason)
- [ ] View inventory stock levels
- [ ] See low-stock alerts
- [ ] Adjust stock manually
- [ ] View stock adjustment history
- [ ] Create a new category
- [ ] Edit/delete category

### Payroll (Lorenco Paytime) — Login as `payroll@test.com`

- [ ] Login at http://localhost:3000/payroll
- [ ] View employee list
- [ ] View individual employee details
- [ ] Update employee salary
- [ ] Update bank details
- [ ] View payroll periods
- [ ] Create a new pay period
- [ ] View payslips for a period
- [ ] Create a new payslip/transaction
- [ ] Edit payslip amounts
- [ ] Delete draft payslip
- [ ] View payroll items master list
- [ ] Create new earning/deduction type
- [ ] Record attendance entries
- [ ] View attendance summary
- [ ] Change period status (draft → processing → approved)

### Admin Functions — Login as `admin@test.com`

- [ ] Login — should see company selector (2 companies)
- [ ] View all companies
- [ ] View all users
- [ ] View audit log
- [ ] Filter audit log by module/action
- [ ] Access both POS and Payroll modules
- [ ] Approve payroll periods

---

## Switching to Real Database

When you have Supabase credentials:

1. Edit `backend/.env`:
   ```
   MOCK_MODE=false
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-real-service-key
   ```

2. Run `database/schema.sql` in your Supabase SQL editor

3. Restart the server — it will now use Supabase instead of in-memory data

---

## API Quick Reference

All API calls require `Authorization: Bearer <token>` header (except login/register).

```
POST   /api/auth/login           { username, password }
POST   /api/auth/register        { username, email, password, full_name }
POST   /api/auth/select-company  { companyId }
GET    /api/auth/me
GET    /api/auth/companies
POST   /api/auth/logout

GET    /api/pos/products
POST   /api/pos/products
PUT    /api/pos/products/:id
DELETE /api/pos/products/:id

GET    /api/pos/categories
POST   /api/pos/categories
PUT    /api/pos/categories/:id

GET    /api/pos/customers
POST   /api/pos/customers
PUT    /api/pos/customers/:id

GET    /api/pos/sales
POST   /api/pos/sales
GET    /api/pos/sales/:id
POST   /api/pos/sales/:id/void

GET    /api/pos/inventory
POST   /api/pos/inventory/adjust
GET    /api/pos/inventory/adjustments

GET    /api/payroll/employees
PUT    /api/payroll/employees/:id/salary
PUT    /api/payroll/employees/:id/bank-details

GET    /api/payroll/periods
POST   /api/payroll/periods
PUT    /api/payroll/periods/:id/status

GET    /api/payroll/transactions
POST   /api/payroll/transactions
PUT    /api/payroll/transactions/:id
DELETE /api/payroll/transactions/:id

GET    /api/payroll/items
POST   /api/payroll/items
PUT    /api/payroll/items/:id

GET    /api/payroll/attendance
POST   /api/payroll/attendance
GET    /api/payroll/attendance/summary

GET    /api/employees
POST   /api/employees
PUT    /api/employees/:id

GET    /api/companies
GET    /api/audit

GET    /api/health
GET    /api/modules
```
