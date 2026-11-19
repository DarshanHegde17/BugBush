/**
 * BugBash Frontend Configuration
 * Prepares the application for backend integration with FastAPI.
 */
(function () {
    const config = {
        // Base API endpoint for backend FastAPI services
        API_BASE_URL: window.__BUGBASH_API_URL__ || (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin + '/api/v1' : 'http://localhost:8000/api/v1'),
        
        // Application Metadata
        APP_NAME: 'BugBash',
        VERSION: '2.0.0',
        ENVIRONMENT: 'development',
        
        // Timeout in milliseconds for API requests
        REQUEST_TIMEOUT: 15000,
        
        // Endpoints map
        ENDPOINTS: {
            AUTH_LOGIN: '/auth/login',
            AUTH_REGISTER: '/auth/register',
            AUTH_LOGOUT: '/auth/logout',
            AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
            AUTH_RESET_PASSWORD: '/auth/reset-password',
            AUTH_VERIFY_RESET_TOKEN: '/auth/verify-reset-token',
            AUTH_OAUTH_GOOGLE: '/auth/oauth/google',
            AUTH_VERIFY_EMAIL: '/auth/verify-email',
            AUTH_RESEND_OTP: '/auth/resend-otp',
            ORGANIZATION_REGISTER: '/organizations/register',
            COLLEGE_PORTAL: '/college',
            COMPANY_PORTAL: '/company',
            ASSESSMENTS: '/assessments',
            CODE_EXECUTE: '/execute',
            MONITORING: '/monitoring',
            HEALTH: '/health',
            USERS_ME: '/users/me',
            USERS_DASHBOARD: '/users/me/dashboard',
            USERS_ASSESSMENTS: '/users/me/assessments',
            USERS_RESULTS: '/users/me/results',
            USERS_ACTIVITY: '/users/me/activity',
            USERS_PROFILE: '/users/me/profile',
            USERS_CHANGE_PASSWORD: '/users/me/change-password',
            USERS_PREFERENCES: '/users/me/preferences',
            USERS_SESSIONS: '/users/me/sessions',
            USERS_LOGOUT_OTHER: '/users/me/logout-other-sessions',
            USERS_DELETE_ACCOUNT: '/users/me/account-deletion-request',
            USERS_DOWNLOAD_DATA: '/users/me/download-data',
            USERS_AVATAR: '/users/me/profile-picture',
            ADMIN_AUTH_LOGIN: '/admin/auth/login',
            ADMIN_AUTH_LOGOUT: '/admin/auth/logout',
            ADMIN_AUTH_ME: '/admin/auth/me',
            ADMIN_DASHBOARD_STATS: '/admin/dashboard/statistics',
            ADMIN_DASHBOARD_ANALYTICS: '/admin/dashboard/analytics',
            ADMIN_DASHBOARD_ACTIVITY: '/admin/dashboard/recent-activity',
            ADMIN_PERMISSIONS: '/admin/permissions',
            ADMIN_CHANGE_PASSWORD: '/admin/change-password',
            PRACTICE_PROBLEMS: '/practice/problems'
        },

        // Role-Based Dashboard Navigation Mapping
        // Supports: Super Admin, Organization Admin, College Admin, Company Admin, Student, Candidate
        DASHBOARD_ROUTES: {
            super_admin: 'super-admin-dashboard.html',
            organization_admin: 'organization-dashboard.html',
            college_admin: 'college-dashboard.html',
            company_admin: 'company-dashboard.html',
            student: '/user/dashboard',
            candidate: '/user/dashboard'
        },

        // OAuth Feature Flag
        OAUTH: {
            GOOGLE_ENABLED: false // Enabled when backend OAuth credentials and provider are mounted
        }
    };

    // Freeze configuration to prevent accidental modification
    window.BugBashConfig = Object.freeze(config);
})();
