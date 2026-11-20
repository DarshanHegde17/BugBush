/**
 * BugBash - Super Admin Security Policies Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const form = document.getElementById('securitySettingsForm');
    const statusMsg = document.getElementById('formStatusMsg');
    const saveBtn = document.getElementById('saveSettingsBtn');

    await loadSettings();

    async function loadSettings() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const data = await resp.json();
            populateForm(data.security);
        } catch (err) {
            showStatus('Failed to load security settings', 'error');
        }
    }

    function populateForm(sec) {
        if (!sec) return;
        document.getElementById('min_password_length').value = sec.min_password_length || 8;
        document.getElementById('require_uppercase').checked = !!sec.require_uppercase;
        document.getElementById('require_lowercase').checked = !!sec.require_lowercase;
        document.getElementById('require_numbers').checked = !!sec.require_numbers;
        document.getElementById('require_special_characters').checked = !!sec.require_special_characters;

        document.getElementById('login_attempt_limit').value = sec.login_attempt_limit || 5;
        document.getElementById('account_lockout_duration_minutes').value = sec.account_lockout_duration_minutes || 15;
        document.getElementById('otp_expiration_minutes').value = sec.otp_expiration_minutes || 10;
        document.getElementById('otp_resend_limit_per_hour').value = sec.otp_resend_limit_per_hour || 3;
        document.getElementById('session_expiration_hours').value = sec.session_expiration_hours || 24;
        document.getElementById('refresh_token_rotation').checked = !!sec.refresh_token_rotation;
        document.getElementById('mfa_requirement').value = sec.mfa_requirement || 'optional';
        document.getElementById('session_revocation_policy').value = sec.session_revocation_policy || 'revoke_all_on_password_reset';

        const methods = sec.allowed_login_methods || ['email_password'];
        document.querySelectorAll('input[name="allowed_login_methods"]').forEach(cb => {
            cb.checked = methods.includes(cb.value);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const minPass = parseInt(document.getElementById('min_password_length').value, 10);
            if (minPass < 8) {
                alert('Security Policy Error: Minimum password length must be at least 8 characters.');
                return;
            }

            const selectedMethods = Array.from(document.querySelectorAll('input[name="allowed_login_methods"]:checked')).map(cb => cb.value);
            if (!selectedMethods.includes('email_password')) {
                selectedMethods.push('email_password');
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Enforcing Security Rules...';

            const payload = {
                min_password_length: minPass,
                require_uppercase: document.getElementById('require_uppercase').checked,
                require_lowercase: document.getElementById('require_lowercase').checked,
                require_numbers: document.getElementById('require_numbers').checked,
                require_special_characters: document.getElementById('require_special_characters').checked,
                login_attempt_limit: parseInt(document.getElementById('login_attempt_limit').value, 10),
                account_lockout_duration_minutes: parseInt(document.getElementById('account_lockout_duration_minutes').value, 10),
                otp_expiration_minutes: parseInt(document.getElementById('otp_expiration_minutes').value, 10),
                otp_resend_limit_per_hour: parseInt(document.getElementById('otp_resend_limit_per_hour').value, 10),
                session_expiration_hours: parseInt(document.getElementById('session_expiration_hours').value, 10),
                refresh_token_rotation: document.getElementById('refresh_token_rotation').checked,
                mfa_requirement: document.getElementById('mfa_requirement').value,
                allowed_login_methods: selectedMethods,
                session_revocation_policy: document.getElementById('session_revocation_policy').value
            };

            try {
                const resp = await fetch('/api/v1/super-admin/configuration/security', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await resp.json();
                if (resp.ok) {
                    showStatus('Security policies successfully updated and enforced!', 'success');
                } else {
                    showStatus(resData.detail || 'Failed to save security policies.', 'error');
                }
            } catch (err) {
                showStatus('Network error while saving security policies.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Enforce Security Policies';
            }
        });
    }

    function showStatus(msg, type) {
        if (!statusMsg) return;
        statusMsg.textContent = msg;
        statusMsg.className = type === 'success' ? 'sa-status-badge connected' : 'sa-status-badge disconnected';
        statusMsg.style.display = 'inline-flex';
        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 5000);
    }
});
