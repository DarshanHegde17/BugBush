/**
 * BugBash Admin - Accept Invitation & Establish Credentials Controller
 * Validates cryptographic invitation token, checks OTP, evaluates password strength,
 * and activates administrator account.
 */

(function () {
    'use strict';

    let token = '';
    let invitationDetails = null;

    const elements = {
        cardLoading: document.getElementById('invCardLoading'),
        cardForm: document.getElementById('invCardForm'),
        cardError: document.getElementById('invCardError'),
        cardSuccess: document.getElementById('invCardSuccess'),
        errorMessage: document.getElementById('invErrorMessage'),
        recipientName: document.getElementById('invRecipientName'),
        recipientEmail: document.getElementById('invRecipientEmail'),
        recipientRole: document.getElementById('invRecipientRole'),
        recipientOrg: document.getElementById('invRecipientOrg'),
        form: document.getElementById('acceptInvitationForm'),
        otpInput: document.getElementById('invOtpInput'),
        passwordInput: document.getElementById('invPasswordInput'),
        confirmPasswordInput: document.getElementById('invConfirmPasswordInput'),
        submitBtn: document.getElementById('invSubmitBtn'),
        alertBox: document.getElementById('invAlertBox'),
        strengthBar: document.getElementById('invStrengthBar'),
        ruleLength: document.getElementById('ruleLength'),
        ruleUpper: document.getElementById('ruleUpper'),
        ruleLower: document.getElementById('ruleLower'),
        ruleNumber: document.getElementById('ruleNumber')
    };

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        token = urlParams.get('token');

        if (!token) {
            showErrorState('Missing invitation token. Please check the link provided in your email.');
            return;
        }

        bindEvents();
        validateToken();
    }

    function bindEvents() {
        if (elements.passwordInput) {
            elements.passwordInput.addEventListener('input', updatePasswordStrength);
        }

        if (elements.form) {
            elements.form.addEventListener('submit', handleFormSubmit);
        }
    }

    async function validateToken() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.ADMIN_AUTH_INVITATION) || '/admin/auth/invitation';

            const res = await fetch(`${apiBase}${endpoint}?token=${encodeURIComponent(token)}`, {
                method: 'GET'
            });

            const data = await res.json();

            if (!res.ok) {
                showErrorState(data.detail || 'This invitation is invalid or has expired.');
                return;
            }

            invitationDetails = data;
            showFormState(data);
        } catch (err) {
            console.error('Validate token error:', err);
            showErrorState('Network error validating invitation. Please check your internet connection.');
        }
    }

    function showFormState(data) {
        if (elements.cardLoading) elements.cardLoading.style.display = 'none';
        if (elements.cardError) elements.cardError.style.display = 'none';
        if (elements.cardSuccess) elements.cardSuccess.style.display = 'none';
        if (elements.cardForm) elements.cardForm.style.display = 'block';

        if (elements.recipientName) elements.recipientName.textContent = data.name;
        if (elements.recipientEmail) elements.recipientEmail.textContent = data.email;
        if (elements.recipientRole) elements.recipientRole.textContent = (data.role || 'Admin').toUpperCase();
        if (elements.recipientOrg) elements.recipientOrg.textContent = data.organization_name || 'BugBash Operations';
    }

    function showErrorState(msg) {
        if (elements.cardLoading) elements.cardLoading.style.display = 'none';
        if (elements.cardForm) elements.cardForm.style.display = 'none';
        if (elements.cardSuccess) elements.cardSuccess.style.display = 'none';
        if (elements.cardError) elements.cardError.style.display = 'block';
        if (elements.errorMessage) elements.errorMessage.textContent = msg;
    }

    function showSuccessState(msg) {
        if (elements.cardLoading) elements.cardLoading.style.display = 'none';
        if (elements.cardForm) elements.cardForm.style.display = 'none';
        if (elements.cardError) elements.cardError.style.display = 'none';
        if (elements.cardSuccess) elements.cardSuccess.style.display = 'block';

        let seconds = 3;
        const countdownEl = document.getElementById('redirectCountdown');
        const interval = setInterval(() => {
            seconds--;
            if (countdownEl) countdownEl.textContent = String(seconds);
            if (seconds <= 0) {
                clearInterval(interval);
                window.location.href = '/admin/login';
            }
        }, 1000);
    }

    function updatePasswordStrength() {
        const val = elements.passwordInput.value;
        const hasLength = val.length >= 8;
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);
        const hasNumber = /[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val);

        toggleRule(elements.ruleLength, hasLength);
        toggleRule(elements.ruleUpper, hasUpper);
        toggleRule(elements.ruleLower, hasLower);
        toggleRule(elements.ruleNumber, hasNumber);

        const score = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
        if (!elements.strengthBar) return;

        elements.strengthBar.className = 'inv-strength-bar';
        if (score === 1) {
            elements.strengthBar.classList.add('weak');
        } else if (score === 2) {
            elements.strengthBar.classList.add('fair');
        } else if (score === 3) {
            elements.strengthBar.classList.add('good');
        } else if (score === 4) {
            elements.strengthBar.classList.add('strong');
        }
    }

    function toggleRule(el, valid) {
        if (!el) return;
        if (valid) {
            el.classList.add('valid');
            el.innerHTML = `&#10003; ${el.textContent.replace(/^[\u2022\u2713]\s*/, '')}`;
        } else {
            el.classList.remove('valid');
            el.innerHTML = `&bull; ${el.textContent.replace(/^[\u2022\u2713]\s*/, '')}`;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        hideAlert();

        const otp = elements.otpInput.value.trim();
        const password = elements.passwordInput.value;
        const confirmPassword = elements.confirmPasswordInput.value;

        if (!otp || otp.length !== 6) {
            showAlert('Please enter the 6-digit verification code from your invitation.');
            return;
        }

        if (password.length < 8) {
            showAlert('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            showAlert('Passwords do not match. Please verify.');
            return;
        }

        try {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Activating Account...';

            const payload = {
                token,
                otp,
                password,
                confirm_password: confirmPassword
            };

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.ADMIN_AUTH_ACTIVATE) || '/admin/auth/activate';

            const res = await fetch(apiBase + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Activation failed');
            }

            showSuccessState(data.message);
        } catch (err) {
            console.error('Activation error:', err);
            showAlert(err.message || 'Error activating administrator account.');
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Activate & Sign In';
        }
    }

    function showAlert(msg) {
        if (!elements.alertBox) return;
        elements.alertBox.textContent = msg;
        elements.alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (!elements.alertBox) return;
        elements.alertBox.style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', init);
})();
