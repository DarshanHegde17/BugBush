/**
 * BugBash - Super Admin Email Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const form = document.getElementById('emailSettingsForm');
    const statusMsg = document.getElementById('formStatusMsg');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const warningBanner = document.getElementById('unconfiguredWarningBanner');
    const openTestModalBtn = document.getElementById('openTestModalBtn');
    const testModal = document.getElementById('testEmailModal');
    const closeTestModalBtn = document.getElementById('closeTestModalBtn');
    const sendTestEmailBtn = document.getElementById('sendTestEmailBtn');
    const testRecipientInput = document.getElementById('testRecipientEmail');
    const testResultAlert = document.getElementById('testResultAlert');

    let hasExistingPassword = false;

    await loadSettings();

    async function loadSettings() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration/email', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const data = await resp.json();
            populateForm(data);
        } catch (err) {
            showStatus('Failed to load email settings', 'error');
        }
    }

    function populateForm(em) {
        if (!em) return;
        document.getElementById('smtp_host').value = em.smtp_host || '';
        document.getElementById('smtp_port').value = em.smtp_port || 587;
        document.getElementById('sender_email').value = em.sender_email || '';
        document.getElementById('sender_name').value = em.sender_name || '';
        document.getElementById('encryption_method').value = em.encryption_method || 'TLS';
        document.getElementById('smtp_user').value = em.smtp_user || '';

        hasExistingPassword = !!em.has_password;
        const pwdInput = document.getElementById('smtp_password');
        if (hasExistingPassword) {
            pwdInput.value = '••••••••';
            pwdInput.placeholder = 'Password is encrypted and saved. Enter new password to replace.';
        } else {
            pwdInput.value = '';
            pwdInput.placeholder = 'Enter SMTP app password or secret key';
        }

        if (!em.is_configured && warningBanner) {
            warningBanner.style.display = 'flex';
        } else if (warningBanner) {
            warningBanner.style.display = 'none';
        }
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Saving SMTP Configuration...';

            const pwdVal = document.getElementById('smtp_password').value.trim();

            const payload = {
                smtp_host: document.getElementById('smtp_host').value.trim(),
                smtp_port: parseInt(document.getElementById('smtp_port').value, 10),
                sender_email: document.getElementById('sender_email').value.trim(),
                sender_name: document.getElementById('sender_name').value.trim(),
                encryption_method: document.getElementById('encryption_method').value,
                smtp_user: document.getElementById('smtp_user').value.trim(),
                smtp_password: (pwdVal === '••••••••' || pwdVal === '') ? null : pwdVal
            };

            try {
                const resp = await fetch('/api/v1/super-admin/configuration/email', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await resp.json();
                if (resp.ok) {
                    showStatus('Email service configuration updated successfully!', 'success');
                    populateForm(resData);
                } else {
                    showStatus(resData.detail || 'Failed to save email settings.', 'error');
                }
            } catch (err) {
                showStatus('Network error while saving email configuration.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save SMTP Settings';
            }
        });
    }

    // Modal Handling
    if (openTestModalBtn && testModal) {
        openTestModalBtn.addEventListener('click', () => {
            testModal.classList.add('open');
            if (testResultAlert) testResultAlert.style.display = 'none';
        });
    }

    if (closeTestModalBtn && testModal) {
        closeTestModalBtn.addEventListener('click', () => {
            testModal.classList.remove('open');
        });
    }

    if (sendTestEmailBtn) {
        sendTestEmailBtn.addEventListener('click', async () => {
            const recipient = testRecipientInput.value.trim();
            if (!recipient || !recipient.includes('@')) {
                alert('Please enter a valid recipient email address.');
                return;
            }

            sendTestEmailBtn.disabled = true;
            sendTestEmailBtn.innerHTML = 'Sending Test Email...';
            if (testResultAlert) {
                testResultAlert.style.display = 'none';
            }

            try {
                const resp = await fetch('/api/v1/super-admin/configuration/email/test', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_email: recipient })
                });

                const res = await resp.json();
                if (testResultAlert) {
                    testResultAlert.style.display = 'block';
                    if (res.status === 'success') {
                        testResultAlert.className = 'sa-status-badge connected';
                        testResultAlert.innerHTML = `✓ <strong>Success:</strong> ${res.message}`;
                    } else if (res.status === 'warning') {
                        testResultAlert.className = 'sa-status-badge degraded';
                        testResultAlert.innerHTML = `⚠️ <strong>Warning:</strong> ${res.message}`;
                    } else {
                        testResultAlert.className = 'sa-status-badge disconnected';
                        testResultAlert.innerHTML = `✕ <strong>Delivery Failed:</strong> ${res.message}`;
                    }
                }
            } catch (err) {
                if (testResultAlert) {
                    testResultAlert.style.display = 'block';
                    testResultAlert.className = 'sa-status-badge disconnected';
                    testResultAlert.innerHTML = `✕ Network error contacting email test service.`;
                }
            } finally {
                sendTestEmailBtn.disabled = false;
                sendTestEmailBtn.innerHTML = 'Dispatch Diagnostic Email';
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
