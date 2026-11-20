/**
 * BugBash - Super Admin General Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const form = document.getElementById('generalSettingsForm');
    const statusMsg = document.getElementById('formStatusMsg');
    const saveBtn = document.getElementById('saveSettingsBtn');

    // Load initial settings
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
            populateForm(data.general);
        } catch (err) {
            showStatus('Failed to load general settings', 'error');
        }
    }

    function populateForm(gen) {
        if (!gen) return;
        document.getElementById('platform_name').value = gen.platform_name || 'BugBash';
        document.getElementById('platform_tagline').value = gen.platform_tagline || '';
        document.getElementById('platform_logo').value = gen.platform_logo || '';
        document.getElementById('support_email').value = gen.support_email || '';
        document.getElementById('support_phone').value = gen.support_phone || '';
        document.getElementById('support_contact_url').value = gen.support_contact_url || '';
        document.getElementById('default_timezone').value = gen.default_timezone || 'UTC';
        document.getElementById('default_language').value = gen.default_language || 'English (US)';
        document.getElementById('date_time_format').value = gen.date_time_format || 'YYYY-MM-DD HH:mm:ss';
        document.getElementById('default_theme').value = gen.default_theme || 'system';
        document.getElementById('announcement_banner_active').checked = !!gen.announcement_banner_active;
        document.getElementById('announcement_banner_text').value = gen.announcement_banner_text || '';
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Saving Changes...';

            const payload = {
                platform_name: document.getElementById('platform_name').value.trim(),
                platform_tagline: document.getElementById('platform_tagline').value.trim(),
                platform_logo: document.getElementById('platform_logo').value.trim(),
                support_email: document.getElementById('support_email').value.trim(),
                support_phone: document.getElementById('support_phone').value.trim(),
                support_contact_url: document.getElementById('support_contact_url').value.trim(),
                default_timezone: document.getElementById('default_timezone').value,
                default_language: document.getElementById('default_language').value,
                date_time_format: document.getElementById('date_time_format').value,
                default_theme: document.getElementById('default_theme').value,
                announcement_banner_active: document.getElementById('announcement_banner_active').checked,
                announcement_banner_text: document.getElementById('announcement_banner_text').value.trim()
            };

            try {
                const resp = await fetch('/api/v1/super-admin/configuration/general', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await resp.json();
                if (resp.ok) {
                    showStatus('General platform configuration updated successfully!', 'success');
                } else {
                    showStatus(resData.detail || 'Failed to save settings.', 'error');
                }
            } catch (err) {
                showStatus('Network error while saving settings.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Platform Changes';
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
