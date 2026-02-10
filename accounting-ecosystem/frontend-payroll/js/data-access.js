// ============================================================
// DataAccess - API-backed persistence layer
// ============================================================
// Converted from localStorage to REST API calls against the
// Accounting Ecosystem backend at /api/payroll/*
//
// All methods now return Promises. Callers must use await or .then()
// The API handles company_id scoping via the JWT token.
// ============================================================

var DataAccess = (function() {
    'use strict';

    const API_BASE = window.location.origin + '/api';

    // ─── HTTP Helper ─────────────────────────────────────────────────────────

    function getToken() {
        return localStorage.getItem('token');
    }

    async function apiRequest(method, path, body) {
        const url = API_BASE + path;
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const opts = { method, headers };
        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, opts);

            // Token expired — redirect to login
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('session');
                window.location.href = 'login.html';
                throw new Error('Session expired');
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }
            return data;
        } catch (err) {
            console.error('API Error [' + method + ' ' + path + ']:', err.message);
            throw err;
        }
    }

    function GET(path)        { return apiRequest('GET', path); }
    function POST(path, body) { return apiRequest('POST', path, body); }
    function PUT(path, body)  { return apiRequest('PUT', path, body); }
    function DELETE(path)     { return apiRequest('DELETE', path); }

    // ─── Local Cache (fallback for offline reads) ────────────────────────────

    function cacheSet(key, data) {
        try { localStorage.setItem('cache_' + key, JSON.stringify(data)); } catch(e) {}
    }

    function cacheGet(key) {
        try {
            const val = localStorage.getItem('cache_' + key);
            return val ? JSON.parse(val) : null;
        } catch(e) { return null; }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════

    return {

        // === SESSION (local — token-based) ===

        getSession: function() {
            var val = localStorage.getItem('session');
            if (!val) return null;
            try { return JSON.parse(val); } catch(e) { return null; }
        },

        saveSession: function(session) {
            localStorage.setItem('session', JSON.stringify(session));
        },

        clearSession: function() {
            localStorage.removeItem('session');
            localStorage.removeItem('token');
        },

        // === COMPANIES ===

        getRegisteredCompanies: async function() {
            try {
                const result = await GET('/auth/companies');
                const companies = result.companies || result.data || result;
                cacheSet('companies', companies);
                return companies;
            } catch(e) {
                return cacheGet('companies') || [];
            }
        },

        saveRegisteredCompanies: function(companies) {
            cacheSet('companies', companies);
        },

        getCompanyDetails: async function(companyId) {
            try {
                const result = await GET('/companies/' + companyId);
                return result.company || result.data || result;
            } catch(e) {
                return cacheGet('company_' + companyId) || {};
            }
        },

        saveCompanyDetails: async function(companyId, details) {
            try {
                await PUT('/companies/' + companyId, details);
            } catch(e) {
                console.error('Failed to save company details:', e.message);
            }
        },

        // === USERS ===

        getRegisteredUsers: async function() {
            try {
                const result = await GET('/users');
                return result.users || result.data || result;
            } catch(e) {
                return cacheGet('users') || [];
            }
        },

        saveRegisteredUsers: function(users) {
            cacheSet('users', users);
        },

        // === EMPLOYEES ===

        getEmployees: async function(companyId) {
            try {
                const result = await GET('/employees');
                const employees = result.employees || result.data || result;
                cacheSet('employees_' + companyId, employees);
                return employees;
            } catch(e) {
                return cacheGet('employees_' + companyId) || [];
            }
        },

        saveEmployees: async function(companyId, employees) {
            cacheSet('employees_' + companyId, employees);
        },

        getEmployeeById: async function(companyId, empId) {
            try {
                const result = await GET('/employees/' + empId);
                return result.employee || result.data || result;
            } catch(e) {
                var cached = cacheGet('employees_' + companyId) || [];
                return cached.find(function(e) { return e.id == empId; }) || null;
            }
        },

        // === EMPLOYEE PAYROLL DATA ===

        getEmployeePayroll: async function(companyId, empId) {
            try {
                const result = await GET('/payroll/employees/' + empId);
                return result.data || result || { basic_salary: 0, regular_inputs: [] };
            } catch(e) {
                return cacheGet('emp_payroll_' + companyId + '_' + empId) || { basic_salary: 0, regular_inputs: [] };
            }
        },

        saveEmployeePayroll: async function(companyId, empId, data) {
            try {
                await PUT('/payroll/employees/' + empId + '/salary', data);
                cacheSet('emp_payroll_' + companyId + '_' + empId, data);
            } catch(e) {
                cacheSet('emp_payroll_' + companyId + '_' + empId, data);
                console.error('Failed to save employee payroll:', e.message);
            }
        },

        // === PERIOD-SPECIFIC DATA ===

        getCurrentInputs: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/transactions?employee_id=' + empId + '&period=' + period);
                const txn = result.data || result;
                return txn.current_inputs || [];
            } catch(e) {
                return cacheGet('emp_current_' + companyId + '_' + empId + '_' + period) || [];
            }
        },

        saveCurrentInputs: async function(companyId, empId, period, inputs) {
            try {
                await POST('/payroll/transactions/inputs', {
                    employee_id: empId,
                    period_key: period,
                    inputs: inputs
                });
            } catch(e) {
                cacheSet('emp_current_' + companyId + '_' + empId + '_' + period, inputs);
            }
        },

        getOvertime: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/transactions?employee_id=' + empId + '&period=' + period + '&type=overtime');
                return result.data || [];
            } catch(e) {
                return cacheGet('emp_overtime_' + companyId + '_' + empId + '_' + period) || [];
            }
        },

        saveOvertime: async function(companyId, empId, period, entries) {
            try {
                await POST('/payroll/transactions/overtime', {
                    employee_id: empId, period_key: period, entries: entries
                });
            } catch(e) {
                cacheSet('emp_overtime_' + companyId + '_' + empId + '_' + period, entries);
            }
        },

        getShortTime: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/transactions?employee_id=' + empId + '&period=' + period + '&type=short_time');
                return result.data || [];
            } catch(e) {
                return cacheGet('emp_short_time_' + companyId + '_' + empId + '_' + period) || [];
            }
        },

        saveShortTime: async function(companyId, empId, period, entries) {
            try {
                await POST('/payroll/transactions/short-time', {
                    employee_id: empId, period_key: period, entries: entries
                });
            } catch(e) {
                cacheSet('emp_short_time_' + companyId + '_' + empId + '_' + period, entries);
            }
        },

        getMultiRate: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/transactions?employee_id=' + empId + '&period=' + period + '&type=multi_rate');
                return result.data || [];
            } catch(e) {
                return cacheGet('emp_multi_rate_' + companyId + '_' + empId + '_' + period) || [];
            }
        },

        saveMultiRate: async function(companyId, empId, period, entries) {
            try {
                await POST('/payroll/transactions/multi-rate', {
                    employee_id: empId, period_key: period, entries: entries
                });
            } catch(e) {
                cacheSet('emp_multi_rate_' + companyId + '_' + empId + '_' + period, entries);
            }
        },

        // === PAYSLIP STATUS ===

        getPayslipStatus: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/transactions?employee_id=' + empId + '&period=' + period);
                const txn = result.data || result;
                return { status: txn.status || 'draft' };
            } catch(e) {
                return cacheGet('emp_payslip_status_' + companyId + '_' + empId + '_' + period) || { status: 'draft' };
            }
        },

        savePayslipStatus: async function(companyId, empId, period, statusObj) {
            try {
                await PUT('/payroll/transactions/status', {
                    employee_id: empId, period_key: period,
                    status: statusObj.status || statusObj
                });
            } catch(e) {
                cacheSet('emp_payslip_status_' + companyId + '_' + empId + '_' + period, statusObj);
            }
        },

        removePayslipStatus: async function(companyId, empId, period) {
            try {
                await PUT('/payroll/transactions/status', {
                    employee_id: empId, period_key: period, status: 'draft'
                });
            } catch(e) {}
        },

        // === PAY RUNS ===

        getPayruns: async function(companyId) {
            try {
                const result = await GET('/payroll/periods');
                const periods = result.data || result.periods || result;
                cacheSet('payruns_' + companyId, periods);
                return periods;
            } catch(e) {
                return cacheGet('payruns_' + companyId) || [];
            }
        },

        savePayruns: async function(companyId, payruns) {
            cacheSet('payruns_' + companyId, payruns);
        },

        // === PAYROLL ITEMS (Master List) ===

        getPayrollItems: async function(companyId) {
            try {
                const result = await GET('/payroll/items');
                const items = result.data || result.items || result;
                cacheSet('payroll_items_' + companyId, items);
                return items;
            } catch(e) {
                return cacheGet('payroll_items_' + companyId) || [];
            }
        },

        savePayrollItems: async function(companyId, items) {
            cacheSet('payroll_items_' + companyId, items);
        },

        // === LEAVE ===

        getLeave: async function(companyId, empId) {
            try {
                const result = await GET('/payroll/attendance?employee_id=' + empId + '&type=leave');
                return result.data || [];
            } catch(e) {
                return cacheGet('emp_leave_' + companyId + '_' + empId) || [];
            }
        },

        saveLeave: async function(companyId, empId, leave) {
            try {
                await POST('/payroll/attendance/leave', { employee_id: empId, records: leave });
            } catch(e) {
                cacheSet('emp_leave_' + companyId + '_' + empId, leave);
            }
        },

        // === NOTES ===

        getNotes: async function(companyId, empId) {
            try {
                const result = await GET('/payroll/employees/' + empId + '/notes');
                return result.data || [];
            } catch(e) {
                return cacheGet('emp_notes_' + companyId + '_' + empId) || [];
            }
        },

        saveNotes: async function(companyId, empId, notes) {
            try {
                await POST('/payroll/employees/' + empId + '/notes', { notes: notes });
            } catch(e) {
                cacheSet('emp_notes_' + companyId + '_' + empId, notes);
            }
        },

        // === ATTENDANCE ===

        getAttendance: async function(companyId, dateStr) {
            try {
                const result = await GET('/payroll/attendance?date=' + dateStr);
                const entries = result.data || result.entries || result;
                cacheSet('attendance_' + companyId + '_' + dateStr, entries);
                return entries;
            } catch(e) {
                return cacheGet('attendance_' + companyId + '_' + dateStr) || [];
            }
        },

        saveAttendance: async function(companyId, dateStr, entries) {
            try {
                await POST('/payroll/attendance', { date: dateStr, entries: entries });
            } catch(e) {
                cacheSet('attendance_' + companyId + '_' + dateStr, entries);
            }
        },

        // === HISTORICAL DATA ===

        getHistoricalRecord: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/employees/' + empId + '/historical?period=' + period);
                return result.data || null;
            } catch(e) {
                return cacheGet('emp_historical_' + companyId + '_' + empId + '_' + period);
            }
        },

        saveHistoricalRecord: async function(companyId, empId, period, data) {
            try {
                await POST('/payroll/employees/' + empId + '/historical', {
                    period_key: period, ...data
                });
            } catch(e) {
                cacheSet('emp_historical_' + companyId + '_' + empId + '_' + period, data);
            }
        },

        removeHistoricalRecord: async function(companyId, empId, period) {
            try {
                await DELETE('/payroll/employees/' + empId + '/historical?period=' + period);
            } catch(e) {}
        },

        getHistoricalImportLog: async function(companyId) {
            try {
                const result = await GET('/payroll/employees/historical-log');
                return result.data || [];
            } catch(e) {
                return cacheGet('historical_import_log_' + companyId) || [];
            }
        },

        saveHistoricalImportLog: async function(companyId, log) {
            cacheSet('historical_import_log_' + companyId, log);
        },

        // === AUDIT LOG ===

        getAuditLog: async function(companyId) {
            try {
                const result = await GET('/audit?module=payroll&limit=200');
                return result.data || result.logs || [];
            } catch(e) {
                return cacheGet('audit_log_' + companyId) || [];
            }
        },

        saveAuditLog: function(companyId, log) {
            cacheSet('audit_log_' + companyId, log);
        },

        appendAuditLog: function(companyId, entry) {
            // Audit is auto-logged by backend middleware
            var log = cacheGet('audit_log_' + companyId) || [];
            log.push(entry);
            cacheSet('audit_log_' + companyId, log);
        },

        // === REPORT HISTORY ===

        getReportHistory: async function(companyId) {
            return cacheGet('report_history_' + companyId) || [];
        },

        saveReportHistory: async function(companyId, history) {
            cacheSet('report_history_' + companyId, history);
        },

        // === NARRATIVE ===

        getNarrative: async function(companyId, empId, period) {
            try {
                const result = await GET('/payroll/employees/' + empId + '/narrative?period=' + period);
                return result.data || null;
            } catch(e) {
                return cacheGet('narrative_' + companyId + '_' + empId + '_' + period);
            }
        },

        saveNarrative: async function(companyId, empId, period, narrative) {
            try {
                await POST('/payroll/employees/' + empId + '/narrative', {
                    period_key: period, narrative: narrative
                });
            } catch(e) {
                cacheSet('narrative_' + companyId + '_' + empId + '_' + period, narrative);
            }
        },

        removeNarrative: async function(companyId, empId, period) {
            try {
                await DELETE('/payroll/employees/' + empId + '/narrative?period=' + period);
            } catch(e) {}
        }
    };
})();
