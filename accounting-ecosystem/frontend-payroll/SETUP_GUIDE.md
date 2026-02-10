# Multi-Company Payroll System - Setup Guide

## System Overview

This is a complete multi-company payroll management system with super admin functionality, company-level management, and role-based access control.

---

## Key Features Implemented

### 1. **Authentication System**
- **Super Admin Account**: `antonjvr@lorenco` / `Lorenco@190409`
- **Demo User**: `demo@example.com` / `demo123`
- **User Registration**: New users can register with role selection (Accountant or Business Owner)
- **Session Management**: Persistent sessions using browser localStorage

### 2. **Super Admin Dashboard** (`super-admin-dashboard.html`)
- View all companies in the system
- Real-time statistics:
  - Total companies count
  - Active companies count
  - Suspended companies count
  - Total employees across all companies
- **Company Management Controls**:
  - Activate/Suspend company accounts
  - View detailed company information
  - Search and filter companies
  - Track company creation dates and subscription status

### 3. **Company Selection Page** (`company-selection.html`)
- Display available companies for logged-in users
- Show employee counts for each company
- Show company status and subscription information
- One-click company selection

### 4. **Company Dashboard** (`company-dashboard.html`)
- Welcome screen after company selection
- **Left Sidebar Navigation**:
  - Dashboard link
  - Employee Management
  - Pay Runs
  - Payroll Items
  - **Switch Company Carousel**: Display next 3 active companies
  - Return to Company Selection button
  - Logout button
- Quick access cards to all major modules

### 5. **Login Page** (`login.html`)
- Two tabs: Login and Register
- **Login Tab**:
  - Demo credentials displayed
  - Super admin login support
  - Regular user login
  - Forgot password placeholder
- **Register Tab**:
  - Full name, email, password
  - Password confirmation
  - Account type selection (Business Owner/Accountant)
  - Form validation
  - Real-time error messages

### 6. **Authentication Module** (`js/auth.js`)
- Core authentication functions
- Session management
- Mock database with:
  - 6 sample companies
  - 5 sample users
  - Super admin credentials
  - Demo user account
- Methods for:
  - Login validation
  - User registration
  - Company status toggling
  - Session storage/retrieval
  - Employee count tracking

---

## How to Use

### **For Super Admin**
1. Go to `login.html` or open `index.html`
2. Enter credentials:
   - Email: `antonjvr@lorenco`
   - Password: `Lorenco@190409`
3. Access Super Admin Dashboard showing:
   - All companies registered in the system
   - Employee counts per company
   - Activation/suspension controls
   - Company search functionality

### **For Regular Users**
1. Click "Register" on login page
2. Fill in:
   - Full name
   - Email address
   - Strong password
   - Account type (Business Owner or Accountant)
3. After registration, select your assigned company
4. Access company dashboard with full payroll functionality

### **For Demo User**
1. Click "Login"
2. Enter:
   - Email: `demo@example.com`
   - Password: `demo123`
3. Select Demo Company from the list
4. Access full payroll application

---

## Database Structure

### **Companies** (Mock Database)
```javascript
{
  id: 'comp-001',
  name: 'Company Name',
  email: 'company@email.com',
  active: true,
  employees: 12,
  created_date: '2024-01-15',
  subscription_status: 'active' // or 'suspended'
}
```

### **Users** (Mock Database)
```javascript
{
  id: 'user-001',
  email: 'user@email.com',
  password: 'Password@123',
  name: 'User Name',
  role: 'business_owner', // or 'accountant' or 'super_admin'
  company_id: 'comp-001',
  active: true
}
```

### **Session Structure**
```javascript
{
  user_id: 'user-001',
  email: 'user@email.com',
  name: 'User Name',
  role: 'business_owner',
  company_id: 'comp-001',
  login_time: '2024-01-15T10:30:00Z'
}
```

---

## File Structure

