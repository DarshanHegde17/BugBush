/**
 * BugBash Organization Signup Controller
 * Manages organization type selection (College vs Company), conditional fields,
 * real-time password strength evaluation, input validation, and FastAPI registration submission.
 */

document.addEventListener('DOMContentLoaded', () => {
    initOrgTypeSelector();
    initPasswordStrength();
    initPasswordToggles();
    initAutofillHelpers();
    initSignupForm();
});

/**
 * 1. Organization Type Selection (College vs Company)
 */
function initOrgTypeSelector() {
    const cards = document.querySelectorAll('.org-type-card');
    const collegeConditionalFields = document.querySelectorAll('.conditional-college');
    const companyConditionalFields = document.querySelectorAll('.conditional-company');
    const orgNameLabel = document.getElementById('orgNameLabel');
    const orgNameInput = document.getElementById('orgName');
    const orgEmailLabel = document.getElementById('orgEmailLabel');
    const orgEmailInput = document.getElementById('orgEmail');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;

            const selectedType = radio ? radio.value : 'college';
            applyOrgTypeUI(selectedType);
        });
    });

    function applyOrgTypeUI(type) {
        if (type === 'college') {
            collegeConditionalFields.forEach(el => el.style.display = 'block');
            companyConditionalFields.forEach(el => el.style.display = 'none');

            if (orgNameLabel) orgNameLabel.textContent = 'College / University Name';
            if (orgNameInput) orgNameInput.placeholder = 'e.g. Stanford University / MIT / IIT';
            if (orgEmailLabel) orgEmailLabel.textContent = 'Institution Email';
            if (orgEmailInput) orgEmailInput.placeholder = 'admissions@university.edu';
        } else {
            collegeConditionalFields.forEach(el => el.style.display = 'none');
            companyConditionalFields.forEach(el => el.style.display = 'block');

            if (orgNameLabel) orgNameLabel.textContent = 'Company / Enterprise Name';
            if (orgNameInput) orgNameInput.placeholder = 'e.g. Acme Technologies Inc.';
            if (orgEmailLabel) orgEmailLabel.textContent = 'Official Work Email';
            if (orgEmailInput) orgEmailInput.placeholder = 'contact@company.com';
        }
    }
}

/**
 * 2. Password Strength Evaluation
 * Evaluates: Length >= 8, Uppercase, Lowercase, Number, Special Character
 */
function initPasswordStrength() {
    const passwordInput = document.getElementById('adminPassword');
    const strengthFill = document.getElementById('strengthFill');
    const strengthVerdict = document.getElementById('strengthVerdict');

    const criteria = {
        length: document.getElementById('critLength'),
        upper: document.getElementById('critUpper'),
        lower: document.getElementById('critLower'),
        number: document.getElementById('critNumber'),
        symbol: document.getElementById('critSymbol')
    };

    if (!passwordInput) return;

    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;
        const checks = {
            length: val.length >= 8,
            upper: /[A-Z]/.test(val),
            lower: /[a-z]/.test(val),
            number: /[0-9]/.test(val),
            symbol: /[^A-Za-z0-9]/.test(val)
        };

        // Update criteria list badges
        Object.keys(checks).forEach(k => {
            if (criteria[k]) {
                if (checks[k]) {
                    criteria[k].classList.add('met');
                } else {
                    criteria[k].classList.remove('met');
                }
            }
        });

        // Compute score (0 to 5)
        const score = Object.values(checks).filter(Boolean).length;

        if (val.length === 0) {
            strengthFill.className = 'strength-fill';
            strengthFill.style.width = '0%';
            strengthVerdict.textContent = 'None';
            strengthVerdict.className = 'strength-verdict';
            return;
        }

        if (score <= 2) {
            strengthFill.className = 'strength-fill weak';
            strengthVerdict.textContent = 'Weak';
            strengthVerdict.className = 'strength-verdict weak';
        } else if (score === 3) {
            strengthFill.className = 'strength-fill fair';
            strengthVerdict.textContent = 'Fair';
            strengthVerdict.className = 'strength-verdict fair';
        } else if (score === 4) {
            strengthFill.className = 'strength-fill good';
            strengthVerdict.textContent = 'Good';
            strengthVerdict.className = 'strength-verdict good';
        } else {
            strengthFill.className = 'strength-fill strong';
            strengthVerdict.textContent = 'Strong';
            strengthVerdict.className = 'strength-verdict strong';
        }

        // Live check if confirm password already typed
        checkConfirmPasswordMatch();
    });
}

/**
 * 3. Password Visibility Toggles
 */
function initPasswordToggles() {
    setupToggle('toggleAdminPasswordBtn', 'adminPassword');
    setupToggle('toggleConfirmPasswordBtn', 'confirmPassword');

    function setupToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');

            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            const eye = btn.querySelector('.icon-eye');
            const eyeOff = btn.querySelector('.icon-eye-off');
            if (eye && eyeOff) {
                eye.style.display = isPassword ? 'none' : 'block';
                eyeOff.style.display = isPassword ? 'block' : 'none';
            }
        });
    }
}

