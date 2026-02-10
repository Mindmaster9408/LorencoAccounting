# Coaching App Backend

Multi-user coaching application backend with PostgreSQL, JWT authentication, and AI integration (Claude & Grok).

## Features

- **Multi-user Authentication**: Secure JWT-based authentication for admins and coaches
- **Role-based Access Control**: Granular permissions for different user roles
- **Client Management**: Each coach can only access their own clients
- **Program Module System**: Admin can enable/disable features per coach
- **AI Assistant Coach (AAC)**: Dual AI integration with Claude (primary) and Grok (fallback)
- **Learning System**: AI learns from each coach's style and each client's patterns
- **RESTful API**: Clean, documented API endpoints

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **npm** or **yarn**

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coaching_app
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# AI APIs
ANTHROPIC_API_KEY=sk-ant-xxx
GROK_API_KEY=your_grok_key
```

### 3. Setup PostgreSQL Database

Create the database:

```bash
# Using psql
psql -U postgres
CREATE DATABASE coaching_app;
\q
```

Run the setup script:

```bash
npm run db:setup
```

This will:
- Create all database tables
- Insert default program modules
- Create admin user: `admin@coachingapp.com` / `Admin@2025!`

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

Server will run on `http://localhost:3001`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | Get all clients for logged-in coach |
| GET | `/api/clients/:id` | Get client details |
| POST | `/api/clients` | Create new client |
| PUT | `/api/clients/:id` | Update client |
| PUT | `/api/clients/:id/gauges` | Update client gauges |
| DELETE | `/api/clients/:id` | Archive client |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| GET | `/api/admin/modules` | Get all program modules |
| GET | `/api/admin/coaches/:id/modules` | Get coach's module access |
| POST | `/api/admin/coaches/:coachId/modules/:moduleId` | Enable/disable module |
| PATCH | `/api/admin/users/:id/status` | Activate/deactivate user |
| GET | `/api/admin/stats` | Get system statistics |

### AI Assistant

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Chat with AI assistant |
| GET | `/api/ai/insights/:clientId` | Get client insights |
| GET | `/api/ai/conversations` | Get conversation history |
| POST | `/api/ai/learn/session` | Learn from coaching session |

## Authentication

All API requests (except login/register) require JWT token in header:

```
Authorization: Bearer <token>
```

## Database Schema

### Core Tables

- **users**: Coaches and admins
- **clients**: Client profiles (linked to coaches)
- **client_steps**: Journey progress tracking
- **client_gauges**: Gauge readings over time
- **client_sessions**: Coaching session records
- **program_modules**: Feature modules
- **coach_program_access**: Module permissions per coach
- **ai_learning_data**: AI learning patterns
- **ai_conversations**: AI chat history

## Program Modules

Default modules:
- Dashboard ✓
- Client Management ✓
- Journey Steps ✓
- Cockpit Gauges ✓
- AI Assistant Coach (optional)
- Advanced Analytics (optional)
- Group Coaching (optional)
- Assessments & Ecochart (optional)
- MLNP (Gesigkaarte) (optional)
- Report Generation (optional)
- Training Library (optional)

Admins can enable/disable modules per coach through the admin panel.

## AI Integration

### How It Works

1. **Coach Learning**: AI observes coaching patterns and style
2. **Client Learning**: AI builds profile for each client
3. **Dual Provider**: Claude (primary) + Grok (fallback)
4. **Context-Aware**: AI has access to client history, gauges, sessions

### Example Usage

```javascript
// Chat with AI about a client
POST /api/ai/chat
{
  "clientId": 1,
  "message": "What should I focus on in my next session with this client?"
}

// Get automatic insights
GET /api/ai/insights/1
```

## Security Features

- **Helmet.js**: HTTP security headers
- **Rate Limiting**: Prevents abuse
- **JWT**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **CORS**: Configurable origins
- **SQL Injection Prevention**: Parameterized queries
- **Role-based Access**: Middleware protection

## Development

### Project Structure

```
backend/
├── config/
│   └── database.js         # DB connection pool
├── middleware/
│   └── auth.js             # Authentication middleware
├── routes/
│   ├── auth.routes.js      # Auth endpoints
│   ├── clients.routes.js   # Client management
│   ├── admin.routes.js     # Admin panel
│   └── ai.routes.js        # AI assistant
├── services/
│   └── ai.service.js       # AI integration logic
├── database/
│   ├── schema.sql          # Database schema
│   └── seed.sql            # Sample data
├── scripts/
│   └── setup-database.js   # Setup script
├── .env.example            # Environment template
├── server.js               # Main server file
└── package.json
```

### Adding New Endpoints

1. Create route file in `/routes`
2. Import in `server.js`
3. Add to `app.use()`
4. Apply middleware as needed

### Testing

Use tools like Postman or curl:

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@coachingapp.com","password":"Admin@2025!"}'

# Get clients (with token)
curl http://localhost:3001/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Database Connection Failed

- Ensure PostgreSQL is running
- Check `.env` credentials
- Verify database exists: `psql -l`

### Port Already in Use

Change port in `.env`:
```env
PORT=3002
```

### AI Errors

- Verify API keys in `.env`
- Check API quota/limits
- Review logs for specific errors

## Production Deployment

### Checklist

- [ ] Use strong `JWT_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Use environment-specific database
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Monitor error logs
- [ ] Use process manager (PM2)

### Environment Variables

All sensitive data should be in `.env` (never commit to git):

```bash
# Add to .gitignore
.env
node_modules/
```

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact the development team.
