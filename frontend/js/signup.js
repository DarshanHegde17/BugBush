/**
 * BugBash - Candidate Signup Controller
 * Manages individual user registration, live password entropy verification,
 * confirm password match status, field validation, API communication with
 * POST /api/v1/auth/register, and automatic transition to OTP email verification.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Form & Input Elements
    const form = document.getElementById('signupForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phoneNumber');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Password Toggles
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const btnToggleConfirm = document.getElementById('btnToggleConfirmPassword');

    // Error Labels
    const fullNameError = document.getElementById('fullNameError');
    const emailError = document.getElementById('emailError');
    const phoneError = document.getElementById('phoneNumberError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    // Alert Banner
    const alertBox = document.getElementById('signupAlert');
    const alertMessage = document.getElementById('signupAlertMessage');

    // Submit Button
    const submitBtn = document.getElementById('submitBtn');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');

    // Entropy & Match Elements
    const entropyFill = document.getElementById('entropyFill');
    const entropyVerdict = document.getElementById('entropyVerdict');
    const critLength = document.getElementById('critLength');
    const critUpper = document.getElementById('critUpper');
    const critLower = document.getElementById('critLower');
    const critNumber = document.getElementById('critNumber');
    const critSpecial = document.getElementById('critSpecial');
    const matchStatusBar = document.getElementById('matchStatusBar');

    // Validation Regex Patterns
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const PHONE_REGEX = /^[+]?[\d\s\-\(\)\.]{7,25}$/;

    // -------------------------------------------------------------------------
    // 1. Password Visibility Toggles
    // -------------------------------------------------------------------------
    if (btnTogglePassword && passwordInput) {
        btnTogglePassword.addEventListener('click', () => togglePassword(passwordInput, btnTogglePassword));
    }
    if (btnToggleConfirm && confirmPasswordInput) {
        btnToggleConfirm.addEventListener('click', () => togglePassword(confirmPasswordInput, btnToggleConfirm));
    }

    function togglePassword(input, btn) {
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

    // -------------------------------------------------------------------------
    // 2. Live Password Entropy & Match Evaluation
    // -------------------------------------------------------------------------
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            clearFieldError(passwordInput, passwordError);
            evaluateEntropy(passwordInput.value);
            checkPasswordMatch();
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            clearFieldError(confirmPasswordInput, confirmPasswordError);
            checkPasswordMatch();
        });
    }

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

        if (!entropyFill || !entropyVerdict) return { score, isFullyValid };

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

    function checkPasswordMatch() {
        if (!confirmPasswordInput || !matchStatusBar) return;

        const p1 = passwordInput.value;
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

    // -------------------------------------------------------------------------
    // 3. Clear Field Errors on User Input
    // -------------------------------------------------------------------------
    if (fullNameInput) {
        fullNameInput.addEventListener('input', () => clearFieldError(fullNameInput, fullNameError));
    }
    if (emailInput) {
        emailInput.addEventListener('input', () => clearFieldError(emailInput, emailError));
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', () => clearFieldError(phoneInput, phoneError));
    }

    function setFieldError(input, errorEl, message) {
        if (input) input.classList.add('is-invalid');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    }

    function clearFieldError(input, errorEl) {
        if (input) input.classList.remove('is-invalid');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        }
        hideAlert();
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

    // -------------------------------------------------------------------------
    // 4. Form Submission Handling
    // -------------------------------------------------------------------------
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const phone = phoneInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            let hasErrors = false;
            let firstInvalidEl = null;

            // Validate Full Name
            if (!fullName || fullName.length < 2) {
                setFieldError(fullNameInput, fullNameError, 'Please enter your full name (at least 2 characters).');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = fullNameInput;
            }

            // Validate Email
            if (!email) {
                setFieldError(emailInput, emailError, 'Email address is required.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = emailInput;
            } else if (!EMAIL_REGEX.test(email)) {
                setFieldError(emailInput, emailError, 'Please enter a valid email address (e.g. name@example.com).');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = emailInput;
            }

            // Validate Phone Number
            if (!phone) {
                setFieldError(phoneInput, phoneError, 'Phone number is required.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = phoneInput;
            } else if (!PHONE_REGEX.test(phone)) {
                setFieldError(phoneInput, phoneError, 'Please enter a valid phone number (at least 7 digits).');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = phoneInput;
            }

            // Validate Password Complexity
            const entropyResult = evaluateEntropy(password);
            if (!password) {
                setFieldError(passwordInput, passwordError, 'Password is required.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = passwordInput;
            } else if (!entropyResult.isFullyValid) {
                setFieldError(passwordInput, passwordError, 'Password must fulfill all 5 security requirements.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = passwordInput;
            }

            // Validate Confirm Password
            if (!confirmPassword) {
                setFieldError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = confirmPasswordInput;
            } else if (password !== confirmPassword) {
                setFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match. Please re-enter.');
                hasErrors = true;
                if (!firstInvalidEl) firstInvalidEl = confirmPasswordInput;
            }

            if (hasErrors) {
                if (firstInvalidEl) firstInvalidEl.focus();
                return;
            }

            // All Valid -> Dispatch to API
            await submitRegistration({
                full_name: fullName,
                email: email,
                phone_number: phone,
                password: password
            });
        });
    }

    /**
     * Dispatches candidate registration payload to POST /api/v1/auth/register
     */
    async function submitRegistration(payload) {
        setLoading(true);

        const baseUrl = window.BugBashConfig?.API_BASE_URL || (window.location.origin + '/api/v1');
        const endpoint = baseUrl + (window.BugBashConfig?.ENDPOINTS?.AUTH_REGISTER || '/auth/register');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                // Success: store verification session and redirect to verify-otp.html
                sessionStorage.setItem('bugbash_verification_email', data.email || payload.email);
                sessionStorage.setItem('bugbash_verification_token', data.verification_token || '');
                sessionStorage.setItem('bugbash_candidate_name', payload.full_name);
                if (data.dev_otp) {
                    sessionStorage.setItem('bugbash_dev_otp', data.dev_otp);
                }

                showAlert('Account created! Redirecting to email verification...', 'success');

                setTimeout(() => {
                    let redirectUrl = `verify-otp.html?email=${encodeURIComponent(data.email || payload.email)}&context=${encodeURIComponent(data.verification_token || '')}`;
                    if (data.dev_otp) {
                        redirectUrl += `&dev_otp=${encodeURIComponent(data.dev_otp)}`;
                    }
                    window.location.href = redirectUrl;
                }, 600);

            } else if (response.status === 409) {
                // Duplicate email handling
                showAlert(data.detail || 'An account with this email address already exists. Please sign in instead.', 'warning');
                setFieldError(emailInput, emailError, 'Email address already registered.');
                emailInput.focus();
            } else if (response.status === 422) {
                const msg = data.detail?.[0]?.msg || data.detail || 'Please verify the highlighted fields.';
                showAlert(msg, 'error');
            } else {
                showAlert(data.detail || 'Registration failed. Please check your information and try again.', 'error');
            }
        } catch (err) {
            console.error('[BugBash Registration Error]:', err);
            showAlert('Unable to reach the BugBash registration server. Please verify your connection.', 'error');
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
        if (btnText) btnText.textContent = isLoading ? 'Creating Account...' : 'Create Account';
    }
});
