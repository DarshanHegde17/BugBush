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
            ADMIN_AUTH_INVITATION: '/admin/auth/invitation',
            ADMIN_AUTH_ACTIVATE: '/admin/auth/activate',
            ADMIN_DASHBOARD_STATS: '/admin/dashboard/statistics',
            ADMIN_DASHBOARD_ANALYTICS: '/admin/dashboard/analytics',
            ADMIN_DASHBOARD_ACTIVITY: '/admin/dashboard/recent-activity',
            ADMIN_PERMISSIONS: '/admin/permissions',
            ADMIN_CHANGE_PASSWORD: '/admin/change-password',
            ADMIN_ASSESSMENTS: '/admin/assessments',
            ADMIN_ASSESSMENT_QUESTIONS_CATALOG: '/admin/assessments/questions/catalog',
            ADMIN_CANDIDATES: '/admin/candidates',
            ADMIN_CANDIDATE_GROUPS: '/admin/candidate-groups',
            ADMIN_CANDIDATES_IMPORT: '/admin/candidates/import',
            ADMIN_CANDIDATES_INVITATIONS: '/admin/candidates/invitations',
            ADMIN_SUBMISSIONS: '/admin/submissions',
            ADMIN_SUBMISSIONS_STATS: '/admin/submissions/statistics',
            ADMIN_RESULTS: '/admin/results',
            ADMIN_RESULTS_STATS: '/admin/results/statistics',
            ADMIN_RESULTS_EXPORT: '/admin/results/export',
            ADMIN_ML_STATS: '/admin/ml-insights/statistics',
            ADMIN_ML_PIPELINE: '/admin/ml-insights/pipeline',
            ADMIN_ML_ANALYSES: '/admin/ml-insights/analyses',
            ADMIN_ML_ALGORITHMS: '/admin/ml-insights/algorithms',
            ADMIN_ML_COMPLEXITY: '/admin/ml-insights/complexity',
            ADMIN_ML_OPTIMIZATION: '/admin/ml-insights/optimization',
            ADMIN_ML_FEEDBACK: '/admin/ml-insights/feedback',
            ADMIN_ML_MODELS: '/admin/ml-insights/models',
            ADMIN_ML_MODELS_PERF: '/admin/ml-insights/models/performance',
            ADMIN_NOTIFICATIONS: '/admin/notifications',
            ADMIN_NOTIFICATIONS_STATS: '/admin/notifications/statistics',
            ADMIN_NOTIFICATION_TEMPLATES: '/admin/notification-templates',
            ADMIN_PROFILE: '/admin/profile',
            ADMIN_PROFILE_PHOTO: '/admin/profile/photo',
            ADMIN_PROFILE_CHANGE_PASSWORD: '/admin/profile/change-password',
            ADMIN_SECURITY_SESSIONS: '/admin/security/sessions',
            ADMIN_SECURITY_LOGOUT_OTHER: '/admin/security/logout-other-sessions',
            ADMIN_SECURITY_ACTIVITY: '/admin/security/activity',
            ADMIN_PREFERENCES: '/admin/preferences',
            ADMIN_NOTIFICATION_PREFERENCES: '/admin/notification-preferences',
            SUPER_ADMIN_AUTH_LOGIN: '/super-admin/auth/login',
            SUPER_ADMIN_AUTH_VERIFY_OTP: '/super-admin/auth/verify-otp',
            SUPER_ADMIN_AUTH_RESEND_OTP: '/super-admin/auth/resend-otp',
            SUPER_ADMIN_AUTH_FORGOT_PASSWORD: '/super-admin/auth/forgot-password',
            SUPER_ADMIN_AUTH_RESET_PASSWORD: '/super-admin/auth/reset-password',
            SUPER_ADMIN_AUTH_ME: '/super-admin/auth/me',
            SUPER_ADMIN_AUTH_LOGOUT: '/super-admin/auth/logout',
            SUPER_ADMIN_DASHBOARD_STATS: '/super-admin/dashboard/statistics',
            SUPER_ADMIN_DASHBOARD_ANALYTICS: '/super-admin/dashboard/analytics',
            SUPER_ADMIN_DASHBOARD_USER_ANALYTICS: '/super-admin/dashboard/user-analytics',
            SUPER_ADMIN_DASHBOARD_ASSESSMENT_ANALYTICS: '/super-admin/dashboard/assessment-analytics',
            SUPER_ADMIN_DASHBOARD_SUBMISSION_ANALYTICS: '/super-admin/dashboard/submission-analytics',
            SUPER_ADMIN_DASHBOARD_ML_ANALYTICS: '/super-admin/dashboard/ml-analytics',
            SUPER_ADMIN_PLATFORM_HEALTH: '/super-admin/platform/health',
            SUPER_ADMIN_PLATFORM_ACTIVITY: '/super-admin/platform/activity',
            SUPER_ADMIN_ADMINS: '/super-admin/admins',
            SUPER_ADMIN_ADMINS_INVITE: '/super-admin/admins/invite',
            PRACTICE_PROBLEMS: '/practice/problems'
        },

        // Role-Based Dashboard Navigation Mapping
        // Supports: Super Admin, Organization Admin, College Admin, Company Admin, Student, Candidate
        DASHBOARD_ROUTES: {
            super_admin: '/super-admin/dashboard',
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
