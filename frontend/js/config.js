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
        
        // Endpoints map for future consumption
        ENDPOINTS: {
            AUTH_LOGIN: '/auth/login',
            AUTH_REGISTER: '/auth/register',
            AUTH_LOGOUT: '/auth/logout',
            COLLEGE_PORTAL: '/college',
            COMPANY_PORTAL: '/company',
            ASSESSMENTS: '/assessments',
            CODE_EXECUTE: '/execute',
            MONITORING: '/monitoring',
            HEALTH: '/health'
        }
    };

    // Freeze configuration to prevent accidental modification
    window.BugBashConfig = Object.freeze(config);
})();

