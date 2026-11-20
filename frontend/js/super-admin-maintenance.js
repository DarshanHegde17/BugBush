/**
 * BugBash - Super Admin Maintenance Mode Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const form = document.getElementById('maintenanceForm');
    const isEnabledToggle = document.getElementById('is_enabled');
    const messageInput = document.getElementById('maintenanceMessage');
    const startTimeInput = document.getElementById('maintenanceStartTime');
    const endTimeInput = document.getElementById('maintenanceEndTime');
    const previewMessageEl = document.getElementById('previewMessage');
    const bannerEl = document.getElementById('maintStatusBanner');
    const statusTextEl = document.getElementById('maintStatusText');
    const saveBtn = document.getElementById('saveMaintenanceBtn');
    const statusMsg = document.getElementById('formStatusMsg');

    // Confirm modal
    const confirmModal = document.getElementById('confirmMaintModal');
    const confirmActionBtn = document.getElementById('confirmActionBtn');
    const cancelActionBtn = document.getElementById('cancelActionBtn');

    let currentConfig = null;

    await loadSettings();

    async function loadSettings() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration/maintenance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const data = await resp.json();
            currentConfig = data;
            populateForm(data);
        } catch (err) {
            showStatus('Failed to load maintenance settings', 'error');
        }
    }

    function populateForm(data) {
        if (!data) return;
        isEnabledToggle.checked = !!data.is_enabled;
        messageInput.value = data.message || '';
        startTimeInput.value = data.start_time || '';
        endTimeInput.value = data.end_time || '';

        updateStatusBanner(data.status === 'Active');
        updatePreview();
    }

    function updateStatusBanner(isActive) {
        if (!bannerEl || !statusTextEl) return;
        if (isActive) {
            bannerEl.className = 'sa-maint-banner active';
            statusTextEl.innerHTML = '<strong>MAINTENANCE MODE IS CURRENTLY ACTIVE</strong> &mdash; Public traffic and candidate assessments are paused. Super Admin emergency access is exempted.';
        } else {
            bannerEl.className = 'sa-maint-banner inactive';
            statusTextEl.innerHTML = '<strong>NORMAL PLATFORM OPERATIONS</strong> &mdash; All services and candidate portals are running.';
        }
    }

    function updatePreview() {
        if (previewMessageEl) {
            previewMessageEl.textContent = messageInput.value.trim() || 'BugBash is currently undergoing scheduled platform upgrades. We will be back online shortly.';
        }
    }

    messageInput.addEventListener('input', updatePreview);

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // If enabling maintenance mode, require explicit confirmation
            if (isEnabledToggle.checked && (!currentConfig || !currentConfig.is_enabled)) {
                if (confirmModal) {
                    confirmModal.classList.add('open');
                    return;
                }
            }

            // Otherwise proceed directly
            executeSave();
        });
    }

    if (confirmActionBtn) {
        confirmActionBtn.addEventListener('click', () => {
            if (confirmModal) confirmModal.classList.remove('open');
            executeSave();
        });
    }

    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', () => {
            if (confirmModal) confirmModal.classList.remove('open');
            // Revert toggle
            if (currentConfig) {
                isEnabledToggle.checked = !!currentConfig.is_enabled;
            }
        });
    }

    async function executeSave() {
        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving Status...';

        const payload = {
            is_enabled: isEnabledToggle.checked,
            message: messageInput.value.trim(),
            start_time: startTimeInput.value.trim() || null,
            end_time: endTimeInput.value.trim() || null,
            exempt_routes: [
                '/super-admin',
                '/api/v1/super-admin',
                '/api/health',
                '/assets',
                '/css',
                '/js'
            ]
        };

        try {
            const resp = await fetch('/api/v1/super-admin/configuration/maintenance', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resData = await resp.json();
            if (resp.ok) {
                currentConfig = resData;
                showStatus('Maintenance mode settings updated successfully!', 'success');
                updateStatusBanner(resData.status === 'Active');
            } else {
                showStatus(resData.detail || 'Failed to save maintenance settings.', 'error');
            }
        } catch (err) {
            showStatus('Network error while saving maintenance configuration.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Update Maintenance Settings';
        }
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