```
Payroll_App/
├── login.html                    # Login & Registration page
├── company-selection.html        # Company selection page
├── company-dashboard.html        # Company welcome dashboard
├── super-admin-dashboard.html   # Super admin management panel
├── index.html                    # Redirect page (updated)
├── employee-management.html      # Employee management (existing)
├── payruns.html                 # Pay runs management (existing)
├── payroll-items.html           # Payroll items config (existing)
├── employee-detail.html         # Employee details (existing)
├── payroll-test.html            # Test page (existing)
├── js/
│   └── auth.js                  # Authentication & session management
└── README.md                    # Documentation
```

---

## Authentication Flow

```
Index/Login Page
    ↓
Check Session → User Logged In?
    ├─ YES → Role Check
    │         ├─ Super Admin → Super Admin Dashboard
    │         └─ Regular User → Company Selection (if no company selected)
    │                          or Company Dashboard (if company selected)
    └─ NO → Login Page
            ├─ Register → Company Assignment (future)
            └─ Login → Company Selection or Admin Dashboard
```

---

## Features to Add in Future Versions

1. **Backend Integration**
   - Replace mock data with actual database
   - API endpoints for authentication
   - Persistent data storage

2. **Company Management**
   - Self-service company registration
   - Billing and payment processing
   - Company-specific settings

3. **User Management**
   - Company admin can invite users
   - Role-based permissions
   - Activity logging

4. **Advanced Reporting**
   - Super admin analytics
   - Company-level reports
   - Export functionality

5. **Security Enhancements**
   - Password reset functionality
   - Two-factor authentication
   - Audit logging
   - IP whitelisting for super admin

---

## Testing Credentials

### Super Admin
- **Email**: antonjvr@lorenco
- **Password**: Lorenco@190409
- **Access**: All companies, all management functions

### Demo User
- **Email**: demo@example.com
- **Password**: demo123
- **Company**: Demo Company (0 employees)

### Sample Users
- john.owner@lorenco.com / Password@123 (Business Owner - Lorenco Enterprise)
- sarah.accountant@lorenco.com / Password@123 (Accountant - Lorenco Enterprise)
- mike.owner@techsolutions.com / Password@123 (Business Owner - Tech Solutions)
- emma.accountant@techsolutions.com / Password@123 (Accountant - Tech Solutions)
- david.owner@globalconsulting.com / Password@123 (Business Owner - Global Consulting)

---

## Technical Details

### **Technologies Used**
- HTML5 for markup
- CSS3 for styling (with gradients and animations)
- Vanilla JavaScript for functionality
- localStorage for session management

### **Browser Compatibility**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### **Responsive Design**
- Mobile-first approach
- Works on desktop, tablet, and mobile devices
- Sidebar collapses on smaller screens

---

## Important Notes

1. **Mock Database**: Currently uses in-memory JavaScript objects. For production, replace with a real backend database.

2. **Session Storage**: Uses browser localStorage. Clear browser data will logout users.

3. **Password Security**: In production, passwords should be hashed and transmitted over HTTPS.

4. **CORS**: No backend API calls currently. Add CORS headers when connecting to backend.

5. **Data Persistence**: All changes are lost on page refresh (no backend storage).

---

## Support & Maintenance

### To customize:

1. **Change Super Admin Credentials**:
   - Edit `js/auth.js`, update `AUTH.SUPER_ADMIN` object

2. **Add More Companies**:
   - Edit `js/auth.js`, add to `AUTH.COMPANIES` array

3. **Add More Users**:
   - Edit `js/auth.js`, add to `AUTH.USERS` array

4. **Modify Styling**:
   - Each HTML file has inline CSS in `<style>` tags
   - Modify gradient colors, spacing, fonts as needed

5. **Connect to Backend**:
   - Replace localStorage with API calls
   - Update auth.js with your API endpoints
   - Add proper error handling

---

**Version**: 2.0 - Multi-Company Edition with Super Admin
**Last Updated**: February 5, 2026
