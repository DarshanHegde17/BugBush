/**
 * BugBash - Reset Password Controller
 * Enforces cryptographic token validation, live password entropy verification,
 * confirm password matching, show/hide toggles, and secure credential submission.
 */
document.addEventListener('DOMContentLoaded', () => {
    // URL Token Extraction
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || '';

    // State Containers
    const verifyingState = document.getElementById('tokenVerifyingState');
    const invalidState = document.getElementById('invalidTokenState');
    const invalidReasonEl = document.getElementById('invalidTokenReason');
    const formCard = document.getElementById('resetFormCard');
    const successState = document.getElementById('resetSuccessState');
    const redirectCountdownEl = document.getElementById('redirectCountdown');

    // Form & Controls
    const form = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const btnToggleNew = document.getElementById('btnToggleNew');
    const btnToggleConfirm = document.getElementById('btnToggleConfirm');
    const btnReset = document.getElementById('btnReset');
    const btnResetSpinner = document.getElementById('btnResetSpinner');
    const btnResetText = document.getElementById('btnResetText');
    const alertBox = document.getElementById('resetAlertBox');
    const alertMessage = document.getElementById('resetAlertMessage');

    // Entropy & Validation UI
    const entropyFill = document.getElementById('entropyFill');
    const entropyVerdict = document.getElementById('entropyVerdict');
    const critLength = document.getElementById('critLength');
    const critUpper = document.getElementById('critUpper');
    const critLower = document.getElementById('critLower');
    const critNumber = document.getElementById('critNumber');
    const critSpecial = document.getElementById('critSpecial');
    const matchStatusBar = document.getElementById('matchStatusBar');

    // API Config
    const baseUrl = window.BugBashConfig?.API_BASE_URL || (window.location.origin + '/api/v1');

    // Initial Token Inspection
    if (!token) {
        showInvalidTokenView('No password reset token was provided in the URL. Please use the complete link sent to your email.');
        return;
    }

    // Verify token with backend
    verifyTokenWithBackend(token);

    // Setup Password Visibility Toggles
    if (btnToggleNew && newPasswordInput) {
        btnToggleNew.addEventListener('click', () => togglePasswordVisibility(newPasswordInput, btnToggleNew));
    }
    if (btnToggleConfirm && confirmPasswordInput) {
        btnToggleConfirm.addEventListener('click', () => togglePasswordVisibility(confirmPasswordInput, btnToggleConfirm));
    }

    // Live Password Strength & Criteria Checking
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            hideAlert();
            evaluateEntropy(newPasswordInput.value);
            checkPasswordMatch();
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            hideAlert();
            checkPasswordMatch();
        });
    }

    // Form Submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // 1. Complexity Verification
            const entropyResult = evaluateEntropy(newPassword);
            if (!entropyResult.isFullyValid) {
                showAlert('Please fulfill all password requirements before proceeding.', 'error');
                newPasswordInput.focus();
                return;
            }

            // 2. Matching Verification
            if (newPassword !== confirmPassword) {
                showAlert('Passwords do not match. Please ensure both fields are identical.', 'error');
                confirmPasswordInput.focus();
                return;
            }

            // 3. Dispatch to API
            await submitPasswordReset(token, newPassword);
        });
    }

    /**
     * Verifies reset token against backend API
     */
    async function verifyTokenWithBackend(resetToken) {
        const endpoint = `${baseUrl}/auth/verify-reset-token?token=${encodeURIComponent(resetToken)}`;

        try {
            const resp = await fetch(endpoint, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            const data = await resp.json().catch(() => ({}));

            if (resp.ok && data.valid) {
                // Token is good: show reset form
                if (verifyingState) verifyingState.style.display = 'none';
                if (formCard) formCard.style.display = 'block';
                if (newPasswordInput) newPasswordInput.focus();
            } else {
                const reason = data.reason || 'This reset link has expired or has already been used.';
                showInvalidTokenView(reason);
            }
        } catch (err) {
            console.error('[BugBash Token Verify Error]:', err);
            // In case of temporary network issue, still allow user to attempt submission if offline
            if (verifyingState) verifyingState.style.display = 'none';
            if (formCard) formCard.style.display = 'block';
        }
    }

    /**
     * Submits updated credentials to backend API
     */
    async function submitPasswordReset(resetToken, newPassword) {
        setLoading(true);
        const endpoint = `${baseUrl}/auth/reset-password`;

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    token: resetToken,
                    new_password: newPassword
                })
            });

            const data = await resp.json().catch(() => ({}));

            if (resp.ok) {
                showSuccessView();
            } else if (resp.status === 400) {
                // Token expired / already used
                showAlert(data.detail || 'This reset link is invalid or has expired. Please request a new one.', 'error');
                setTimeout(() => {
                    showInvalidTokenView(data.detail || 'This reset link is invalid or has expired.');
                }, 2000);
            } else if (resp.status === 422) {
                showAlert(data.detail || 'Password does not meet complexity requirements.', 'error');
            } else {
                showAlert(data.detail || 'An unexpected error occurred. Please try again.', 'error');
            }
        } catch (err) {
            console.error('[BugBash Password Reset Error]:', err);
            showAlert('Unable to connect to authentication server. Please check your network and try again.', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Real-time Password Entropy and Criteria Evaluation
     */
    function evaluateEntropy(password) {
        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        updateCriteriaItem(critLength, hasLength);
        updateCriteriaItem(critUpper, hasUpper);
        updateCriteriaItem(critLower, hasLower);
        updateCriteriaItem(critNumber, hasNumber);
        updateCriteriaItem(critSpecial, hasSpecial);

        const score = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
        const isFullyValid = score === 5;

        if (password.length === 0) {
            entropyFill.className = 'entropy-fill';
            entropyFill.style.width = '0%';
            entropyVerdict.textContent = '';
            entropyVerdict.className = 'entropy-verdict';
            return { score: 0, isFullyValid: false };
        }

        if (score <= 2) {
            entropyFill.className = 'entropy-fill weak';
            entropyVerdict.textContent = 'Weak';
            entropyVerdict.className = 'entropy-verdict weak';
        } else if (score === 3) {
            entropyFill.className = 'entropy-fill fair';
            entropyVerdict.textContent = 'Fair';
            entropyVerdict.className = 'entropy-verdict fair';
        } else if (score === 4) {
            entropyFill.className = 'entropy-fill good';
            entropyVerdict.textContent = 'Good';
            entropyVerdict.className = 'entropy-verdict good';
        } else {
            entropyFill.className = 'entropy-fill strong';
            entropyVerdict.textContent = 'Strong';
            entropyVerdict.className = 'entropy-verdict strong';
        }

        return { score, isFullyValid };
    }

    function updateCriteriaItem(element, isValid) {
        if (!element) return;
        if (isValid) {
            element.classList.add('valid');
        } else {
            element.classList.remove('valid');
        }
    }

    /**
     * Checks if passwords match and updates UI indicator
     */
    function checkPasswordMatch() {
        if (!confirmPasswordInput || !matchStatusBar) return;

        const p1 = newPasswordInput.value;
        const p2 = confirmPasswordInput.value;

        if (!p2) {
            matchStatusBar.className = 'match-status-bar';
            matchStatusBar.innerHTML = '';
            return;
        }

        if (p1 === p2) {
            matchStatusBar.className = 'match-status-bar matched';
            matchStatusBar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Passwords match</span>
            `;
        } else {
            matchStatusBar.className = 'match-status-bar mismatched';
            matchStatusBar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Passwords do not match</span>
            `;
        }
    }

    /**
     * Show / Hide Password Helper
     */
    function togglePasswordVisibility(input, btn) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        btn.innerHTML = isPassword ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        ` : `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }

    /**
     * UI State Transitions
     */
    function showInvalidTokenView(reason) {
        if (verifyingState) verifyingState.style.display = 'none';
        if (formCard) formCard.style.display = 'none';
        if (successState) successState.style.display = 'none';
        if (invalidState) {
            invalidState.style.display = 'block';
            if (invalidReasonEl && reason) invalidReasonEl.textContent = reason;
        }
    }

    function showSuccessView() {
        if (formCard) formCard.style.display = 'none';
        if (invalidState) invalidState.style.display = 'none';
        if (successState) successState.style.display = 'block';

        let count = 5;
        if (redirectCountdownEl) redirectCountdownEl.textContent = count;

        const timer = setInterval(() => {
            count--;
            if (redirectCountdownEl) redirectCountdownEl.textContent = count;
            if (count <= 0) {
                clearInterval(timer);
                window.location.href = 'login.html';
            }
        }, 1000);
    }

    function setLoading(isLoading) {
        if (!btnReset) return;
        btnReset.disabled = isLoading;
        if (btnResetSpinner) btnResetSpinner.style.display = isLoading ? 'inline-block' : 'none';
        if (btnResetText) btnResetText.textContent = isLoading ? 'Resetting Password...' : 'Reset Password';
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

