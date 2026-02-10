# System Architecture - Multi-Company Payroll System

## 🏗️ Application Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAYROLL SYSTEM                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              ENTRY POINT: index.html                   │    │
│  │  (Auto-redirects based on login status & role)         │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↓                                     │
│  ┌─────────────────┬──────────────────┬─────────────────┐     │
│  │                 │                  │                 │      │
│  ↓                 ↓                  ↓                 ↓      │
│  ┌──────────┐  ┌─────────┐  ┌──────────────┐  ┌─────────┐   │
│  │  LOGIN   │  │REGISTER │  │NO SESSION?   │  │SESSIONS │   │
│  │  PAGE    │  │ PAGE    │  │REDIRECT HERE │  │MANAGEMENT   │
│  └──────────┘  └─────────┘  └──────────────┘  └─────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │         js/auth.js - Core Authentication Module       │    │
│  │                                                       │    │
│  │  • User validation                                   │    │
│  │  • Session storage/retrieval                        │    │
│  │  • Company management                               │    │
│  │  • Role-based routing                               │    │
│  │  • Mock database                                    │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 👥 User Role Routes

```
                    LOGIN
                      ↓
            ┌─────────┴─────────┐
            ↓                   ↓
        SUPER ADMIN          REGULAR USER
            │                   │
            ↓                   ↓
    SUPER ADMIN           COMPANY
    DASHBOARD         SELECTION
     (View all)            ↓
            │         COMPANY DASHBOARD
            │          (Sidebar Menu)
            │              ↓
            │     ┌─────────┬──────────┬─────────────┐
            │     ↓         ↓          ↓             ↓
            │   EMPLOYEES  PAYRUNS  PAYROLL ITEMS  DETAILS
            │
            └─→ All features accessible to single company users
```

## 📊 Data Structure

```
┌──────────────────────────────────────────────────┐
│         AUTH.js - Mock Database                  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ AUTH.COMPANIES (Array)                     │ │
│  │  - id: string                              │ │
│  │  - name: string                            │ │
│  │  - email: string                           │ │
│  │  - active: boolean                         │ │
│  │  - employees: number                       │ │
│  │  - created_date: date string               │ │
│  │  - subscription_status: string             │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ AUTH.USERS (Array)                         │ │
│  │  - id: string                              │ │
│  │  - email: string                           │ │
│  │  - password: string                        │ │
│  │  - name: string                            │ │
│  │  - role: string (super_admin/accountant/   │ │
│  │          business_owner)                   │ │
│  │  - company_id: string                      │ │
│  │  - active: boolean                         │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ localStorage - Session Storage             │ │
│  │  - user_id: string                         │ │
│  │  - email: string                           │ │
│  │  - name: string                            │ │
│  │  - role: string                            │ │
│  │  - company_id: string                      │ │
│  │  - login_time: timestamp                   │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## 🔄 Authentication Flow

```
                      START
                        ↓
              Check localStorage
                ↙               ↘
           HAS SESSION          NO SESSION
              ↓                    ↓
        Get User Data         → LOGIN.html
              ↓
        Check Role
         ↙        ↘
    SUPER ADMIN   REGULAR USER
        ↓             ↓
    ADMIN DASH   COMPANY SELECTION
                 or COMPANY DASHBOARD
                      ↓
                   PERFORM ACTIONS
                      ↓
                   LOGOUT
                      ↓
              Clear localStorage
                      ↓
                   REDIRECT TO LOGIN
```

## 🏢 Super Admin Features Map

```
┌─────────────────────────────────────────────────────┐
│         SUPER ADMIN DASHBOARD                       │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   STATS     │ │   SEARCH    │ │   TABLE     │ │
│  │ • Total     │ │ • By Name   │ │ • All Co.   │ │
│  │ • Active    │ │ • By Email  │ │ • Status    │ │
│  │ • Suspended │ │ • By ID     │ │ • Employees │ │
│  │ • Employees │ │ • Real-time │ │ • Created   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │      ACTIONS PER COMPANY                     │ │
│  │  ┌────────────┐  ┌──────────────────────┐   │ │
│  │  │  VIEW      │  │  ACTIVATE/SUSPEND    │   │ │
│  │  │ • Details  │  │  • Blocks user access│   │ │
│  │  │ • Employees│  │  • Requires confirm  │   │ │
│  │  │ • Status   │  │  • Updates real-time │   │ │
│  │  └────────────┘  └──────────────────────┘   │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 👤 Company Dashboard Navigation

