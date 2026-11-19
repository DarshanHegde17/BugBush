/**
 * ==============================================================================
 * BugBash - Enterprise Admin Login Controller
 * ==============================================================================
 * Handles authentication for the dedicated Admin Portal:
 * - POST /api/v1/admin/auth/login
 * - GET  /api/v1/admin/auth/me
 * Enforces role verification, client-side input validation, rate limit handling,
 * secure token storage, and redirection to /admin/dashboard.
 */

(function () {
    'use strict';

    // Base API URL configuration
    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    // DOM Elements
    const elements = {
        form: document.getElementById('adminLoginForm'),
        emailInput: document.getElementById('adminEmail'),
        passwordInput: document.getElementById('adminPassword'),
        rememberCheckbox: document.getElementById('adminRememberMe'),
        submitBtn: document.getElementById('adminSubmitBtn'),
        togglePasswordBtn: document.getElementById('toggleAdminPassword'),
        alertBanner: document.getElementById('adminLoginAlert'),
        alertContent: document.getElementById('adminAlertContent'),
        forgotPasswordBtn: document.getElementById('adminForgotPasswordBtn'),
        recoveryModal: document.getElementById('adminRecoveryModal'),
        closeRecoveryBtn: document.getElementById('closeRecoveryModalBtn'),
        ackRecoveryBtn: document.getElementById('ackRecoveryModalBtn')
    };

    /**
     * Show Alert Message in Alert Banner
     */
    function showAlert(message, type = 'error') {
        if (!elements.alertBanner || !elements.alertContent) return;

        elements.alertBanner.className = `admin-alert-banner ${type}`;
        elements.alertContent.textContent = message;
        elements.alertBanner.style.display = 'flex';

        // Auto-scroll into view if needed
        elements.alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Clear Alert Message
     */
    function clearAlert() {
        if (!elements.alertBanner) return;
        elements.alertBanner.style.display = 'none';
        elements.alertBanner.className = 'admin-alert-banner';
    }

    /**
     * Show / Hide Password Toggle
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
     * Admin Password Recovery Modal
     */
    function setupRecoveryModal() {
        if (!elements.forgotPasswordBtn || !elements.recoveryModal) return;

        function openModal(e) {
            if (e) e.preventDefault();
            elements.recoveryModal.classList.add('open');
        }

        function closeModal() {
            elements.recoveryModal.classList.remove('open');
        }

        elements.forgotPasswordBtn.addEventListener('click', openModal);
        if (elements.closeRecoveryBtn) elements.closeRecoveryBtn.addEventListener('click', closeModal);
        if (elements.ackRecoveryBtn) elements.ackRecoveryBtn.addEventListener('click', closeModal);

        elements.recoveryModal.addEventListener('click', (e) => {
            if (e.target === elements.recoveryModal) {
                closeModal();
            }
        });
    }

    /**
     * Check If Administrator is Already Authenticated
     */
    async function checkExistingSession() {
        const token = localStorage.getItem('bugbash_admin_token') || sessionStorage.getItem('bugbash_admin_token');
        if (!token) return;

        try {
            const resp = await fetch(`${API_BASE}/admin/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resp.ok) {
                // Already authenticated as admin, redirect to admin dashboard
                window.location.href = '/admin/dashboard';
            } else if (resp.status === 401 || resp.status === 403) {
                // Clear invalid token
                localStorage.removeItem('bugbash_admin_token');
                sessionStorage.removeItem('bugbash_admin_token');
            }
        } catch (err) {
            // Network failure or offline, leave on login page
            console.debug('Session check bypassed:', err);
        }
    }

    /**
     * Handle Admin Form Submission
     */
    async function handleLogin(e) {
        e.preventDefault();
        clearAlert();

        const email = elements.emailInput.value.trim();
        const password = elements.passwordInput.value;
        const rememberMe = elements.rememberCheckbox ? elements.rememberCheckbox.checked : false;

        // Basic Client Validations
        if (!email) {
            showAlert('Please enter your administrator email address.', 'error');
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

        // Set Loading UI State
        const originalBtnHtml = elements.submitBtn.innerHTML;
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = `
            <svg class="admin-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            <span>Verifying Credentials...</span>
        `;

        try {
            const resp = await fetch(`${API_BASE}/admin/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    remember_me: rememberMe
                })
            });

            const data = await resp.json();

            if (resp.status === 200) {
                // Store Admin Token securely in appropriate storage
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('bugbash_admin_token', data.access_token);
                storage.setItem('bugbash_admin_user', JSON.stringify(data.user));
                storage.setItem('bugbash_admin_role', data.user.role);

                // Show success state briefly before redirection
                elements.submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Authentication Successful &bull; Redirecting...</span>
                `;

                const targetUrl = data.redirect_url || '/admin/dashboard';
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 400);

            } else if (resp.status === 401) {
                showAlert('Invalid credentials. Please verify your administrator email and password.', 'error');
                elements.passwordInput.value = '';
                elements.passwordInput.focus();
            } else if (resp.status === 403) {
                // Role restriction or inactive/suspended account
                showAlert(data.detail || 'Access restricted: You do not possess administrative permissions.', 'warning');
            } else if (resp.status === 429) {
                // Rate limited
                showAlert(data.detail || 'Too many failed login attempts. Access temporarily rate-limited. Please wait 15 minutes before trying again.', 'warning');
            } else {
                showAlert(data.detail || 'Authentication failed. Please verify your credentials or contact Super Admin.', 'error');
            }

        } catch (err) {
            console.error('Admin login network error:', err);
            showAlert('Unable to reach the authentication server. Please check your internet connection and try again.', 'error');
        } finally {
            if (elements.submitBtn.disabled && elements.submitBtn.innerText !== 'Authentication Successful • Redirecting...') {
                elements.submitBtn.disabled = false;
                elements.submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }

    /**
     * Initialize Admin Login
     */
    function init() {
        if (elements.form) {
            elements.form.addEventListener('submit', handleLogin);
        }

        setupPasswordToggle();
        setupRecoveryModal();
        checkExistingSession();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
