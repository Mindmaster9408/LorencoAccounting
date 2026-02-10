# Coaching App - Complete Setup Guide

This guide will walk you through setting up the complete coaching application with backend API, database, and frontend.

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [First Time Login](#first-time-login)
5. [Admin Panel Usage](#admin-panel-usage)
6. [AI Integration](#ai-integration)
7. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Required Software

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14.x or higher ([Download](https://www.postgresql.org/download/))
- **Git** (optional, for version control)
- **VS Code** or any code editor (recommended)

### Optional
- **pgAdmin** 4 (GUI for PostgreSQL management)
- **Postman** (for API testing)

---

## Backend Setup

### Step 1: Install PostgreSQL

1. Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/)
2. During installation, remember your postgres user password
3. Default port: **5432**

### Step 2: Create Database

Open PostgreSQL command line (psql) or pgAdmin and run:

```sql
CREATE DATABASE coaching_app;
```

Or via command line:

```bash
# Windows
psql -U postgres
CREATE DATABASE coaching_app;
\q

# Mac/Linux
sudo -u postgres psql
CREATE DATABASE coaching_app;
\q
```

### Step 3: Configure Backend

1. Navigate to backend folder:

```bash
cd "C:\Users\info\OneDrive\Desktop\Ruan\Coaching app\backend"
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file from example:

```bash
copy .env.example .env
```

4. Edit `.env` file with your settings:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coaching_app
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret (IMPORTANT: Change this!)
JWT_SECRET=change_this_to_a_random_long_string_in_production

# AI API Keys (Get these from providers)
ANTHROPIC_API_KEY=sk-ant-your-key-here
GROK_API_KEY=your-grok-key-here

# CORS
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

### Step 4: Initialize Database

Run the database setup script:

```bash
npm run db:setup
```

This will:
- ✓ Create all tables
- ✓ Create default admin user
- ✓ Create program modules
- ✓ Setup indexes and triggers

**Default Admin Credentials:**
- Email: `admin@coachingapp.com`
- Password: `Admin@2025!`

### Step 5: Start Backend Server

```bash
npm run dev
```

You should see:

```
=================================
  Coaching App Backend Server
=================================
✓ Database connected successfully
Environment: development
Server running on port: 3001
=================================
```

Test the server:

```bash
# Open browser and visit:
http://localhost:3001/health
```

You should see: `{"status":"ok","timestamp":"...","environment":"development"}`

---

## Frontend Setup

### Step 1: Open with Live Server

1. Install **Live Server** extension in VS Code:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Live Server"
   - Install by Ritwick Dey

2. Open the project folder in VS Code:

```bash
cd "C:\Users\info\OneDrive\Desktop\Ruan\Coaching app"
code .
```

3. Right-click on `login.html` and select **"Open with Live Server"**

The app will open at: `http://localhost:5500` or `http://127.0.0.1:5500`

### Step 2: Verify API Connection

The frontend is pre-configured to connect to `http://localhost:3001/api`

If you changed the backend port, update `js/api.js`:

```javascript
export const API_BASE_URL = 'http://localhost:YOUR_PORT/api';
```

---

## First Time Login

### 1. Open Login Page

Navigate to: `http://localhost:5500/login.html`

### 2. Login as Admin

Use the default credentials:
- **Email:** `admin@coachingapp.com`
- **Password:** `Admin@2025!`

### 3. Create Coach Account

After logging in as admin, you'll be redirected to the admin panel.

To create a coach account, you can either:

**Option A: Using the API (Postman/curl)**

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "coach"
  }'
```

**Option B: Directly in Database**

```sql
-- Hash password first using bcrypt
-- Then insert into users table
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES ('coach@example.com', '$2a$10$...', 'John', 'Doe', 'coach');
```

### 4. Login as Coach

1. Logout from admin account
2. Login with coach credentials
3. You'll see the main dashboard with clients

---

## Admin Panel Usage

### Accessing Admin Features

Login as admin → Access admin panel at `admin.html`

### Managing Coaches

1. **View All Users**
   - See list of all coaches and admins
   - View last login times
   - Check activation status

2. **Activate/Deactivate Users**
   - Click toggle to enable/disable coach accounts
   - Disabled coaches cannot login

3. **Module Access Control**

Available modules:
- ✅ **Dashboard** (default)
- ✅ **Client Management** (default)
- ✅ **Journey Steps** (default)
- ✅ **Cockpit Gauges** (default)
- ⚙️ **AI Assistant Coach** (optional)
- ⚙️ **Advanced Analytics** (optional)
- ⚙️ **Group Coaching** (optional)
- ⚙️ **Assessments** (optional)
- ⚙️ **MLNP** (optional)
- ⚙️ **Reports** (optional)

**To enable/disable modules:**

1. Select a coach
2. View their module access
3. Toggle modules on/off
4. Changes apply immediately

### System Statistics

Admin panel shows:
- Total active coaches
- Total clients by status
- Session count
- AI usage statistics

---

## AI Integration

### Getting API Keys

#### Claude (Anthropic)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up / Login
3. Go to API Keys section
4. Create new key
5. Copy key (starts with `sk-ant-`)
6. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-xxx`

#### Grok (xAI)

1. Go to [x.ai](https://x.ai/) developer portal
2. Sign up for API access
3. Create API key
4. Add to `.env`: `GROK_API_KEY=your-key-here`

### AI Features

Once AI module is enabled for a coach:

**1. Client Insights**
- Automatic analysis of client progress
- Pattern recognition
- Coaching recommendations

**2. Chat Assistant**
- Discuss clients with AI
- Get session preparation ideas
- Review coaching strategies

**3. Learning System**
- AI learns each coach's style
- Builds individual client profiles
- Improves over time

### Testing AI

```bash
# Chat with AI about a client
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 1,
    "message": "What should I focus on in my next session?"
  }'
```

---

## Troubleshooting

### Database Connection Error

**Error:** `Failed to connect to database`

**Solution:**
1. Verify PostgreSQL is running:
   ```bash
   # Windows
   sc query postgresql-x64-14

   # Mac
   brew services list

   # Linux
   sudo systemctl status postgresql
   ```

2. Check `.env` credentials match your PostgreSQL setup
3. Verify database exists: `psql -U postgres -l`

### Port Already in Use

**Error:** `Port 3001 is already in use`

**Solution:**
1. Kill process on port 3001:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F

   # Mac/Linux
   lsof -ti:3001 | xargs kill
   ```

2. Or change port in `.env`: `PORT=3002`

### CORS Error

**Error:** `CORS policy violation`

**Solution:**
1. Add your frontend URL to `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
   ```

2. Restart backend server

### Login Not Working

**Checklist:**
- ✓ Backend server is running
- ✓ Database is connected
- ✓ Using correct credentials
- ✓ Frontend is accessing correct API URL
- ✓ Check browser console for errors

### AI Not Responding

**Checklist:**
- ✓ API keys are valid in `.env`
- ✓ AI module enabled for coach
- ✓ Coach is authenticated
- ✓ Check backend logs for API errors

---

## File Structure

```
Coaching app/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── clients.routes.js
│   │   ├── admin.routes.js
│   │   └── ai.routes.js
│   ├── services/
│   │   └── ai.service.js
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   ├── scripts/
│   │   └── setup-database.js
│   ├── .env (create this)
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── README.md
├── js/
│   ├── api.js (NEW - API client)
│   ├── login.js (NEW)
│   ├── app.js
│   ├── config.js
│   ├── storage.js (UPDATED)
│   ├── dashboard.js (UPDATED)
│   ├── clients.js
│   └── gauges.js
├── images/
├── login.html (NEW)
├── index.html
└── styles.css (UPDATED)
```

---

## Next Steps

1. ✅ **Test Login** - Verify you can login as admin and coach
2. ✅ **Create Test Client** - Add a sample client as coach
3. ✅ **Enable AI Module** - Admin enables AI for a coach
4. ✅ **Test AI Features** - Chat with AI about a client
5. ✅ **Explore Gauges** - Update client cockpit gauges
6. ✅ **Review Sessions** - Add coaching session notes

---

## Security Recommendations

### For Production:

1. **Change Default Passwords**
   - Update admin password immediately
   - Use strong, unique passwords

2. **Secure JWT Secret**
   - Generate random secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Update `.env`: `JWT_SECRET=<generated-secret>`

3. **Enable HTTPS**
   - Use SSL certificates
   - Force HTTPS in production

4. **Database Security**
   - Use separate DB user (not postgres)
   - Limit permissions
   - Enable SSL connections

5. **Environment Variables**
   - Never commit `.env` to git
   - Use environment-specific configs
   - Rotate API keys regularly

---

## Support

For issues or questions:
1. Check this guide first
2. Review backend logs: `npm run dev`
3. Check browser console for frontend errors
4. Review database logs

---

## Version Information

- **Node.js:** 18+
- **PostgreSQL:** 14+
- **Express:** 4.18+
- **JWT:** jsonwebtoken 9.0+
- **Anthropic SDK:** 0.20+

---

**Happy Coaching! 🚀✈️**