/**
 * 4. Autofill Helpers ("Same as Contact Person")
 */
function initAutofillHelpers() {
    const copyPill = document.getElementById('copyContactToAdmin');
    if (!copyPill) return;

    copyPill.addEventListener('click', () => {
        const contactPerson = document.getElementById('contactPerson')?.value || '';
        const orgPhone = document.getElementById('orgPhone')?.value || '';
        const orgEmail = document.getElementById('orgEmail')?.value || '';

        const adminName = document.getElementById('adminFullName');
        const adminPhone = document.getElementById('adminPhone');
        const adminEmail = document.getElementById('adminEmail');

        if (contactPerson && adminName && !adminName.value) adminName.value = contactPerson;
        if (orgPhone && adminPhone && !adminPhone.value) adminPhone.value = orgPhone;
        if (orgEmail && adminEmail && !adminEmail.value) adminEmail.value = orgEmail;
    });
}

/**
 * 5. Confirm Password Matching
 */
function checkConfirmPasswordMatch() {
    const passwordInput = document.getElementById('adminPassword');
    const confirmInput = document.getElementById('confirmPassword');
    const confirmError = document.getElementById('confirmPasswordError');

    if (!confirmInput || !confirmInput.value) return true;

    if (passwordInput.value !== confirmInput.value) {
        confirmInput.classList.add('is-invalid');
        if (confirmError) {
            confirmError.textContent = 'Passwords do not match.';
            confirmError.classList.add('visible');
        }
        return false;
    } else {
        confirmInput.classList.remove('is-invalid');
        if (confirmError) {
            confirmError.textContent = '';
            confirmError.classList.remove('visible');
        }
        return true;
    }
}

/**
 * 6. Main Form Validation & Backend Registration
 */