```
┌─────────────────────────────────────────────────────┐
│         COMPANY DASHBOARD                           │
│                                                     │
│  ┌────────────────┐  ┌──────────────────────────┐ │
│  │     SIDEBAR    │  │     MAIN CONTENT         │ │
│  │ ┌────────────┐ │  │  ┌────────────────────┐  │ │
│  │ │ Dashboard  │ │  │  │   Welcome Card     │  │ │
│  │ │ Employees  │ │  │  │   Company Name     │  │ │
│  │ │ Pay Runs   │ │  │  │   Employee Count   │  │ │
│  │ │ Payroll    │ │  │  └────────────────────┘  │ │
│  │ │            │ │  │  ┌────────────────────┐  │ │
│  │ │ CAROUSEL   │ │  │  │  Quick Access Cards│  │ │
│  │ │ Company 1  │ │  │  │ • Employees        │  │ │
│  │ │ Company 2  │ │  │  │ • Pay Runs         │  │ │
│  │ │ Company 3  │ │  │  │ • Payroll Items    │  │ │
│  │ │            │ │  │  │ • Details          │  │ │
│  │ │ [Return]   │ │  │  └────────────────────┘  │ │
│  │ │ [Logout]   │ │  │                          │ │
│  │ └────────────┘ │  │                          │ │
│  └────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 📱 Responsive Design Breakpoints

```
┌─────────────────────────────────────────────────────┐
│          DESKTOP (1200px+)                          │
│  ┌────────────┐ ┌──────────────────────────────┐   │
│  │  SIDEBAR   │ │        MAIN CONTENT          │   │
│  │  (Sticky)  │ │        (Flexible Grid)       │   │
│  └────────────┘ └──────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│        TABLET (768px - 1200px)                      │
│  ┌────────────┐ ┌──────────────────────────────┐   │
│  │  SIDEBAR   │ │        CONTENT               │   │
│  │  (Smaller) │ │        (Adjusted)            │   │
│  └────────────┘ └──────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│          MOBILE (<768px)                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  SIDEBAR (Full Width, Collapsible)          │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  MAIN CONTENT (Full Width, Stacked)         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 🔐 Security Model

```
┌──────────────────────────────────────────────────────┐
│              SECURITY LAYERS                         │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. AUTHENTICATION                           │   │
│  │    - Email/Password validation              │   │
│  │    - Super admin special handling           │   │
│  │    - Session creation on login              │   │
│  └─────────────────────────────────────────────┘   │
│                         ↓                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ 2. AUTHORIZATION                            │   │
│  │    - Role-based access control              │   │
│  │    - Super admin → all companies            │   │
│  │    - User → assigned company only           │   │
│  └─────────────────────────────────────────────┘   │
│                         ↓                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ 3. SESSION MANAGEMENT                       │   │
│  │    - localStorage based sessions            │   │
│  │    - Auto-redirect on invalid session       │   │
│  │    - Logout clears all data                 │   │
│  └─────────────────────────────────────────────┘   │
│                         ↓                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ 4. COMPANY ISOLATION                        │   │
│  │    - Users can't access other companies     │   │
│  │    - Search/filter respects permissions     │   │
│  │    - Admin can view all                     │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## 🔄 State Management

```
┌────────────────────────────────────────────────────┐
│              APPLICATION STATE                     │
│                                                    │
│  ┌───────────────────────────────────────────┐   │
│  │ localStorage (Persistent)                 │   │
│  │  {                                        │   │
│  │    session: {                             │   │
│  │      user_id,                             │   │
│  │      email,                               │   │
│  │      name,                                │   │
│  │      role,                                │   │
│  │      company_id,                          │   │
│  │      login_time                           │   │
│  │    }                                       │   │
│  │  }                                        │   │
│  └───────────────────────────────────────────┘   │
│                       ↓                           │
│  ┌───────────────────────────────────────────┐   │
│  │ Variables (Session)                       │   │
│  │  • Current user info                      │   │
│  │  • Current company info                   │   │
│  │  • UI state (modals, forms)               │   │
│  └───────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

## 📊 API Readiness

```
When integrating with backend:

┌──────────────────┐         ┌──────────────────┐
│  FRONTEND        │         │   BACKEND        │
│  (Current)       │         │   (Future)       │
│                  │         │                  │
│ • HTML Files     │◄────────┤ • API Routes     │
│ • CSS Styling    │────────►│ • Database       │
│ • Form Handling  │         │ • Auth Logic     │
│ • UI State       │         │ • User Mgmt      │
│ • Validation     │         │ • Company Mgmt   │
│                  │         │ • Permissions    │
└──────────────────┘         └──────────────────┘

Replace auth.js with API endpoints:
POST   /api/auth/login      - User login
POST   /api/auth/register   - New user registration
POST   /api/auth/logout     - Session termination
GET    /api/companies       - List companies
PATCH  /api/companies/:id   - Update company status
GET    /api/companies/:id   - Get company details
```

---

**Architecture Document**
**Version**: 2.0
**Date**: February 5, 2026
