/**
 * BugBash Login Controller
 * Handles client-side validation, password toggling, remember-me persistence,
 * role-based post-login redirection, and robust FastAPI backend integration.
 */

document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initPasswordToggle();
    initRememberMe();
    initGoogleAuth();
    initForgotPasswordModal();
    checkExistingSession();
});

/**
 * 1. Form Submission & Validation
 */
function initLoginForm() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('submitBtn');

    if (!form) return;

    // Real-time input error clearing
    [emailInput, passwordInput].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            clearFieldError(input);
            hideAlert();
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Client-Side Validation
        const email = (emailInput.value || '').trim();
        const password = passwordInput.value || '';
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

        let hasError = false;

        if (!email) {
            setFieldError(emailInput, 'Email address is required.');
            hasError = true;
        } else if (!isValidEmail(email)) {
            setFieldError(emailInput, 'Please enter a valid email address.');
            hasError = true;
        }

        if (!password) {
            setFieldError(passwordInput, 'Password is required.');
            hasError = true;
        }

        if (hasError) return;

        // 2. Set Button Loading State
        setLoadingState(true);
        hideAlert();

        // 3. API Request Payload
        const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
        const loginEndpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.AUTH_LOGIN || '/auth/login'}`;

        const payload = {
            email: email,
            password: password,
            remember_me: rememberMe
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.BugBashConfig?.REQUEST_TIMEOUT || 15000);

            const response = await fetch(loginEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let data = {};
            try {
                data = await response.json();
            } catch (_) {
                // Non-JSON response
            }

            // 4. Handle HTTP Status Codes
            if (response.ok) {
                // Successful Authentication (200 OK)
                handleLoginSuccess(data, rememberMe, email);
            } else if (response.status === 401) {
                // Invalid Credentials
                const msg = data.detail || data.message || 'Invalid email or password. Please verify your credentials.';
                showAlert(msg, 'error');
                setFieldError(passwordInput, 'Incorrect password or account not found.');
                setLoadingState(false);
            } else if (response.status === 403) {
                // Account or Organization Restrictions
                handleForbiddenStatus(data);
                setLoadingState(false);
            } else if (response.status === 429) {
                // Rate Limiting
                const msg = data.detail || 'Too many failed login attempts. Please wait a few minutes before trying again.';
                showAlert(msg, 'warning');
                setLoadingState(false);
            } else if (response.status >= 500) {
                // Server-side Error
                showAlert('The authentication service encountered an internal error. Please try again shortly.', 'error');
                setLoadingState(false);
            } else {
                // Other Error Code
                const msg = data.detail || data.message || `Authentication failed (Status code: ${response.status}).`;
                showAlert(msg, 'error');
                setLoadingState(false);
            }

        } catch (error) {
            console.error('BugBash Login Network/Execution Error:', error);
            setLoadingState(false);

            if (error.name === 'AbortError') {
                showAlert('Login request timed out. Please check your internet connection or server status.', 'error');
            } else {
                showAlert(
                    `Unable to connect to BugBash authentication server at ${loginEndpoint}. Please verify that the backend is running (python run.py).`,
                    'error'
                );
            }
        }
    });
}

/**
 * 2. Handle Successful Authentication & Role Redirection
 */
function handleLoginSuccess(data, rememberMe, email) {
    const token = data.access_token || data.token;
    const user = data.user || {
        id: data.id,
        email: data.email || email,
        name: data.name,
        role: data.role,
        permissions: data.permissions || [],
        organization_type: data.organization_type
    };

    if (!token) {
        showAlert('Authentication succeeded but no authorization token was received. Please contact system administrator.', 'error');
        setLoadingState(false);
        return;
    }

    // Save token according to Remember Me preference
    if (rememberMe) {
        localStorage.setItem('bugbash_token', token);
        localStorage.setItem('bugbash_user', JSON.stringify(user));
        localStorage.setItem('bugbash_saved_email', email);
    } else {
        sessionStorage.setItem('bugbash_token', token);
        sessionStorage.setItem('bugbash_user', JSON.stringify(user));
        localStorage.removeItem('bugbash_saved_email');
    }

    // Determine target dashboard based on authoritative backend role
    const targetUrl = resolveDashboardUrl(user.role, user.organization_type);

    showAlert(`Authentication successful! Redirecting to ${formatRoleName(user.role)} portal...`, 'success');

    // Smooth redirect
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 700);
}

/**
 * 3. Role-Based Route Resolver
 * Super Admin → super-admin-dashboard.html
 * College Admin → college-dashboard.html
 * Company Admin → company-dashboard.html
 * Student → student-dashboard.html
 * Candidate → candidate-dashboard.html
 * Organization Admin → appropriate organization dashboard
 */
function resolveDashboardUrl(role, orgType) {
    const routes = window.BugBashConfig?.DASHBOARD_ROUTES || {};
    const normalizedRole = (role || '').toLowerCase().trim();

    switch (normalizedRole) {
        case 'super_admin':
        case 'superadmin':
        case 'admin':
            return routes.super_admin || 'super-admin-dashboard.html';

        case 'college_admin':
        case 'college':
            return routes.college_admin || 'college-dashboard.html';

        case 'company_admin':
        case 'company':
            return routes.company_admin || 'company-dashboard.html';

        case 'organization_admin':
        case 'org_admin':
            if (orgType === 'college') return routes.college_admin || 'college-dashboard.html';
            if (orgType === 'company') return routes.company_admin || 'company-dashboard.html';
            return routes.organization_admin || 'organization-dashboard.html';

        case 'student':
            return routes.student || '/user/dashboard';

        case 'candidate':
            return routes.candidate || '/user/dashboard';

        default:
            console.warn(`Unrecognized role '${role}'. Falling back to candidate dashboard.`);
            return routes.candidate || '/user/dashboard';
    }
}

/**
 * Format readable role display name
 */
function formatRoleName(role) {
    if (!role) return 'Your';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * 4. Handle 403 Forbidden scenarios
 */
function handleForbiddenStatus(data) {
    const detail = (data.detail || data.message || '').toLowerCase();
    const code = (data.code || '').toLowerCase();

    if (code === 'email_not_verified' || detail.includes('unverified') || detail.includes('verify email')) {
        showAlert('Your email address has not been verified yet. Please check your inbox for the activation link.', 'warning');
    } else if (code === 'org_inactive' || detail.includes('inactive')) {
        showAlert('Your organization account is inactive. Please contact your organization administrator or BugBash support.', 'error');
    } else if (code === 'org_pending' || detail.includes('pending approval') || detail.includes('pending')) {
        showAlert('Your organization account is pending administrative approval. You will receive an email once activated.', 'info');
    } else {
        showAlert(data.detail || data.message || 'Access forbidden: Your account does not have permission to sign in.', 'error');
    }
}

/**
 * 5. Password Visibility Toggle
 */
function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('loginPassword');

    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        const newType = isPassword ? 'text' : 'password';
        passwordInput.setAttribute('type', newType);

        toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        toggleBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');

        const eyeOpen = toggleBtn.querySelector('.icon-eye');
        const eyeOff = toggleBtn.querySelector('.icon-eye-off');

        if (eyeOpen && eyeOff) {
            eyeOpen.style.display = isPassword ? 'none' : 'block';
            eyeOff.style.display = isPassword ? 'block' : 'none';
        }
    });
}

/**
 * 6. Remember Me Pre-fill
 */
function initRememberMe() {
    const emailInput = document.getElementById('loginEmail');
    const rememberCheckbox = document.getElementById('rememberMe');
    const savedEmail = localStorage.getItem('bugbash_saved_email');

    if (savedEmail && emailInput && rememberCheckbox) {
        emailInput.value = savedEmail;
        rememberCheckbox.checked = true;
    }
}

/**
 * 7. Google OAuth Login Handler
 */
function initGoogleAuth() {
    const googleBtn = document.getElementById('googleLoginBtn');
    if (!googleBtn) return;

    googleBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const isGoogleEnabled = window.BugBashConfig?.OAUTH?.GOOGLE_ENABLED === true;

        if (!isGoogleEnabled) {
            showAlert('Google Single Sign-On is not configured on this server yet. Please log in with your email and password.', 'info');
            return;
        }

        const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
        const oauthEndpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.AUTH_OAUTH_GOOGLE || '/auth/oauth/google'}`;
        window.location.href = oauthEndpoint;
    });
}

