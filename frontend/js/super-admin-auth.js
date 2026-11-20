/**
 * ==============================================================================
 * BugBash - Super Admin Authentication Workflows Controller
 * ==============================================================================
 * Powers:
 * - Forgot Password (/super-admin/forgot-password)
 * - OTP Verification (/super-admin/verify-otp)
 * - Reset Password (/super-admin/reset-password)
 *
 * Enforces:
 * - 6-digit OTP input auto-advance, backspace jump, paste parse
 * - 60s resend countdown with backend rate limiting
 * - OWASP password complexity validator & strength bar
 * - Strictly sessionStorage for tokens (NEVER localStorage)
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    // ==========================================================================
    // 1. FORGOT PASSWORD WORKFLOW
    // ==========================================================================
    function initForgotPassword() {
        const form = document.getElementById('superAdminForgotForm');
        if (!form) return;

        const emailInput = document.getElementById('superAdminRecoveryEmail');
        const submitBtn = document.getElementById('superAdminForgotSubmitBtn');
        const alertBanner = document.getElementById('superAdminRecoveryAlert');
        const alertContent = document.getElementById('superAdminRecoveryAlertContent');
        const successCard = document.getElementById('superAdminRecoverySuccess');
        const emailDisplay = document.getElementById('recoveryEmailDisplay');
        const devBanner = document.getElementById('superAdminDevBanner');
        const devResetText = document.getElementById('devResetText');
        const proceedBtn = document.getElementById('proceedToResetBtn');

        function showAlert(msg, type = 'error') {
            if (!alertBanner || !alertContent) return;
            alertBanner.className = `sa-alert-banner ${type}`;
            alertContent.textContent = msg;
            alertBanner.style.display = 'flex';
        }

        function clearAlert() {
            if (!alertBanner) return;
            alertBanner.style.display = 'none';
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();

            const email = emailInput.value.trim();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showAlert('Please provide a valid Super Administrator email address.', 'error');
                emailInput.focus();
                return;
            }

            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="sa-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                </svg>
                <span>Processing Request...</span>
            `;

            try {
                const endpoint = `${API_BASE}/super-admin/auth/forgot-password`;
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const data = await resp.json().catch(() => ({}));

                if (resp.ok) {
                    form.style.display = 'none';
                    successCard.style.display = 'flex';
                    if (emailDisplay) {
                        emailDisplay.textContent = data.masked_email || email;
                    }

                    if (data.temp_token) {
                        sessionStorage.setItem('bugbash_sa_reset_token', data.temp_token);
                    }

                    if (data.dev_reset_url && devBanner && devResetText) {
                        devBanner.style.display = 'block';
                        devResetText.innerHTML = `Direct Reset Link: <a href="${data.dev_reset_url}">${data.dev_reset_url}</a>`;
                        if (proceedBtn) {
                            proceedBtn.href = data.dev_reset_url;
                        }
                    } else if (data.temp_token && proceedBtn) {
                        proceedBtn.href = `/super-admin/reset-password?token=${data.temp_token}`;
                    }

                } else if (resp.status === 429) {
                    showAlert(data.detail || 'Too many reset requests. Please wait a few minutes before trying again.', 'warning');
                } else {
                    showAlert(data.detail || 'Unable to process recovery request at this time.', 'error');
                }
            } catch (err) {
                console.error('Forgot password error:', err);
                showAlert('Network error connecting to recovery server.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // ==========================================================================
    // 2. OTP VERIFICATION WORKFLOW
    // ==========================================================================
    function initOtpVerification() {
        const form = document.getElementById('superAdminOtpForm');
        if (!form) return;

        const inputs = Array.from(document.querySelectorAll('.sa-otp-input'));
        const submitBtn = document.getElementById('superAdminOtpSubmitBtn');
        const alertBanner = document.getElementById('superAdminOtpAlert');
        const alertContent = document.getElementById('superAdminOtpAlertContent');
        const maskedEmailEl = document.getElementById('superAdminMaskedEmail');
        const rememberDeviceCheckbox = document.getElementById('superAdminRememberDevice');
        const resendBtn = document.getElementById('superAdminResendOtpBtn');
        const countdownVal = document.getElementById('saCountdownVal');
        const resendTimerWrap = document.getElementById('superAdminResendTimerWrap');

        // Context tokens
        const urlParams = new URLSearchParams(window.location.search);
        const tempToken = urlParams.get('temp_token') || sessionStorage.getItem('bugbash_sa_temp_token') || '';
        const email = urlParams.get('email') || sessionStorage.getItem('bugbash_sa_email') || '';
        const maskedEmail = urlParams.get('masked_email') || sessionStorage.getItem('bugbash_sa_masked_email') || '';

        if (maskedEmailEl && (maskedEmail || email)) {
            maskedEmailEl.textContent = maskedEmail || (email.split('@')[0].slice(0, 2) + '***@' + email.split('@')[1]);
        }

        // Dev Helper Banner
        const devOtp = urlParams.get('dev_otp') || sessionStorage.getItem('bugbash_sa_dev_otp');
        const devBanner = document.getElementById('saDevOtpBanner');
        const devOtpCode = document.getElementById('saDevOtpCode');
        const autoFillBtn = document.getElementById('saAutoFillOtpBtn');
        if (devOtp && devBanner && devOtpCode) {
            devBanner.style.display = 'block';
            devOtpCode.textContent = devOtp;
            if (autoFillBtn) {
                autoFillBtn.onclick = () => {
                    const digits = String(devOtp).split('');
                    inputs.forEach((inp, idx) => {
                        inp.value = digits[idx] || '';
                        inp.classList.add('filled');
                    });
                    if (inputs[5]) inputs[5].focus();
                    form.dispatchEvent(new Event('submit'));
                };
            }
        }

        function showAlert(msg, type = 'error') {
            if (!alertBanner || !alertContent) return;
            alertBanner.className = `sa-alert-banner ${type}`;
            alertContent.textContent = msg;
            alertBanner.style.display = 'flex';
        }

        function clearAlert() {
            if (!alertBanner) return;
            alertBanner.style.display = 'none';
        }

        // Auto-focus first input
        if (inputs[0]) inputs[0].focus();

        // Input Navigation Handlers
        inputs.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                const val = input.value.replace(/[^0-9]/g, '');
                input.value = val ? val[0] : '';

                if (input.value) {
                    input.classList.add('filled');
                    input.classList.remove('is-invalid');
                    if (idx < inputs.length - 1) {
                        inputs[idx + 1].focus();
                    }
                } else {
                    input.classList.remove('filled');
                }

                // Auto-submit when all 6 filled
                const allFilled = inputs.every(inp => inp.value.length === 1);
                if (allFilled) {
                    form.dispatchEvent(new Event('submit'));
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace') {
                    if (!input.value && idx > 0) {
                        inputs[idx - 1].focus();
                        inputs[idx - 1].value = '';
                        inputs[idx - 1].classList.remove('filled');
                    } else {
                        input.value = '';
                        input.classList.remove('filled');
                    }
                } else if (e.key === 'ArrowLeft' && idx > 0) {
                    inputs[idx - 1].focus();
                } else if (e.key === 'ArrowRight' && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
                const cleanDigits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);
                if (!cleanDigits) return;

                cleanDigits.split('').forEach((char, i) => {
                    if (inputs[i]) {
                        inputs[i].value = char;
                        inputs[i].classList.add('filled');
                    }
                });

                const targetIdx = Math.min(cleanDigits.length, inputs.length - 1);
                inputs[targetIdx].focus();

                if (cleanDigits.length === 6) {
                    form.dispatchEvent(new Event('submit'));
                }
            });
        });

        // 60-Second Cooldown Countdown Timer
        let countdown = 60;
        let timerInterval = setInterval(() => {
            countdown -= 1;
            if (countdownVal) countdownVal.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(timerInterval);
                if (resendTimerWrap) resendTimerWrap.style.display = 'none';
                if (resendBtn) resendBtn.disabled = false;
            }
        }, 1000);

        // Resend Button Handler
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                if (resendBtn.disabled) return;
                resendBtn.disabled = true;
                clearAlert();

                try {
                    const resp = await fetch(`${API_BASE}/super-admin/auth/resend-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            temp_token: tempToken || undefined,
                            email: email || undefined
                        })
                    });

                    const data = await resp.json().catch(() => ({}));

                    if (resp.ok) {
                        showAlert('A new 6-digit verification code has been dispatched.', 'success');
                        if (data.dev_otp && devBanner && devOtpCode) {
                            devBanner.style.display = 'block';
                            devOtpCode.textContent = data.dev_otp;
                        }
                        // Reset countdown
                        countdown = 60;
                        if (resendTimerWrap) resendTimerWrap.style.display = 'inline';
                        if (countdownVal) countdownVal.textContent = '60';
                        timerInterval = setInterval(() => {
                            countdown -= 1;
                            if (countdownVal) countdownVal.textContent = countdown;
                            if (countdown <= 0) {
                                clearInterval(timerInterval);
                                if (resendTimerWrap) resendTimerWrap.style.display = 'none';
                                if (resendBtn) resendBtn.disabled = false;
                            }
                        }, 1000);
                    } else if (resp.status === 429) {
                        showAlert(data.detail || 'Please wait before requesting another code.', 'warning');
                        resendBtn.disabled = false;
                    } else {
                        showAlert(data.detail || 'Failed to resend verification code.', 'error');
                        resendBtn.disabled = false;
                    }
                } catch (err) {
                    showAlert('Network error communicating with authentication service.', 'error');
                    resendBtn.disabled = false;
                }
            });
        }

        // Form Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();

            const otp = inputs.map(i => i.value).join('');
            if (otp.length < 6) {
                showAlert('Please enter the full 6-digit verification code.', 'error');
                inputs.forEach(i => { if (!i.value) i.classList.add('is-invalid'); });
                return;
            }

            const rememberDevice = rememberDeviceCheckbox ? rememberDeviceCheckbox.checked : false;

            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="sa-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                </svg>
                <span>Verifying Cryptographic Code...</span>
            `;

            try {
                const resp = await fetch(`${API_BASE}/super-admin/auth/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        temp_token: tempToken || undefined,
                        email: email || undefined,
                        otp: otp,
                        remember_device: rememberDevice
                    })
                });

                const data = await resp.json().catch(() => ({}));

                if (resp.ok) {
                    // Store in sessionStorage (NEVER localStorage for Super Admin)
                    sessionStorage.setItem('bugbash_super_admin_token', data.access_token);
                    sessionStorage.setItem('bugbash_super_admin_user', JSON.stringify(data.user));
                    sessionStorage.setItem('bugbash_super_admin_role', 'super_admin');

                    // Clear transient challenge tokens
                    sessionStorage.removeItem('bugbash_sa_temp_token');
                    sessionStorage.removeItem('bugbash_sa_dev_otp');

                    submitBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Verified &bull; Redirecting...</span>
                    `;

                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/super-admin/dashboard';
                    }, 400);

                } else {
                    showAlert(data.detail || 'Invalid or expired verification code.', 'error');
                    inputs.forEach(inp => {
                        inp.value = '';
                        inp.classList.remove('filled');
                        inp.classList.add('is-invalid');
                    });
                    if (inputs[0]) inputs[0].focus();
                }
            } catch (err) {
                showAlert('Network error connecting to verification gateway.', 'error');
            } finally {
                if (submitBtn.disabled && !submitBtn.innerText.includes('Verified')) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }

    // ==========================================================================
    // 3. RESET PASSWORD WORKFLOW
    // ==========================================================================
    function initResetPassword() {
        const form = document.getElementById('superAdminResetForm');
        if (!form) return;

        const newPwInput = document.getElementById('superAdminNewPassword');
        const confirmPwInput = document.getElementById('superAdminConfirmPassword');
        const submitBtn = document.getElementById('superAdminResetSubmitBtn');
        const alertBanner = document.getElementById('superAdminResetAlert');
        const alertContent = document.getElementById('superAdminResetAlertContent');
        const successCard = document.getElementById('superAdminResetSuccess');
        const meterFill = document.getElementById('superAdminPwMeterFill');
        const strengthText = document.getElementById('superAdminPwStrengthText');
        const toggleNewPw = document.getElementById('toggleNewPasswordBtn');
        const toggleConfirmPw = document.getElementById('toggleConfirmPasswordBtn');

        // Checklist rules
        const rules = {
            length: document.getElementById('ruleLength'),
            upper: document.getElementById('ruleUpper'),
            lower: document.getElementById('ruleLower'),
            number: document.getElementById('ruleNumber'),
            special: document.getElementById('ruleSpecial')
        };

        // Token resolution
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('token') || sessionStorage.getItem('bugbash_sa_reset_token') || '';

        function showAlert(msg, type = 'error') {
            if (!alertBanner || !alertContent) return;
            alertBanner.className = `sa-alert-banner ${type}`;
            alertContent.textContent = msg;
            alertBanner.style.display = 'flex';
        }

        function clearAlert() {
            if (!alertBanner) return;
            alertBanner.style.display = 'none';
        }

        // Show/Hide Toggles
        function bindToggle(btn, input) {
            if (!btn || !input) return;
            btn.addEventListener('click', () => {
                const isPw = input.type === 'password';
                input.type = isPw ? 'text' : 'password';
                btn.innerHTML = isPw
                    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            });
        }
        bindToggle(toggleNewPw, newPwInput);
        bindToggle(toggleConfirmPw, confirmPwInput);

        // Real-Time Strength Meter & Checklist Validation
        function evaluatePassword(pw) {
            const checks = {
                length: pw.length >= 8,
                upper: /[A-Z]/.test(pw),
                lower: /[a-z]/.test(pw),
                number: /[0-9]/.test(pw),
                special: /[^A-Za-z0-9]/.test(pw)
            };

            // Update checklist items
            for (const [key, valid] of Object.entries(checks)) {
                if (rules[key]) {
                    if (valid) {
                        rules[key].classList.add('valid');
                        rules[key].querySelector('.status-icon').innerHTML = '&#10003;';
                    } else {
                        rules[key].classList.remove('valid');
                        rules[key].querySelector('.status-icon').innerHTML = '&bull;';
                    }
                }
            }

            const passedCount = Object.values(checks).filter(Boolean).length;
            if (!meterFill || !strengthText) return checks;

            if (passedCount === 0) {
                meterFill.className = 'sa-pw-meter-fill';
                strengthText.textContent = 'None';
            } else if (passedCount <= 2) {
                meterFill.className = 'sa-pw-meter-fill weak';
                strengthText.textContent = 'Weak';
            } else if (passedCount <= 4) {
                meterFill.className = 'sa-pw-meter-fill medium';
                strengthText.textContent = 'Medium';
            } else {
                meterFill.className = 'sa-pw-meter-fill strong';
                strengthText.textContent = 'Strong (NIST Compliant)';
            }

            return checks;
        }

        if (newPwInput) {
            newPwInput.addEventListener('input', () => {
                clearAlert();
                evaluatePassword(newPwInput.value);
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();

            if (!resetToken) {
                showAlert('Missing password reset token. Please request a new recovery link.', 'error');
                return;
            }

            const newPw = newPwInput.value;
            const confirmPw = confirmPwInput.value;

            if (newPw !== confirmPw) {
                showAlert('Passwords do not match. Please ensure both fields are identical.', 'error');
                confirmPwInput.focus();
                return;
            }

            const checks = evaluatePassword(newPw);
            const allPassed = Object.values(checks).every(Boolean);
            if (!allPassed) {
                showAlert('Password does not satisfy all complexity requirements.', 'error');
                newPwInput.focus();
                return;
            }

            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="sa-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                </svg>
                <span>Updating Password &amp; Revoking Sessions...</span>
            `;

            try {
                const resp = await fetch(`${API_BASE}/super-admin/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: resetToken,
                        new_password: newPw,
                        confirm_password: confirmPw
                    })
                });

                const data = await resp.json().catch(() => ({}));

                if (resp.ok) {
                    // Revoke local tokens
                    sessionStorage.removeItem('bugbash_super_admin_token');
                    sessionStorage.removeItem('bugbash_sa_reset_token');

                    form.style.display = 'none';
                    successCard.style.display = 'flex';
                } else {
                    showAlert(data.detail || 'Password reset failed. Token may be expired or invalid.', 'error');
                }
            } catch (err) {
                showAlert('Network error connecting to reset service.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Initialization dispatcher based on present DOM elements
    function init() {
        initForgotPassword();
        initOtpVerification();
        initResetPassword();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
