# Accounting Ecosystem

Unified modular backend and frontends for the Lorenco business suite.

## Architecture

```
accounting-ecosystem/
├── backend/                    # Express API server
│   ├── server.js               # Entry point
│   ├── config/
│   │   ├── database.js         # Supabase connection
│   │   ├── modules.js          # Module activation config
│   │   └── permissions.js      # Unified RBAC
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   ├── audit.js            # Forensic audit logging
│   │   └── module-check.js     # Module gate middleware
│   ├── shared/routes/          # Always-active routes
│   │   ├── auth.js             # Login, register, company selection
│   │   ├── companies.js        # Company CRUD
│   │   ├── users.js            # User management
│   │   ├── employees.js        # Employee management
│   │   └── audit.js            # Audit log queries
│   └── modules/
│       ├── pos/                # Checkout Charlie POS
│       ├── payroll/            # Lorenco Paytime Payroll
│       └── accounting/         # General Accounting (placeholder)
├── frontend-pos/               # POS frontend (single-page app)
├── frontend-payroll/           # Payroll frontend (multi-page app)
├── database/
│   └── schema.sql              # Unified Supabase schema
└── .env.example                # Environment template
```

## Modules

| Module | Name | Status | Route Prefix |
|--------|------|--------|-------------|
| POS | Checkout Charlie | **Active** | `/api/pos/*` |
| Payroll | Lorenco Paytime | Disabled | `/api/payroll/*` |
| Accounting | General Ledger | Disabled | `/api/accounting/*` |

Modules are enabled/disabled via environment variables. Disabled modules return 403 for all routes.

## Quick Start

### 1. Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### 2. Setup

```bash
cd backend
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials and JWT secret
```

### 3. Database

Run `database/schema.sql` in your Supabase SQL Editor to create all tables.

Then initialize default payroll items for your first company:
```sql
SELECT initialize_payroll_defaults(1);
```

### 4. Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:3000` by default.

### 5. Access

| URL | Description |
|-----|-------------|
| `http://localhost:3000/api/health` | Health check |
| `http://localhost:3000/api/modules` | Module status |
| `http://localhost:3000/pos` | POS frontend |
| `http://localhost:3000/payroll` | Payroll frontend |

## API Routes

### Shared (always active)
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register new user
- `POST /api/auth/select-company` — Switch company context
- `GET /api/auth/me` — Current user info
- `GET /api/auth/companies` — User's companies
- `GET /api/companies` — Company CRUD
- `GET /api/users` — User management
- `GET /api/employees` — Employee management
- `GET /api/audit` — Audit log queries

### POS Module (`MODULE_POS_ENABLED=true`)
- `/api/pos/products` — Product CRUD
- `/api/pos/sales` — Sales CRUD + void
- `/api/pos/customers` — Customer CRUD
- `/api/pos/categories` — Category CRUD
- `/api/pos/inventory` — Stock management

### Payroll Module (`MODULE_PAYROLL_ENABLED=true`)
- `/api/payroll/employees` — Payroll-specific employee data
- `/api/payroll/periods` — Pay periods
- `/api/payroll/transactions` — Payslip processing
- `/api/payroll/items` — Master payroll items
- `/api/payroll/attendance` — Attendance & leave

## Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-secret-min-32-chars

MODULE_POS_ENABLED=true
MODULE_PAYROLL_ENABLED=false
MODULE_ACCOUNTING_ENABLED=false

PORT=3000
NODE_ENV=development
```

## Bug Fixes (from original apps)

1. **Default company duplication** — `ensureDefaultCompany()` now checks if companies exist before creating
2. **Missing company_id filtering** — All queries filter by `company_id` from JWT token
3. **No user edit endpoint** — Added `PUT /api/users/:id` for profile/role updates

## Security

- JWT tokens with company context (8h expiry, 24h for super admin)
- bcrypt password hashing (12 salt rounds)
- Helmet security headers
- CORS with allowlisted origins
- Row Level Security (RLS) on all Supabase tables
- Forensic audit logging on all write operations
- Module-level access control (server + company level)
