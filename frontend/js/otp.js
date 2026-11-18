/**
 * BugBash Email OTP Verification Controller
 * Handles 6-digit inputs, auto-advance, backspace navigation, paste parsing,
 * countdown timers, resend backoff, and workflow state transitions (A-F).
 */

document.addEventListener('DOMContentLoaded', () => {
    initOtpVerification();
});

function initOtpVerification() {
    // 1. Context & Email Setup
    const urlParams = new URLSearchParams(window.location.search);
    const rawEmail = urlParams.get('email') || sessionStorage.getItem('bugbash_verification_email') || 'admin@institution.edu';
    const verificationToken = urlParams.get('context') || urlParams.get('token') || sessionStorage.getItem('bugbash_verification_token') || 'tok_pending';
    const orgName = sessionStorage.getItem('bugbash_verification_org') || 'Your Organization';

    // Mask and display email
    const maskedEmailEl = document.getElementById('maskedEmailDisplay');
    if (maskedEmailEl) {
        maskedEmailEl.textContent = maskEmail(rawEmail);
    }

    const inputs = Array.from(document.querySelectorAll('.otp-digit-input'));
    const form = document.getElementById('otpForm');
    const submitBtn = document.getElementById('verifySubmitBtn');
    const resendBtn = document.getElementById('resendOtpBtn');
    const timerText = document.getElementById('resendTimerText');
    const countdownVal = document.getElementById('countdownVal');

    // Autofocus first input box
    if (inputs.length > 0) {
        inputs[0].focus();
    }

    // Check for Dev OTP in URL or Session Storage (Local Dev Mode)
    function showDevOtpHelper(code) {
        if (!code) return;
        const banner = document.getElementById('devOtpBanner');
        const codeEl = document.getElementById('devOtpCode');
        const btnAutoFill = document.getElementById('btnAutoFillOtp');
        if (banner && codeEl) {
            codeEl.textContent = code;
            banner.style.display = 'block';
            if (btnAutoFill) {
                btnAutoFill.onclick = function() {
                    const digits = String(code).split('');
                    inputs.forEach((input, idx) => {
                        input.value = digits[idx] || '';
                        input.classList.add('filled');
                    });
                    updateSubmitState();
                    handleVerify();
                };
            }
        }
    }

    const initialDevOtp = urlParams.get('dev_otp') || sessionStorage.getItem('bugbash_dev_otp');
    if (initialDevOtp) {
        showDevOtpHelper(initialDevOtp);
    } else if (rawEmail && rawEmail.includes('@')) {
        // Query backend for dev helper code if running in development mode
        const apiBase = window.BugBashConfig?.API_BASE_URL || (window.location.origin + '/api/v1');
        fetch(`${apiBase}/auth/dev-otp?email=${encodeURIComponent(rawEmail)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.dev_otp) {
                    sessionStorage.setItem('bugbash_dev_otp', data.dev_otp);
                    showDevOtpHelper(data.dev_otp);
                }
            })
            .catch(() => {});
    }

    // 2. Six-Digit Input Event Handlers
    inputs.forEach((input, index) => {
        // Handle Keydown: Digit filtering, Backspace, and Arrow navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (!input.value && index > 0) {
                    inputs[index - 1].focus();
                    inputs[index - 1].value = '';
                    inputs[index - 1].classList.remove('filled');
                    updateSubmitState();
                } else {
                    input.value = '';
                    input.classList.remove('filled');
                    updateSubmitState();
                }
            } else if (e.key === 'ArrowLeft' && index > 0) {
                inputs[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
                inputs[index + 1].focus();
            } else if (!/^[0-9]$/.test(e.key) && !['Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Enter'].includes(e.key)) {
                // Reject non-numeric input
                e.preventDefault();
            }
        });

        // Handle Input: Value cleanup and auto-forward focus
        input.addEventListener('input', (e) => {
            const cleanVal = input.value.replace(/\D/g, '');
            input.value = cleanVal.slice(0, 1);

            clearInputErrors();

            if (input.value) {
                input.classList.add('filled');
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                input.classList.remove('filled');
            }

            updateSubmitState();

            // Auto-submit if all 6 digits entered
            if (getOtpString().length === 6) {
                form.requestSubmit();
            }
        });

        // Handle Paste across any box
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const clipboardData = (e.clipboardData || window.clipboardData).getData('text');
            const digits = clipboardData.replace(/\D/g, '').slice(0, 6);

            if (!digits) return;

            clearInputErrors();

            digits.split('').forEach((d, i) => {
                if (inputs[i]) {
                    inputs[i].value = d;
                    inputs[i].classList.add('filled');
                }
            });

            // Focus next empty or the last filled
            const nextEmptyIndex = inputs.findIndex(inp => !inp.value);
            if (nextEmptyIndex !== -1) {
                inputs[nextEmptyIndex].focus();
            } else {
                inputs[inputs.length - 1].focus();
            }

            updateSubmitState();

            if (getOtpString().length === 6) {
                form.requestSubmit();
            }
        });

        // Select text on focus for effortless re-entry
        input.addEventListener('focus', () => {
            input.select();
        });
    });

    function getOtpString() {
        return inputs.map(i => i.value.trim()).join('');
    }

    function updateSubmitState() {
        const isComplete = getOtpString().length === 6;
        if (submitBtn) {
            submitBtn.disabled = !isComplete;
        }
    }

    function clearInputErrors() {
        inputs.forEach(i => i.classList.remove('is-invalid'));
        hideAlert();
    }

    function triggerShake() {
        const group = document.querySelector('.otp-inputs-group');
        if (group) {
            group.classList.add('shake-animation');
            setTimeout(() => group.classList.remove('shake-animation'), 450);
        }
    }

    // 3. Countdown Timer Management
    let countdownSeconds = 60;
    let timerInterval = null;

    function startCountdown(duration = 60) {
        countdownSeconds = duration;
        if (resendBtn) resendBtn.disabled = true;
        if (timerText) timerText.style.display = 'inline-flex';
        updateTimerDisplay();

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            countdownSeconds--;
            updateTimerDisplay();

            if (countdownSeconds <= 0) {
                clearInterval(timerInterval);
                if (resendBtn) {
                    resendBtn.disabled = false;
                }
                if (timerText) {
                    timerText.style.display = 'none';
                }
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        if (!countdownVal) return;
        const mins = Math.floor(countdownSeconds / 60);
        const secs = countdownSeconds % 60;
        countdownVal.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Start initial countdown on load
    startCountdown(60);

    // 4. Resend OTP Handler (State D)
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (resendBtn.disabled) return;

            resendBtn.disabled = true;
            resendBtn.classList.add('loading');
            showAlert('Sending a new verification code to your email...', 'info');

            const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
            const resendEndpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.AUTH_RESEND_OTP || '/auth/resend-otp'}`;

            const payload = {
                verification_token: verificationToken,
                email: rawEmail
            };

            try {
                const response = await fetch(resendEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                let data = {};
                try { data = await response.json(); } catch (_) {}

                if (response.ok) {
                    showAlert('A new 6-digit verification code has been dispatched to your email.', 'success');
                    if (data.dev_otp) {
                        sessionStorage.setItem('bugbash_dev_otp', data.dev_otp);
                        showDevOtpHelper(data.dev_otp);
                    }
                    startCountdown(60);
                    // Clear inputs and refocus first box
                    inputs.forEach(i => {
                        i.value = '';
                        i.classList.remove('filled', 'is-invalid');
                    });
                    inputs[0].focus();
                    updateSubmitState();
                } else if (response.status === 429) {
                    showAlert('Too many resend attempts. Please wait 5 minutes before trying again.', 'warning');
                    startCountdown(180);
                } else {
                    showAlert(data.detail || data.message || 'Unable to resend verification code. Please try again shortly.', 'error');
                }
            } catch (err) {
                console.error('OTP Resend Error:', err);
                showAlert(`Unable to reach the verification server at ${resendEndpoint}. Please verify that the backend is active (python run.py).`, 'error');
            } finally {
                resendBtn.classList.remove('loading');
            }
        });
    }

    // 5. Verification Form Submission (States A, B, C, E, F)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const otp = getOtpString();
        if (otp.length !== 6) {
            showAlert('Please enter the complete 6-digit verification code.', 'error');
            inputs.forEach(i => {
                if (!i.value) i.classList.add('is-invalid');
            });
            triggerShake();
            return;
        }

        setLoading(true);
        hideAlert();

        const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
        const verifyEndpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.AUTH_VERIFY_EMAIL || '/auth/verify-email'}`;

        const payload = {
            verification_token: verificationToken,
            otp: otp,
            email: rawEmail
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.BugBashConfig?.REQUEST_TIMEOUT || 15000);

            const response = await fetch(verifyEndpoint, {
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
            try { data = await response.json(); } catch (_) {}

            // State Transitions:
            if (response.ok) {
                // States E & F: Email Verified & Super Admin Approval Pending
                sessionStorage.removeItem('bugbash_dev_otp');
                transitionToSuccessState(orgName, rawEmail);
            } else if (response.status === 400 || response.status === 401) {
                // State B: Invalid OTP
                const msg = data.detail || data.message || 'Invalid verification code. Please check the 6-digit code and try again.';
                showAlert(msg, 'error');
                inputs.forEach(i => i.classList.add('is-invalid'));
                triggerShake();
                inputs[inputs.length - 1].focus();
            } else if (response.status === 410) {
                // State C: Expired OTP
                showAlert('This verification code has expired. Please request a new code below.', 'warning');
                inputs.forEach(i => i.classList.add('is-invalid'));
                triggerShake();
                // Expire countdown to allow immediate resend
                clearInterval(timerInterval);
                if (resendBtn) resendBtn.disabled = false;
                if (timerText) timerText.style.display = 'none';
            } else if (response.status === 429) {
                showAlert('Too many failed verification attempts. This verification session has been temporarily locked.', 'error');
            } else if (response.status >= 500) {
                showAlert('Server error occurred during verification. Please try again shortly.', 'error');
            } else {
                showAlert(data.detail || data.message || `Verification failed (Status ${response.status}).`, 'error');
            }

        } catch (error) {
            console.error('BugBash OTP Verification Error:', error);
            if (error.name === 'AbortError') {
                showAlert('Verification request timed out. Please check your network connection.', 'error');
            } else {
                showAlert(
                    `Unable to reach verification service at ${verifyEndpoint}. Please ensure the backend is running (python run.py).`,
                    'error'
                );
            }
        } finally {
            setLoading(false);
        }
    });

    // 6. Transition to Success & Approval Pending Screen (States E & F)
    function transitionToSuccessState(org, email) {
        clearInterval(timerInterval);

        const card = document.getElementById('otpCardContent');
        const successScreen = document.getElementById('otpSuccessScreen');
        const successOrgEl = document.getElementById('successOrgName');
        const successEmailEl = document.getElementById('successAdminEmail');

        if (successOrgEl) successOrgEl.textContent = org;
        if (successEmailEl) successEmailEl.textContent = email;

        if (card && successScreen) {
            card.style.display = 'none';
            successScreen.classList.add('show');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Clean up temporary session tokens
        sessionStorage.removeItem('bugbash_verification_token');
    }

    // 7. Utility Helpers
    function maskEmail(email) {
        if (!email || !email.includes('@')) return 'your email';
        const [user, domain] = email.split('@');
        if (user.length <= 2) {
            return `${user[0]}***@${domain}`;
        }
        return `${user[0]}***${user[user.length - 1]}@${domain}`;
    }

    function showAlert(message, type = 'error') {
        const alertBox = document.getElementById('otpAlert');
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
        const alertBox = document.getElementById('otpAlert');
        if (alertBox) alertBox.classList.remove('show');
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (isLoading) {
            submitBtn.classList.add('loading');
        } else {
            submitBtn.classList.remove('loading');
            updateSubmitState();
        }
    }
}

