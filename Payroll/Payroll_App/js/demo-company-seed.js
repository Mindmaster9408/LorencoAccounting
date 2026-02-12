// ============================================================
// DemoCompanySeed - Standard Demo Company Data
// Automatically seeded for every new payroll user/company.
// Provides realistic SA payroll data so users can explore the
// system immediately after registration.
// ============================================================

var DemoCompanySeed = {

    // Demo company profile
    DEMO_COMPANY: {
        name: 'ABC Trading (Pty) Ltd',
        email: 'info@abctrading.co.za',
        registration_number: '2024/123456/07',
        tax_number: '9012345678',
        uif_reference: 'U12345678',
        sdl_number: 'L12345678',
        address: '123 Main Road, Sandton, Gauteng, 2196',
        phone: '011 555 1234',
        payroll_frequency: 'monthly',
        pay_day: 25,
        financial_year_end: 'February'
    },

    // 5 realistic demo employees with full SA payroll details
    DEMO_EMPLOYEES: [
        {
            id: 'demo-emp-001',
            employee_number: 'EMP001',
            first_name: 'Pieter',
            last_name: 'van der Merwe',
            id_number: '8505155012083',  // Male, born 1985-05-15
            email: 'pieter@abctrading.co.za',
            phone: '082 555 0001',
            job_title: 'Operations Manager',
            department: 'Operations',
            position: 'Manager',
            payment_method: 'EFT',
            bank_name: 'ABSA',
            account_holder: 'P van der Merwe',
            account_number: '4012345678',
            branch_code: '632005',
            date_appointed: '2022-03-01',
            medical_aid_members: 3,
            tax_directive: 0,
            is_active: true
        },
        {
            id: 'demo-emp-002',
            employee_number: 'EMP002',
            first_name: 'Naledi',
            last_name: 'Molefe',
            id_number: '9208240045087',  // Female, born 1992-08-24
            email: 'naledi@abctrading.co.za',
            phone: '073 555 0002',
            job_title: 'Senior Accountant',
            department: 'Finance',
            position: 'Senior',
            payment_method: 'EFT',
            bank_name: 'FNB',
            account_holder: 'N Molefe',
            account_number: '6234567890',
            branch_code: '250655',
            date_appointed: '2023-01-15',
            medical_aid_members: 1,
            tax_directive: 0,
            is_active: true
        },
        {
            id: 'demo-emp-003',
            employee_number: 'EMP003',
            first_name: 'Johan',
            last_name: 'Botha',
            id_number: '7811035028080',  // Male, born 1978-11-03
            email: 'johan@abctrading.co.za',
            phone: '084 555 0003',
            job_title: 'Sales Representative',
            department: 'Sales',
            position: 'Representative',
            payment_method: 'EFT',
            bank_name: 'Standard Bank',
            account_holder: 'J Botha',
            account_number: '0734567891',
            branch_code: '051001',
            date_appointed: '2021-06-01',
            medical_aid_members: 4,
            tax_directive: 0,
            is_active: true
        },
        {
            id: 'demo-emp-004',
            employee_number: 'EMP004',
            first_name: 'Thandi',
            last_name: 'Nkosi',
            id_number: '9503180091082',  // Female, born 1995-03-18
            email: 'thandi@abctrading.co.za',
            phone: '061 555 0004',
            job_title: 'HR Administrator',
            department: 'Human Resources',
            position: 'Administrator',
            payment_method: 'EFT',
            bank_name: 'Capitec',
            account_holder: 'T Nkosi',
            account_number: '1234567890',
            branch_code: '470010',
            date_appointed: '2024-02-01',
            medical_aid_members: 0,
            tax_directive: 0,
            is_active: true
        },
        {
            id: 'demo-emp-005',
            employee_number: 'EMP005',
            first_name: 'Michael',
            last_name: 'Govender',
            id_number: '8901165032085',  // Male, born 1989-01-16
            email: 'michael@abctrading.co.za',
            phone: '079 555 0005',
            job_title: 'Warehouse Supervisor',
            department: 'Logistics',
            position: 'Supervisor',
            payment_method: 'EFT',
            bank_name: 'Nedbank',
            account_holder: 'M Govender',
            account_number: '1098765432',
            branch_code: '198765',
            date_appointed: '2023-07-15',
            medical_aid_members: 2,
            tax_directive: 0,
            is_active: true
        }
    ],

    // Employee payroll data (basic salary + regular inputs)
    DEMO_PAYROLL_DATA: {
        'demo-emp-001': { basic_salary: 45000, regular_inputs: [] },
        'demo-emp-002': { basic_salary: 35000, regular_inputs: [] },
        'demo-emp-003': { basic_salary: 28000, regular_inputs: [
            { item_code: 'COMM', description: 'Sales Commission', amount: 5000 }
        ]},
        'demo-emp-004': { basic_salary: 18000, regular_inputs: [] },
        'demo-emp-005': { basic_salary: 22000, regular_inputs: [
            { item_code: 'SHIFT', description: 'Shift Allowance', amount: 1500 }
        ]}
    },

    // Standard payroll items (income, allowances, deductions, employer contributions)
    DEMO_PAYROLL_ITEMS: [
        // Income Items
        {
            id: 'pi-basic-salary',
            item_code: 'BASIC',
            item_name: 'Basic Salary',
            item_type: 'income',
            category: 'salary',
            irp5_code: '3601',
            default_amount: 0,
            is_taxable: true,
            affects_uif: true
        },
        {
            id: 'pi-overtime',
            item_code: 'OT',
            item_name: 'Overtime',
            item_type: 'income',
            category: 'overtime',
            irp5_code: '3601',
            default_amount: 0,
            is_taxable: true,
            affects_uif: true
        },
        {
            id: 'pi-commission',
            item_code: 'COMM',
            item_name: 'Commission',
            item_type: 'income',
            category: 'commission',
            irp5_code: '3606',
            default_amount: 0,
            is_taxable: true,
            affects_uif: true
        },
        {
            id: 'pi-bonus',
            item_code: 'BONUS',
            item_name: 'Annual Bonus',
            item_type: 'income',
            category: 'bonus',
            irp5_code: '3605',
            default_amount: 0,
            is_taxable: true,
            affects_uif: false
        },

        // Allowance Items
        {
            id: 'pi-travel-allow',
            item_code: 'TRAVEL',
            item_name: 'Travel Allowance',
            item_type: 'allowance',
            category: 'travel',
            irp5_code: '3701',
            default_amount: 0,
            is_taxable: true,
            affects_uif: false
        },
        {
            id: 'pi-cell-allow',
            item_code: 'CELL',
            item_name: 'Cellphone Allowance',
            item_type: 'allowance',
            category: 'communication',
            irp5_code: '3713',
            default_amount: 500,
            is_taxable: true,
            affects_uif: false
        },
        {
            id: 'pi-shift-allow',
            item_code: 'SHIFT',
            item_name: 'Shift Allowance',
            item_type: 'allowance',
            category: 'shift',
            irp5_code: '3707',
            default_amount: 0,
            is_taxable: true,
            affects_uif: true
        },

        // Deduction Items
        {
            id: 'pi-paye',
            item_code: 'PAYE',
            item_name: 'PAYE (Income Tax)',
            item_type: 'deduction',
            category: 'tax',
            irp5_code: '4101',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-uif-emp',
            item_code: 'UIF',
            item_name: 'UIF (Employee)',
            item_type: 'deduction',
            category: 'statutory',
            irp5_code: '4141',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-pension-emp',
            item_code: 'PENS',
            item_name: 'Pension Fund (Employee)',
            item_type: 'deduction',
            category: 'retirement',
            irp5_code: '4001',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-medical-emp',
            item_code: 'MED',
            item_name: 'Medical Aid (Employee)',
            item_type: 'deduction',
            category: 'medical',
            irp5_code: '4005',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-loan',
            item_code: 'LOAN',
            item_name: 'Staff Loan Repayment',
            item_type: 'deduction',
            category: 'loan',
            irp5_code: '4024',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },

        // Employer Contributions
        {
            id: 'pi-uif-er',
            item_code: 'UIF-ER',
            item_name: 'UIF (Employer)',
            item_type: 'employer_contribution',
            category: 'statutory',
            irp5_code: '4142',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-sdl',
            item_code: 'SDL',
            item_name: 'Skills Development Levy',
            item_type: 'employer_contribution',
            category: 'statutory',
            irp5_code: '4150',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-pension-er',
            item_code: 'PENS-ER',
            item_name: 'Pension Fund (Employer)',
            item_type: 'employer_contribution',
            category: 'retirement',
            irp5_code: '4474',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        },
        {
            id: 'pi-medical-er',
            item_code: 'MED-ER',
            item_name: 'Medical Aid (Employer)',
            item_type: 'employer_contribution',
            category: 'medical',
            irp5_code: '4493',
            default_amount: 0,
            is_taxable: false,
            affects_uif: false
        }
    ],

    // PAYE configuration
    DEMO_PAYE_CONFIG: {
        incomeTypes: [
            { code: '3601', name: 'Basic Salary',      active: true },
            { code: '3605', name: 'Bonus',              active: true },
            { code: '3606', name: 'Commission',         active: true },
            { code: '3701', name: 'Travel Allowance',   active: true },
            { code: '3707', name: 'Shift Allowance',    active: true },
            { code: '3713', name: 'Other Allowance',    active: true }
        ],
        deductionTypes: [
            { code: '4001', name: 'Pension Fund',       active: true },
            { code: '4005', name: 'Medical Aid',        active: true },
            { code: '4024', name: 'Other Deduction',    active: true },
            { code: '4101', name: 'PAYE',               active: true },
            { code: '4141', name: 'UIF Employee',       active: true },
            { code: '4142', name: 'UIF Employer',       active: true }
        ]
    },

    // Company details (extended info)
    DEMO_COMPANY_DETAILS: {
        registration_number: '2024/123456/07',
        tax_number: '9012345678',
        uif_reference: 'U12345678',
        sdl_number: 'L12345678',
        address_line1: '123 Main Road',
        address_line2: 'Sandton',
        city: 'Johannesburg',
        province: 'Gauteng',
        postal_code: '2196',
        phone: '011 555 1234',
        bank_name: 'ABSA',
        account_number: '4099887766',
        branch_code: '632005',
        account_type: 'Current',
        payroll_frequency: 'monthly',
        pay_day: 25
    },

    // ========================================================
    // seedForCompany(companyId)
    // Call this after creating a new company to populate it
    // with demo data. Only seeds if data doesn't already exist.
    // ========================================================
    seedForCompany: function(companyId) {
        if (!companyId) return false;

        var seeded = false;

        // 1. Seed employees (only if none exist yet)
        var existingEmps = DataAccess.getEmployees(companyId);
        if (!existingEmps || existingEmps.length === 0) {
            DataAccess.saveEmployees(companyId, this.DEMO_EMPLOYEES);
            seeded = true;
        }

        // 2. Seed employee payroll data (basic salary / regular inputs)
        var self = this;
        this.DEMO_EMPLOYEES.forEach(function(emp) {
            var existing = DataAccess.getEmployeePayroll(companyId, emp.id);
            if (!existing || existing.basic_salary === 0) {
                var payrollData = self.DEMO_PAYROLL_DATA[emp.id] || { basic_salary: 0, regular_inputs: [] };
                DataAccess.saveEmployeePayroll(companyId, emp.id, payrollData);
                seeded = true;
            }
        });

        // 3. Seed payroll items (only if none exist yet)
        var existingItems = DataAccess.getPayrollItems(companyId);
        if (!existingItems || existingItems.length === 0) {
            DataAccess.savePayrollItems(companyId, this.DEMO_PAYROLL_ITEMS);
            seeded = true;
        }

        // 4. Seed PAYE config (only if not set)
        var existingPaye = DataAccess.get('paye_config_' + companyId);
        if (!existingPaye) {
            DataAccess.set('paye_config_' + companyId, this.DEMO_PAYE_CONFIG);
            seeded = true;
        }

        // 5. Seed company details (only if not set)
        var existingDetails = DataAccess.getCompanyDetails(companyId);
        if (!existingDetails || !existingDetails.registration_number) {
            DataAccess.saveCompanyDetails(companyId, this.DEMO_COMPANY_DETAILS);
            seeded = true;
        }

        // 6. Mark company as seeded so we don't re-run
        if (seeded) {
            DataAccess.set('demo_seeded_' + companyId, true);
            console.log('[DemoCompanySeed] Demo data seeded for company: ' + companyId);
        }

        return seeded;
    },

    // ========================================================
    // isSeeded(companyId)
    // Check if demo data has already been seeded for a company
    // ========================================================
    isSeeded: function(companyId) {
        return !!DataAccess.get('demo_seeded_' + companyId);
    },

    // ========================================================
    // clearDemoData(companyId)
    // Remove all demo data for a company (for resetting)
    // ========================================================
    clearDemoData: function(companyId) {
        if (!companyId) return;

        // Remove employees
        DataAccess.remove('employees_' + companyId);

        // Remove employee payroll data
        this.DEMO_EMPLOYEES.forEach(function(emp) {
            DataAccess.remove('emp_payroll_' + companyId + '_' + emp.id);
        });

        // Remove payroll items
        DataAccess.remove('payroll_items_' + companyId);

        // Remove PAYE config
        DataAccess.remove('paye_config_' + companyId);

        // Remove company details
        DataAccess.remove('company_details_' + companyId);

        // Remove seeded flag
        DataAccess.remove('demo_seeded_' + companyId);

        console.log('[DemoCompanySeed] Demo data cleared for company: ' + companyId);
    }
};
