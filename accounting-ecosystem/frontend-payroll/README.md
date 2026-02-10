# Payroll System - Loonstelsel

## Files Included

- **index.html** - Landing page / app launcher
- **employee-management.html** - Main employee management dashboard
- **employee-detail.html** - Individual employee details and editing
- **payruns.html** - Pay run management and processing
- **payroll-items.html** - Payroll item configuration
- **payroll-test.html** - Test version of payroll system

## How to Use

1. Copy this entire `Payroll_App` folder to your new app location
2. Open `index.html` in a web browser to launch the Payroll system
3. Login with demo credentials:
   - **Username:** demo
   - **Password:** demo123

## Features

- Employee management (add, edit, view employees)
- Employee details (personal info, banking, tax info)
- Pay run processing
- Payroll item configuration
- Demo mode (works without backend server)

## Demo Mode

The app includes a built-in demo mode that works without a backend server:
- Demo banks: ABSA, Standard Bank, FNB, Nedbank, Capitec
- Empty employee list ready for you to add employees
- All CRUD operations work locally

## Backend Integration

If you want to connect to a backend server:
- The API endpoint is configured in each file: `const API_URL = 'http://localhost:3000/api'`
- Change this to your actual API endpoint
- The app will automatically use the backend when available

## Notes

- All files are self-contained HTML with inline CSS and JavaScript
- Language: Afrikaans (can be easily translated)
- Works standalone or with backend integration

---

**Version:** 1.0
**Last Updated:** January 2026
**Demo Login:** demo / demo123
