/**
 * BugBash Frontend Configuration
 * Prepares the application for backend integration with FastAPI.
 */
(function () {
    const config = {
        // Base API endpoint for backend FastAPI services
        API_BASE_URL: window.__BUGBASH_API_URL__ || 'http://localhost:8000/api/v1',
        
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
            AUTH_OAUTH_GOOGLE: '/auth/oauth/google',
            ORGANIZATION_REGISTER: '/organizations/register',
            ORGANIZATION_VERIFY_OTP: '/organizations/verify-otp',
            COLLEGE_PORTAL: '/college',
            COMPANY_PORTAL: '/company',
            ASSESSMENTS: '/assessments',
            CODE_EXECUTE: '/execute',
            MONITORING: '/monitoring',
            HEALTH: '/health'
        },

        // Role-Based Dashboard Navigation Mapping
        // Supports: Super Admin, Organization Admin, College Admin, Company Admin, Student, Candidate
        DASHBOARD_ROUTES: {
            super_admin: 'super-admin-dashboard.html',
            organization_admin: 'organization-dashboard.html',
            college_admin: 'college-dashboard.html',
            company_admin: 'company-dashboard.html',
            student: 'student-dashboard.html',
            candidate: 'candidate-dashboard.html'
        },

        // OAuth Feature Flag
        OAUTH: {
            GOOGLE_ENABLED: false // Enabled when backend OAuth credentials and provider are mounted
        }
    };

    // Freeze configuration to prevent accidental modification
    window.BugBashConfig = Object.freeze(config);
})();
