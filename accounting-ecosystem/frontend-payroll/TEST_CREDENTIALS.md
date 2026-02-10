# Test Credentials - Payroll System

## 🔐 Super Admin Account

| Field | Value |
|-------|-------|
| **Email** | antonjvr@lorenco |
| **Password** | Lorenco@190409 |
| **Role** | Super Administrator |
| **Access** | All companies, all management functions |

**Use Case**: System administration, company activation/suspension, viewing all companies and employee statistics

---

## 👤 Demo User

| Field | Value |
|-------|-------|
| **Email** | demo@example.com |
| **Password** | demo123 |
| **Role** | Business Owner |
| **Company** | Demo Company |
| **Access** | Full payroll system features |

**Use Case**: Testing and exploration without affecting real data

---

## 🏢 Sample Companies

All sample users are associated with these companies:

### 1. Lorenco Enterprise
- **ID**: comp-001
- **Email**: info@lorenco.com
- **Status**: Active ✓
- **Employees**: 12
- **Created**: January 15, 2024

### 2. Tech Solutions Inc
- **ID**: comp-002
- **Email**: hr@techsolutions.com
- **Status**: Active ✓
- **Employees**: 8
- **Created**: February 10, 2024

### 3. Global Consulting Group
- **ID**: comp-003
- **Email**: admin@globalconsulting.com
- **Status**: Suspended ⚠️
- **Employees**: 25
- **Created**: December 1, 2023

### 4. Finance Plus
- **ID**: comp-004
- **Email**: contact@financeplus.com
- **Status**: Active ✓
- **Employees**: 5
- **Created**: March 5, 2024

### 5. Retail Masters
- **ID**: comp-005
- **Email**: support@retailmasters.com
- **Status**: Active ✓
- **Employees**: 15
- **Created**: January 20, 2024

### 6. Manufacturing Works
- **ID**: comp-006
- **Email**: hr@manufworks.com
- **Status**: Active ✓
- **Employees**: 30
- **Created**: November 10, 2023

### 7. Demo Company
- **ID**: demo-company
- **Email**: demo@example.com
- **Status**: Active ✓
- **Employees**: 0
- **Created**: January 1, 2024

---

## 👥 Sample Users

### Lorenco Enterprise Users

#### 1. Business Owner
| Field | Value |
|-------|-------|
| Email | john.owner@lorenco.com |
| Password | Password@123 |
| Name | John Smith |
| Role | Business Owner |
| Company | Lorenco Enterprise |

#### 2. Accountant
| Field | Value |
|-------|-------|
| Email | sarah.accountant@lorenco.com |
| Password | Password@123 |
| Name | Sarah Johnson |
| Role | Accountant |
| Company | Lorenco Enterprise |

---

### Tech Solutions Inc Users

#### 3. Business Owner
| Field | Value |
|-------|-------|
| Email | mike.owner@techsolutions.com |
| Password | Password@123 |
| Name | Mike Tech |
| Role | Business Owner |
| Company | Tech Solutions Inc |

#### 4. Accountant
| Field | Value |
|-------|-------|
| Email | emma.accountant@techsolutions.com |
| Password | Password@123 |
| Name | Emma Watson |
| Role | Accountant |
| Company | Tech Solutions Inc |

---

### Global Consulting Group Users

#### 5. Business Owner
| Field | Value |
|-------|-------|
| Email | david.owner@globalconsulting.com |
| Password | Password@123 |
| Name | David Brown |
| Role | Business Owner |
| Company | Global Consulting Group |

---

## 🧪 Testing Scenarios

### Scenario 1: Super Admin Management
```
1. Login as: antonjvr@lorenco / Lorenco@190409
2. View Super Admin Dashboard
3. Search for "Tech Solutions"
4. Click "View" to see company details
5. Click "Suspend" to suspend the company
6. Verify status changes to "Suspended"
7. Click "Activate" to reactivate
```

### Scenario 2: Company User Access
```
1. Login as: john.owner@lorenco.com / Password@123
2. Select "Lorenco Enterprise"
3. See company dashboard
4. Access Employee Management
5. Navigate between modules using sidebar
6. Use "Switch Company" to see other companies
7. Click "Return to Dashboard" to go back
8. Logout
```

### Scenario 3: New User Registration
```
1. On login page, click "Register"
2. Fill in:
   - Name: Test User
   - Email: testuser@example.com
   - Password: TestPass@123
   - Confirm: TestPass@123
   - Role: Accountant
3. Click "Create Account"
4. Should redirect to company selection
5. Verify account was created
```

### Scenario 4: Demo User Flow
```
1. Login as: demo@example.com / demo123
2. Select "Demo Company"
3. Explore all modules
4. Test adding/editing data
5. Logout
6. All changes are local and temporary
```

---

## 📊 Quick Statistics (from Mock Data)

- **Total Companies**: 7
- **Active Companies**: 6
- **Suspended Companies**: 1
- **Total Employees**: 95
- **Total Users**: 6 (including super admin)

---

## 🔄 Database Reset

Since this uses mock data in JavaScript:
- **No reset needed** - just refresh the browser
- **All changes are temporary** - lost on page reload
- **No data persistence** - when connecting to real database, use proper reset mechanisms

---

## 🛠️ Modifying Test Data

### To Add a New Company
Edit `js/auth.js`, find `AUTH.COMPANIES` array:
```javascript
{
    id: 'comp-007',
    name: 'Your Company Name',
    email: 'contact@yourcompany.com',
    active: true,
    employees: 10,
    created_date: '2024-02-05',
    subscription_status: 'active'
}
```

### To Add a New User
Edit `js/auth.js`, find `AUTH.USERS` array:
```javascript
{
    id: 'user-006',
    email: 'newuser@example.com',
    password: 'NewPassword@123',
    name: 'New User',
    role: 'business_owner',
    company_id: 'comp-007',
    active: true
}
```

### To Change Super Admin Credentials
Edit `js/auth.js`, find `AUTH.SUPER_ADMIN`:
```javascript
SUPER_ADMIN: {
    email: 'newemail@domain.com',
    password: 'NewPassword@123',
    name: 'Super Admin',
    role: 'super_admin'
}
```

---

**Last Updated**: February 5, 2026
**Version**: 2.0
