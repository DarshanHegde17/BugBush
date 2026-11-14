/**
 * BugBash - Forgot Password Controller
 * Manages email input validation, recovery request submission,
 * generic security response presentation, and resend cooldown timers.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const form = document.getElementById('forgotPasswordForm');
    const emailInput = document.getElementById('emailInput');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');
    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');
    
    // Success State Elements
    const formCardWrapper = document.getElementById('formCardWrapper');
    const successState = document.getElementById('successState');
    const submittedEmailEl = document.getElementById('submittedEmail');
    const resendCountdownEl = document.getElementById('resendCountdown');
    const btnResend = document.getElementById('btnResend');
    const devHelperBanner = document.getElementById('devHelperBanner');
    const devResetLink = document.getElementById('devResetLink');

    let countdownTimer = null;
    let secondsRemaining = 60;
    let lastSubmittedEmail = '';

    // Email Regex Pattern
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Clear alert when user types
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            hideAlert();
            emailInput.classList.remove('is-invalid');
        });
    }

    // Form Submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const email = emailInput.value.trim();

            // Client-side Validation
            if (!email) {
                showAlert('Please enter your registered email address.', 'error');
                emailInput.classList.add('is-invalid');
                emailInput.focus();
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                showAlert('Please enter a valid email address (e.g. name@company.com).', 'error');
                emailInput.classList.add('is-invalid');
                emailInput.focus();
                return;
            }

            await requestPasswordReset(email);
        });
    }

    // Resend Button Click
    if (btnResend) {
        btnResend.addEventListener('click', async () => {
            if (btnResend.disabled || !lastSubmittedEmail) return;
            await requestPasswordReset(lastSubmittedEmail, true);
        });
    }

    /**
     * Dispatches password recovery request to backend FastAPI API
     */
    async function requestPasswordReset(email, isResend = false) {
        setLoading(true);

        const baseUrl = window.BugBashConfig?.API_BASE_URL || (window.location.origin + '/api/v1');
        const endpoint = baseUrl + (window.BugBashConfig?.ENDPOINTS?.AUTH_FORGOT_PASSWORD || '/auth/forgot-password');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: email })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                lastSubmittedEmail = email;
                showSuccessView(email, data.dev_reset_url);
            } else if (response.status === 429) {
                showAlert(data.detail || 'Too many reset requests. Please wait a few minutes before trying again.', 'warning');
            } else if (response.status === 422) {
                showAlert(data.detail?.[0]?.msg || 'Please provide a valid email format.', 'error');
                emailInput.classList.add('is-invalid');
            } else {
                showAlert(data.detail || 'An unexpected error occurred. Please try again later.', 'error');
            }
        } catch (err) {
            console.error('[BugBash Auth Error]:', err);
            showAlert('Unable to reach the BugBash authentication server. Please check your network connection.', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Renders the generic success confirmation state with resend timer
     */
    function showSuccessView(email, devResetUrl) {
        if (formCardWrapper) formCardWrapper.style.display = 'none';
        if (successState) successState.style.display = 'block';

        if (submittedEmailEl) {
            // Display email
            submittedEmailEl.textContent = maskEmail(email);
        }

        // Show local dev helper banner if returned by dev server
        if (devResetUrl && devHelperBanner && devResetLink) {
            devHelperBanner.style.display = 'block';
            devResetLink.href = devResetUrl;
            devResetLink.textContent = window.location.origin + devResetUrl;
        }

        startResendTimer();
    }

    /**
     * Resend Countdown Timer (60s)
     */
    function startResendTimer() {
        if (countdownTimer) clearInterval(countdownTimer);
        secondsRemaining = 60;

        if (btnResend) {
            btnResend.disabled = true;
            btnResend.textContent = 'Resend Link';
        }
        if (resendCountdownEl) {
            resendCountdownEl.textContent = `(${secondsRemaining}s)`;
        }

        countdownTimer = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining <= 0) {
                clearInterval(countdownTimer);
                if (btnResend) btnResend.disabled = false;
                if (resendCountdownEl) resendCountdownEl.textContent = '';
            } else {
                if (resendCountdownEl) resendCountdownEl.textContent = `(${secondsRemaining}s)`;
            }
        }, 1000);
    }

    /**
     * Masks user email for display privacy (e.g. j***e@example.com)
     */
    function maskEmail(email) {
        const parts = email.split('@');
        if (parts.length !== 2) return email;
        const name = parts[0];
        const domain = parts[1];
        if (name.length <= 2) return `${name[0]}*@${domain}`;
        return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
    }

    /**
     * UI State Helpers
     */
    function setLoading(isLoading) {
        if (!btnSubmit) return;
        btnSubmit.disabled = isLoading;
        if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
        if (btnText) btnText.textContent = isLoading ? 'Sending Reset Link...' : 'Send Reset Link';
    }

    function showAlert(message, type = 'error') {
        if (!alertBox || !alertMessage) return;
        alertMessage.textContent = message;
        alertBox.className = `alert-box show ${type}`;
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAlert() {
        if (!alertBox) return;
        alertBox.className = 'alert-box';
    }
});

