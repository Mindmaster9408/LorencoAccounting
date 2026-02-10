# Lorenco Accounting System - Setup Guide

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **npm** >= 9.0.0

## Installation Steps

### 1. Clone or Download the Project

```bash
cd "c:\Users\ruanv\OneDrive\Desktop\Lorenco App\Lorenco Accounting"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Database

#### Create PostgreSQL Database

```sql
CREATE DATABASE lorenco_accounting;
```

#### Update Environment Variables

Copy the example environment file:

```bash
copy .env.example .env
```

Edit `.env` and update the following:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lorenco_accounting
DB_USER=postgres
DB_PASSWORD=your_actual_password

# JWT Configuration
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Admin Emails (Global Access)
ADMIN_EMAILS=ruanvlog@lorenco.co.za,antonjvr@lorenco.co.za

# AI Configuration (Optional)
AI_ENABLED=false
```

⚠️ **Important:** Change `JWT_SECRET` to a strong, random value in production!

### 4. Run Database Migrations

This creates all tables, indexes, triggers, and views:

```bash
npm run migrate
```

You should see:
```
🚀 Starting database migration...
📝 Executing schema...
✅ Migration completed successfully!
```

### 5. Seed Initial Data

This creates:
- Sample company (Acme Corporation)
- Admin user
- Global admin users
- Chart of accounts (30 accounts)
- AI settings (all disabled by default)
- Sample bank account

```bash
npm run seed
```

You should see:
```
🌱 Starting database seeding...
✓ Created company with ID: 1
✓ Created admin user (admin@acme.com / admin123)
✓ Created global admin users
✓ Created 30 accounts
✓ Initialized AI settings (all disabled by default)
✓ Created sample bank account
✅ Seeding completed successfully!

📋 Login credentials:
   Email: admin@acme.com
   Password: admin123

🔐 Global Admin credentials:
   Emails: ruanvlog@lorenco.co.za, antonjvr@lorenco.co.za
   Password: LorencoAdmin2026!
```

### 6. Start the Server

#### Development Mode (with auto-reload):

```bash
npm run dev
```

#### Production Mode:

```bash
npm start
```

You should see:
```
========================================================
  LORENCO ACCOUNTING SYSTEM
========================================================
  Environment: development
  Server running on: http://localhost:3000
  Health check: http://localhost:3000/health
========================================================
  Core Features:
    ✓ Multi-tenant architecture
    ✓ Role-based access control
    ✓ Double-entry bookkeeping
    ✓ Bank reconciliation
    ✓ Financial reports
    ✓ Comprehensive audit trail
========================================================
  AI Add-on (Optional):
    Status: Disabled by default
    Modes: Off / Suggest / Draft / Auto
    Features: Bank allocation, reconciliation, journal prep
========================================================
```

## Testing the Installation

### 1. Health Check

Open a browser or use curl:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T...",
  "version": "1.0.0",
  "service": "Lorenco Accounting API"
}
```

### 2. Login via Web Interface

Open browser to:
```
http://localhost:3000/login.html
```

Use credentials:
- **Email:** admin@acme.com
- **Password:** admin123

### 3. Login via API

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@acme.com",
    "role": "admin",
    ...
  }
}
```

### 4. Test Authenticated Endpoint

Replace `YOUR_TOKEN` with the token from step 3:

```bash
curl http://localhost:3000/api/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "accounts": [...],
  "count": 30
}
```

## Running Tests

```bash
npm test
```

This runs the test suite for:
- Journal validation
- AI guard logic
- Permission checks

## Common Issues & Solutions

### Issue: Database Connection Error

**Error:** `Failed to connect to database`

**Solution:**
1. Check PostgreSQL is running
2. Verify credentials in `.env` file
3. Ensure database exists: `CREATE DATABASE lorenco_accounting;`

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
1. Change `PORT` in `.env` file
2. Or stop the process using port 3000

### Issue: Migration Fails

**Error:** Tables already exist

**Solution:**
Drop and recreate the database:
```sql
DROP DATABASE lorenco_accounting;
CREATE DATABASE lorenco_accounting;
```

Then run migrations again: `npm run migrate`

### Issue: Cannot Login

**Problem:** Invalid credentials

**Solution:**
- Ensure you ran `npm run seed`
- Use exact credentials: `admin@acme.com` / `admin123`
- Check database has users: `SELECT * FROM users;`

## Next Steps

### 1. Explore the Dashboard

Open: `http://localhost:3000/dashboard.html`

Features:
- View account summary
- Recent journals
- Bank transactions
- AI review queue

### 2. Create Your First Journal

```bash
curl -X POST http://localhost:3000/api/journals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-01-14",
    "description": "Test journal entry",
    "sourceType": "manual",
    "lines": [
      {"accountId": 1, "debit": 1000, "credit": 0, "description": "Bank debit"},
      {"accountId": 15, "debit": 0, "credit": 1000, "description": "Income credit"}
    ]
  }'
```

### 3. Post the Journal

```bash
curl -X POST http://localhost:3000/api/journals/1/post \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Generate Trial Balance

```bash
curl "http://localhost:3000/api/reports/trial-balance?fromDate=2026-01-01&toDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Enable AI (Optional)

```bash
curl -X PUT http://localhost:3000/api/ai/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyEnabled": true,
    "capabilities": [
      {
        "capabilityKey": "BANK_ALLOCATION",
        "mode": "draft",
        "minConfidence": 0.80,
        "isEnabled": true
      }
    ]
  }'
```

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update `DB_PASSWORD` to a secure password
- [ ] Set up HTTPS/SSL certificate
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Configure logging (see Winston configuration)
- [ ] Set up monitoring (e.g., PM2, New Relic)
- [ ] Review and restrict CORS origins
- [ ] Enable rate limiting (configured by default)
- [ ] Set up CI/CD pipeline

## Architecture Overview

```
Lorenco Accounting
│
├── src/
│   ├── server.js              # Main Express server
│   ├── config/
│   │   └── database.js        # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js            # JWT authentication & RBAC
│   ├── services/
│   │   ├── journalService.js  # Double-entry logic
│   │   ├── aiGuard.js         # AI mode enforcement
│   │   └── auditLogger.js     # Audit trail service
│   └── routes/
│       ├── auth.js            # Login/register
│       ├── accounts.js        # Chart of accounts
│       ├── journals.js        # Journals CRUD + posting
│       ├── bank.js            # Bank transactions & recon
│       ├── reports.js         # TB, GL, Bank recon
│       ├── ai.js              # AI add-on module
│       └── audit.js           # Audit log queries
│
├── public/                    # Frontend HTML files
├── docs/                      # Documentation & SQL schema
├── tests/                     # Jest test files
└── database/                  # Migration & seed scripts
```

## Support

For technical support or questions:
- **Email:** ruanvlog@lorenco.co.za, antonjvr@lorenco.co.za
- **Documentation:** `/docs/API.md`
- **Issues:** Check logs in console or `logs/lorenco.log`

## License

PROPRIETARY - All rights reserved.
