# Quick Start Guide - Coaching App

## 🚀 5-Minute Setup

### 1️⃣ Install PostgreSQL

Download: https://www.postgresql.org/download/

Remember the password you set for `postgres` user!

### 2️⃣ Create Database

```bash
psql -U postgres
```

```sql
CREATE DATABASE coaching_app;
\q
```

### 3️⃣ Setup Backend

```bash
cd backend
npm install
copy .env.example .env
```

**Edit `.env` file:**
- Set `DB_PASSWORD=your_postgres_password`
- Set `JWT_SECRET=any_random_long_string`
- (AI keys optional for now)

**Initialize database:**
```bash
npm run db:setup
```

**Start backend:**
```bash
npm run dev
```

### 4️⃣ Open Frontend

1. Install **Live Server** extension in VS Code
2. Right-click `login.html` → **Open with Live Server**

### 5️⃣ Login

Go to: http://localhost:5500/login.html

**Default credentials:**
- Email: `admin@coachingapp.com`
- Password: `Admin@2025!`

---

## ✅ What You Get

### Multi-User System
- ✅ Admin panel to manage coaches
- ✅ Each coach sees only their clients
- ✅ Role-based access control

### Client Management
- ✅ Add/edit clients
- ✅ Track 15-step journey
- ✅ Visual cockpit gauges
- ✅ Session notes

### Admin Controls
- ✅ Enable/disable features per coach
- ✅ Activate/deactivate users
- ✅ System statistics
- ✅ Module permissions

### AI Assistant Coach (AAC)
- ✅ Dual AI (Claude + Grok fallback)
- ✅ Learns each coach's style
- ✅ Individual client profiles
- ✅ Coaching insights

### Security
- ✅ JWT authentication
- ✅ Password hashing
- ✅ CORS protection
- ✅ Rate limiting

---

## 📱 Key Features

### For Coaches
- Dashboard with all active clients
- Hover over client card → stands out
- Click client → opens full profile
- Update gauges (9 cockpit instruments)
- Track 15-step coaching journey
- Session notes and history

### For Admins
- Manage all coaches
- Enable/disable program modules per coach
- View system statistics
- Full access to all features

### AI Features (When Enabled)
- Chat about clients
- Get session prep insights
- Pattern recognition
- Personalized recommendations

---

## 🎯 Common Tasks

### Create a New Coach

**Via API:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@example.com",
    "password": "Password123!",
    "firstName": "Sarah",
    "lastName": "Coach",
    "role": "coach"
  }'
```

### Enable AI for a Coach

1. Login as admin
2. Go to admin panel
3. Select coach
4. Toggle "AI Assistant Coach" module
5. Add API keys to `.env`

### Add API Keys

Edit `backend/.env`:

```env
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# Get from: https://x.ai/
GROK_API_KEY=xai-xxx
```

Restart backend: `npm run dev`

---

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check PostgreSQL is running
# Windows:
sc query postgresql-x64-14

# Mac:
brew services list
```

### Can't connect to database
- Verify password in `.env` matches PostgreSQL
- Check database exists: `psql -U postgres -l`

### CORS error
- Make sure backend is running on port 3001
- Check `ALLOWED_ORIGINS` in `.env`

### Login not working
- Backend running? Check http://localhost:3001/health
- Database setup complete? Run `npm run db:setup`
- Correct credentials? `admin@coachingapp.com` / `Admin@2025!`

---

## 📚 Documentation

- **Full Setup Guide:** See `SETUP_GUIDE.md`
- **Backend API:** See `backend/README.md`
- **Database Schema:** See `backend/database/schema.sql`

---

## 🎨 Client Card Hover Effect

When you hover over a client card:
- ✨ Card lifts up and scales slightly
- 🔵 Blue border appears
- 📈 Higher elevation shadow
- 👆 Cursor changes to pointer

Click to open full client profile!

---

## 🗺️ Journey Steps (15 Total)

1. 4 Quadrant Exercise
2. Present-Gap-Future
3. Flight Plan
4. Deep Dive
5. Assessments & Ecochart
6. The Dashboard
7. Psycho Education
8. MLNP (Gesigkaarte)
9. Reassessment
10. Revisit
11. The Dream-Spot
12. Values & Beliefs
13. Success Traits
14. Curiosity/Passion/Purpose
15. Creativity & Flow

---

## 🎛️ Cockpit Gauges (9 Total)

- **Fuel / Energy** - Emotional Functioning
- **Artificial Horizon** - Flow State Qualities
- **Thrust** - Drive & Motivation
- **Engine Condition** - Self-Perception
- **Compass** - Direction & Dream
- **Positive** - Positive Functioning
- **Weight** - Ecochart Balance
- **Navigation** - Life Navigation
- **Negative** - Stress Indicators

---

## 🎓 Next Steps

1. ✅ Login as admin
2. ✅ Create a coach account
3. ✅ Login as coach
4. ✅ Add sample clients
5. ✅ Update client gauges
6. ✅ Enable AI module (optional)
7. ✅ Test AI insights (optional)

---

## 💡 Tips

- **Offline Mode:** App works with localStorage if backend is down
- **Multi-Coach:** Each coach sees only their clients
- **Isolation:** Complete data separation between coaches
- **Scalable:** Add unlimited coaches and clients
- **Modular:** Enable features per coach via admin panel

---

**Need Help?** Check `SETUP_GUIDE.md` for detailed instructions.

**Ready to Coach!** 🚀✈️