/**
 * 8. Forgot Password Modal
 */
function initForgotPasswordModal() {
    const link = document.getElementById('forgotPasswordLink');
    const modal = document.getElementById('forgotPasswordModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    const form = document.getElementById('forgotPasswordForm');
    const modalAlert = document.getElementById('modalAlert');

    if (!link || !modal) return;

    function openModal() {
        modal.classList.add('open');
        const emailField = document.getElementById('forgotEmail');
        const currentEmail = document.getElementById('loginEmail')?.value || '';
        if (emailField && currentEmail) {
            emailField.value = currentEmail;
        }
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        if (modalAlert) {
            modalAlert.style.display = 'none';
            modalAlert.textContent = '';
        }
    }

    link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('forgotEmail');
            const submitBtn = form.querySelector('button[type="submit"]');
            const email = (emailInput?.value || '').trim();

            if (!email || !isValidEmail(email)) {
                if (modalAlert) {
                    modalAlert.style.display = 'block';
                    modalAlert.className = 'alert-box error show';
                    modalAlert.textContent = 'Please enter a valid email address.';
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }

            const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
            const endpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.AUTH_FORGOT_PASSWORD || '/auth/forgot-password'}`;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    if (modalAlert) {
                        modalAlert.style.display = 'block';
                        modalAlert.className = 'alert-box success show';
                        modalAlert.textContent = 'If an account matches this email, password reset instructions have been dispatched.';
                    }
                } else {
                    if (modalAlert) {
                        modalAlert.style.display = 'block';
                        modalAlert.className = 'alert-box info show';
                        modalAlert.textContent = 'Password reset instructions have been processed for your account.';
                    }
                }
            } catch (_) {
                if (modalAlert) {
                    modalAlert.style.display = 'block';
                    modalAlert.className = 'alert-box warning show';
                    modalAlert.textContent = 'Password reset service is currently unreachable. Please check backend connection.';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Reset Instructions';
                }
            }
        });
    }
}

/**
 * 9. Existing Session Verification
 */
function checkExistingSession() {
    const token = localStorage.getItem('bugbash_token') || sessionStorage.getItem('bugbash_token');
    const userStr = localStorage.getItem('bugbash_user') || sessionStorage.getItem('bugbash_user');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user && user.role) {
                const targetUrl = resolveDashboardUrl(user.role, user.organization_type);
                showAlert(
                    `You are already signed in as ${user.email} (${formatRoleName(user.role)}). <a href="${targetUrl}" style="color: inherit; text-decoration: underline; font-weight: 700;">Click here to go to your dashboard</a> or sign in with another account.`,
                    'info'
                );
            }
        } catch (_) {
            // Invalid session data
        }
    }
}

/**
 * 10. UI Helper Utilities
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function setFieldError(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    const parent = input.closest('.form-group');
    if (parent) {
        const errorEl = parent.querySelector('.field-error-msg');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
        }
    }
    input.focus();
}

function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    const parent = input.closest('.form-group');
    if (parent) {
        const errorEl = parent.querySelector('.field-error-msg');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }
    }
}

function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('loginAlert');
    if (!alertBox) return;

    alertBox.className = `alert-box ${type} show`;
    const content = alertBox.querySelector('.alert-content');
    if (content) {
        content.innerHTML = message;
    } else {
        alertBox.innerHTML = message;
    }
}

function hideAlert() {
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) {
        alertBox.classList.remove('show');
    }
}

function setLoadingState(isLoading) {
    const btn = document.getElementById('submitBtn');
    if (!btn) return;

    btn.disabled = isLoading;
    if (isLoading) {
        btn.classList.add('loading');
    } else {
        btn.classList.remove('loading');
    }
}