function initSignupForm() {
    const form = document.getElementById('signupForm');
    const submitBtn = document.getElementById('submitBtn');
    const confirmInput = document.getElementById('confirmPassword');

    if (!form) return;

    if (confirmInput) {
        confirmInput.addEventListener('input', checkConfirmPasswordMatch);
    }

    // Auto-clear invalid state on user typing
    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', () => {
            clearFieldError(input);
            hideAlert();
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Determine Selected Org Type
        const orgTypeRadio = document.querySelector('input[name="organization_type"]:checked');
        const orgType = orgTypeRadio ? orgTypeRadio.value : 'college';

        // 2. Gather Field Values
        const orgName = (document.getElementById('orgName')?.value || '').trim();
        const orgEmail = (document.getElementById('orgEmail')?.value || '').trim();
        const orgWebsite = (document.getElementById('orgWebsite')?.value || '').trim();
        const contactPerson = (document.getElementById('contactPerson')?.value || '').trim();
        const orgPhone = (document.getElementById('orgPhone')?.value || '').trim();
        const street = (document.getElementById('streetAddress')?.value || '').trim();
        const city = (document.getElementById('city')?.value || '').trim();
        const state = (document.getElementById('state')?.value || '').trim();
        const country = (document.getElementById('country')?.value || '').trim();

        // Conditional
        const affiliation = (document.getElementById('universityAffiliation')?.value || '').trim();
        const industry = (document.getElementById('industrySelect')?.value || '').trim();

        // Admin Fields
        const adminFullName = (document.getElementById('adminFullName')?.value || '').trim();
        const adminEmail = (document.getElementById('adminEmail')?.value || '').trim();
        const adminPhone = (document.getElementById('adminPhone')?.value || '').trim();
        const adminPassword = document.getElementById('adminPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const termsConsent = document.getElementById('termsConsent')?.checked || false;

        let hasError = false;

        // Validation - Organization Info
        if (!orgName) {
            setFieldError(document.getElementById('orgName'), `${orgType === 'college' ? 'College' : 'Company'} name is required.`);
            hasError = true;
        }

        if (!orgEmail) {
            setFieldError(document.getElementById('orgEmail'), 'Official email is required.');
            hasError = true;
        } else if (!isValidEmail(orgEmail)) {
            setFieldError(document.getElementById('orgEmail'), 'Please provide a valid email address.');
            hasError = true;
        }

        if (orgType === 'company' && !industry) {
            setFieldError(document.getElementById('industrySelect'), 'Please select your industry.');
            hasError = true;
        }

        if (!contactPerson) {
            setFieldError(document.getElementById('contactPerson'), 'Contact person is required.');
            hasError = true;
        }

        if (!orgPhone) {
            setFieldError(document.getElementById('orgPhone'), 'Contact phone number is required.');
            hasError = true;
        }

        if (!street) {
            setFieldError(document.getElementById('streetAddress'), 'Street address is required.');
            hasError = true;
        }

        if (!city) {
            setFieldError(document.getElementById('city'), 'City is required.');
            hasError = true;
        }

        if (!state) {
            setFieldError(document.getElementById('state'), 'State / Province is required.');
            hasError = true;
        }

        if (!country) {
            setFieldError(document.getElementById('country'), 'Country is required.');
            hasError = true;
        }

        // Validation - Admin Account
        if (!adminFullName) {
            setFieldError(document.getElementById('adminFullName'), 'Administrator full name is required.');
            hasError = true;
        }

        if (!adminEmail) {
            setFieldError(document.getElementById('adminEmail'), 'Administrator email is required.');
            hasError = true;
        } else if (!isValidEmail(adminEmail)) {
            setFieldError(document.getElementById('adminEmail'), 'Please provide a valid administrator email.');
            hasError = true;
        }

        if (!adminPhone) {
            setFieldError(document.getElementById('adminPhone'), 'Administrator phone number is required.');
            hasError = true;
        }

        if (!adminPassword) {
            setFieldError(document.getElementById('adminPassword'), 'Password is required.');
            hasError = true;
        } else if (adminPassword.length < 8) {
            setFieldError(document.getElementById('adminPassword'), 'Password must be at least 8 characters long.');
            hasError = true;
        }

        if (adminPassword !== confirmPassword) {
            setFieldError(document.getElementById('confirmPassword'), 'Passwords do not match.');
            hasError = true;
        }

        if (!termsConsent) {
            showAlert('You must consent to the Terms of Service and Privacy Policy to register.', 'warning');
            hasError = true;
        }

        if (hasError) return;

        // 3. Assemble Registration Payload
        const payload = {
            organization_type: orgType,
            organization_name: orgName,
            organization_email: orgEmail,
            website: orgWebsite || null,
            university_affiliation: orgType === 'college' ? (affiliation || null) : null,
            industry: orgType === 'company' ? industry : null,
            contact_person: contactPerson,
            phone_number: orgPhone,
            address: {
                street: street,
                city: city,
                state: state,
                country: country
            },
            admin: {
                full_name: adminFullName,
                email: adminEmail,
                phone: adminPhone,
                password: adminPassword
            }
        };

        // 4. Submit to FastAPI Backend
        setLoadingState(true);
        hideAlert();

        const apiBase = window.BugBashConfig?.API_BASE_URL || 'http://localhost:8000/api/v1';
        const registerEndpoint = `${apiBase}${window.BugBashConfig?.ENDPOINTS?.ORGANIZATION_REGISTER || '/organizations/register'}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.BugBashConfig?.REQUEST_TIMEOUT || 15000);

            const response = await fetch(registerEndpoint, {
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

            // 5. Handle Server Response
            if (response.status === 200 || response.status === 201) {
                // Registration Successful
                handleRegistrationSuccess(data, adminEmail, orgName);
            } else if (response.status === 400 || response.status === 409) {
                // Duplicate Organization or Conflict
                const msg = data.detail || data.message || 'An organization or administrator with this email already exists.';
                showAlert(msg, 'error');
                setLoadingState(false);
            } else if (response.status === 422) {
                // FastAPI Schema Validation Error
                const errorDetail = Array.isArray(data.detail)
                    ? data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ')
                    : (data.detail || 'Invalid registration information.');
                showAlert(`Validation error: ${errorDetail}`, 'error');
                setLoadingState(false);
            } else if (response.status === 429) {
                showAlert('Too many registration requests. Please wait a few minutes before trying again.', 'warning');
                setLoadingState(false);
            } else if (response.status >= 500) {
                showAlert('Server error occurred during organization registration. Please try again shortly.', 'error');
                setLoadingState(false);
            } else {
                showAlert(data.detail || data.message || `Registration failed (Status code: ${response.status}).`, 'error');
                setLoadingState(false);
            }

        } catch (error) {
            console.error('BugBash Organization Registration Error:', error);
            setLoadingState(false);

            if (error.name === 'AbortError') {
                showAlert('Registration request timed out. Please check your network or server connection.', 'error');
            } else {
                showAlert(
                    `Unable to reach BugBash registration service at ${registerEndpoint}. Please ensure the backend is active (python run.py).`,
                    'error'
                );
            }
        }
    });
}

/**
 * 7. Success State Presentation
 */
function handleRegistrationSuccess(data, adminEmail, orgName) {
    const form = document.getElementById('signupForm');
    const successCard = document.getElementById('registrationSuccessCard');
    const registeredOrgName = document.getElementById('successOrgName');
    const sentEmailEl = document.getElementById('successEmailSent');

    if (registeredOrgName) registeredOrgName.textContent = orgName;
    if (sentEmailEl) sentEmailEl.textContent = adminEmail;

    if (form && successCard) {
        form.style.display = 'none';
        document.querySelector('.org-type-selection')?.remove();
        document.querySelector('.form-header')?.remove();
        successCard.classList.add('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * 8. Validation & Alert Helpers
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
    const alertBox = document.getElementById('signupAlert');
    if (!alertBox) return;

    alertBox.className = `alert-box ${type} show`;
    const content = alertBox.querySelector('.alert-content');
    if (content) {
        content.innerHTML = message;
    } else {
        alertBox.innerHTML = message;
    }
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideAlert() {
    const alertBox = document.getElementById('signupAlert');
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

