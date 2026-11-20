/**
 * ==============================================================================
 * BugBash - Super Admin Login Controller
 * ==============================================================================
 * Handles root authentication for the Super Admin Control Center:
 * - POST /api/v1/super-admin/auth/login
 * - GET  /api/v1/super-admin/auth/me
 *
 * Security Policies:
 * - NEVER stores Super Admin tokens in localStorage (strictly sessionStorage).
 * - Enforces generic errors against email enumeration.
 * - Handles multi-factor challenges with seamless redirect to /super-admin/verify-otp.
 * - Enforces client-side validation and responsive loading feedback.
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    const elements = {
        form: document.getElementById('superAdminLoginForm'),
        emailInput: document.getElementById('superAdminEmail'),
        passwordInput: document.getElementById('superAdminPassword'),
        rememberCheckbox: document.getElementById('superAdminRememberMe'),
        submitBtn: document.getElementById('superAdminSubmitBtn'),
        togglePasswordBtn: document.getElementById('toggleSuperAdminPassword'),
        alertBanner: document.getElementById('superAdminLoginAlert'),
        alertContent: document.getElementById('superAdminAlertContent')
    };

    /**
     * Show Alert Feedback
     */
    function showAlert(message, type = 'error') {
        if (!elements.alertBanner || !elements.alertContent) return;

        elements.alertBanner.className = `sa-alert-banner ${type}`;
        elements.alertContent.textContent = message;
        elements.alertBanner.style.display = 'flex';
        elements.alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Clear Alert Feedback
     */
    function clearAlert() {
        if (!elements.alertBanner) return;
        elements.alertBanner.style.display = 'none';
        elements.alertBanner.className = 'sa-alert-banner';
    }

    /**
     * Show / Hide Password Handler
     */
    function setupPasswordToggle() {
        if (!elements.togglePasswordBtn || !elements.passwordInput) return;

        elements.togglePasswordBtn.addEventListener('click', () => {
            const isPassword = elements.passwordInput.type === 'password';
            elements.passwordInput.type = isPassword ? 'text' : 'password';

            elements.togglePasswordBtn.innerHTML = isPassword
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

            elements.togglePasswordBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
            elements.togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    }

    /**
     * Check If Super Admin is Already Authenticated
     */
    async function checkExistingSession() {
        // Enforce sessionStorage ONLY (Never localStorage for Super Admin)
        const token = sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) return;

        try {
            const resp = await fetch(`${API_BASE}/super-admin/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resp.ok) {
                const user = await resp.json();
                if (user.role === 'super_admin') {
                    window.location.href = '/super-admin/dashboard';
                }
            } else if (resp.status === 401 || resp.status === 403) {
                sessionStorage.removeItem('bugbash_super_admin_token');
                sessionStorage.removeItem('bugbash_super_admin_user');
            }
        } catch (err) {
            console.debug('Super Admin session check bypassed:', err);
        }
    }

    /**
     * Handle Super Admin Sign In
     */
    async function handleLogin(e) {
        e.preventDefault();
        clearAlert();

        const email = elements.emailInput.value.trim();
        const password = elements.passwordInput.value;
        const rememberMe = elements.rememberCheckbox ? elements.rememberCheckbox.checked : false;

        // Validations
        if (!email) {
            showAlert('Please enter your Super Administrator email address.', 'error');
            elements.emailInput.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAlert('Please provide a valid administrative email format.', 'error');
            elements.emailInput.focus();
            return;
        }

        if (!password) {
            showAlert('Please enter your account password.', 'error');
            elements.passwordInput.focus();
            return;
        }

        // Set Loading State
        const originalBtnHtml = elements.submitBtn.innerHTML;
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = `
            <svg class="sa-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            <span>Verifying Credentials...</span>
        `;

        try {
            const endpoint = (window.BugBashConfig && window.BugBashConfig.ENDPOINTS && window.BugBashConfig.ENDPOINTS.SUPER_ADMIN_AUTH_LOGIN)
                ? `${API_BASE}${window.BugBashConfig.ENDPOINTS.SUPER_ADMIN_AUTH_LOGIN}`
                : `${API_BASE}/super-admin/auth/login`;

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    remember_me: rememberMe
                })
            });

            const data = await resp.json().catch(() => ({}));

            if (resp.status === 200) {
                // Check if Multi-Factor Authentication is triggered
                if (data.require_otp) {
                    sessionStorage.setItem('bugbash_sa_temp_token', data.temp_token || '');
                    sessionStorage.setItem('bugbash_sa_masked_email', data.masked_email || '');
                    sessionStorage.setItem('bugbash_sa_email', email);
                    sessionStorage.setItem('bugbash_sa_remember', rememberMe ? '1' : '0');

                    elements.submitBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>MFA Required &bull; Redirecting...</span>
                    `;

                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/super-admin/verify-otp';
                    }, 350);
                    return;
                }

                // Direct Session Issuance (Strictly sessionStorage, NEVER localStorage)
                sessionStorage.setItem('bugbash_super_admin_token', data.access_token);
                sessionStorage.setItem('bugbash_super_admin_user', JSON.stringify(data.user));
                sessionStorage.setItem('bugbash_super_admin_role', data.user ? data.user.role : 'super_admin');

                elements.submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Authentication Successful &bull; Entering...</span>
                `;

                setTimeout(() => {
                    window.location.href = data.redirect_url || '/super-admin/dashboard';
                }, 400);

            } else if (resp.status === 401) {
                showAlert('Invalid administrative credentials. Access denied.', 'error');
                elements.passwordInput.value = '';
                elements.passwordInput.focus();
            } else if (resp.status === 403) {
                showAlert(data.detail || 'Access restricted: Only authorized Super Administrators may authenticate through this gateway.', 'warning');
            } else if (resp.status === 429) {
                showAlert(data.detail || 'Too many failed login attempts. Access temporarily rate-limited. Please wait 15 minutes before trying again.', 'warning');
            } else {
                showAlert(data.detail || 'Authentication failed. Please verify your credentials or contact platform operations.', 'error');
            }

        } catch (err) {
            console.error('Super Admin login error:', err);
            showAlert('Unable to reach authentication server. Please check network connection and try again.', 'error');
        } finally {
            if (elements.submitBtn.disabled && !elements.submitBtn.innerText.includes('Successful') && !elements.submitBtn.innerText.includes('MFA Required')) {
                elements.submitBtn.disabled = false;
                elements.submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }

    function init() {
        if (elements.form) {
            elements.form.addEventListener('submit', handleLogin);
        }
        setupPasswordToggle();
        checkExistingSession();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
