/**
 * BugBash Super Admin - Administrator Details Controller
 * Loads detailed administrator record, security posture, assigned permissions,
 * and comprehensive audit activity log.
 */

(function () {
    'use strict';

    let adminId = '';
    let currentAdmin = null;

    const elements = {
        avatar: document.getElementById('adminDetailsAvatar'),
        name: document.getElementById('adminDetailsName'),
        email: document.getElementById('adminDetailsEmail'),
        roleBadge: document.getElementById('adminDetailsRole'),
        statusBadge: document.getElementById('adminDetailsStatus'),
        orgName: document.getElementById('adminDetailsOrg'),
        phone: document.getElementById('adminDetailsPhone'),
        createdDate: document.getElementById('adminDetailsCreated'),
        lastLogin: document.getElementById('adminDetailsLastLogin'),
        description: document.getElementById('adminDetailsDesc'),
        permissionsList: document.getElementById('adminPermissionsList'),
        activityTimeline: document.getElementById('adminActivityTimeline'),
        editBtn: document.getElementById('adminEditBtn'),
        suspendBtn: document.getElementById('adminSuspendBtn'),
        reactivateBtn: document.getElementById('adminReactivateBtn'),
        resendBtn: document.getElementById('adminResendBtn'),
        revokeBtn: document.getElementById('adminRevokeBtn'),
        toast: document.getElementById('saToast')
    };

    function init() {
        checkSuperAdminAuth();

        const urlParams = new URLSearchParams(window.location.search);
        adminId = urlParams.get('id');

        if (!adminId) {
            window.location.href = '/super-admin/admins';
            return;
        }

        bindEvents();
        loadAdminDetails();
        loadAdminActivity();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function bindEvents() {
        if (elements.editBtn) {
            elements.editBtn.addEventListener('click', () => {
                window.location.href = `/super-admin/edit-admin?id=${encodeURIComponent(adminId)}`;
            });
        }

        if (elements.suspendBtn) {
            elements.suspendBtn.addEventListener('click', handleSuspend);
        }

        if (elements.reactivateBtn) {
            elements.reactivateBtn.addEventListener('click', handleReactivate);
        }

        if (elements.resendBtn) {
            elements.resendBtn.addEventListener('click', handleResend);
        }

        if (elements.revokeBtn) {
            elements.revokeBtn.addEventListener('click', handleRevokeSessions);
        }
    }

    async function loadAdminDetails() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) {
                throw new Error(`Failed to load admin profile (HTTP ${res.status})`);
            }

            currentAdmin = await res.json();
            renderProfile();
        } catch (err) {
            console.error('Load admin error:', err);
            showToast(err.message, 'error');
        }
    }

    function renderProfile() {
        if (!currentAdmin) return;

        const initials = (currentAdmin.name || currentAdmin.email)
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        if (elements.avatar) {
            if (currentAdmin.profile_image) {
                elements.avatar.innerHTML = `<img src="${escapeHtml(currentAdmin.profile_image)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="">`;
            } else {
                elements.avatar.textContent = initials;
            }
        }

        if (elements.name) elements.name.textContent = currentAdmin.name;
        if (elements.email) elements.email.textContent = currentAdmin.email;
        if (elements.orgName) elements.orgName.textContent = currentAdmin.organization_name || 'BugBash Operations';
        if (elements.phone) elements.phone.textContent = currentAdmin.phone || 'Not Specified';
        if (elements.createdDate) elements.createdDate.textContent = currentAdmin.created_at;
        if (elements.lastLogin) elements.lastLogin.textContent = currentAdmin.last_login || 'Never';
        if (elements.description) elements.description.textContent = currentAdmin.description || 'General administrative operations and assessment governance.';

        // Role & Status Badges
        if (elements.roleBadge) {
            elements.roleBadge.textContent = currentAdmin.role.replace(/_/g, ' ').toUpperCase();
        }

        if (elements.statusBadge) {
            const statusClass = currentAdmin.account_status.toLowerCase().replace(/\s+/g, '-');
            elements.statusBadge.className = `sa-badge ${statusClass}`;
            elements.statusBadge.textContent = currentAdmin.account_status;
        }

        // Toggle action buttons based on status
        const isPending = currentAdmin.account_status.toLowerCase().includes('pending');
        const isSuspended = currentAdmin.account_status.toLowerCase() === 'suspended';
        const isSuperAdmin = currentAdmin.role === 'super_admin';

        if (elements.resendBtn) elements.resendBtn.style.display = isPending ? 'inline-flex' : 'none';
        if (elements.suspendBtn) elements.suspendBtn.style.display = (!isSuperAdmin && !isSuspended) ? 'inline-flex' : 'none';
        if (elements.reactivateBtn) elements.reactivateBtn.style.display = (!isSuperAdmin && isSuspended) ? 'inline-flex' : 'none';
        if (elements.revokeBtn) elements.revokeBtn.style.display = !isSuperAdmin ? 'inline-flex' : 'none';

        // Render permissions
        if (elements.permissionsList) {
            const perms = currentAdmin.permissions || ['assessments:manage'];
            elements.permissionsList.innerHTML = perms.map(p => `
                <span class="sa-perm-pill">${escapeHtml(p)}</span>
            `).join('');
        }
    }

    async function loadAdminActivity() {
        if (!elements.activityTimeline) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/activity`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) return;

            const data = await res.json();
            const activities = data.activities || [];

            if (activities.length === 0) {
                elements.activityTimeline.innerHTML = `
                    <div style="text-align: center; padding: 24px; color: var(--text-muted);">
                        No recorded operational events for this administrator.
                    </div>
                `;
                return;
            }

            elements.activityTimeline.innerHTML = activities.map(act => `
                <div class="sa-activity-item">
                    <div class="sa-act-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>
                    <div class="sa-act-info">
                        <div class="sa-act-title-row">
                            <span class="sa-act-title">${escapeHtml(act.title)}</span>
                            <span class="sa-act-time">${escapeHtml(act.timestamp)}</span>
                        </div>
                        <div class="sa-act-desc">${escapeHtml(act.details)}</div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Load activity error:', err);
        }
    }

    async function handleSuspend() {
        const reason = prompt(`Enter reason for suspending ${currentAdmin.email}:`, 'Operational audit or policy check');
        if (reason === null) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/suspend`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Suspension failed');

            showToast(data.message, 'success');
            loadAdminDetails();
            loadAdminActivity();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function handleReactivate() {
        if (!confirm(`Reactivate administrator account for ${currentAdmin.email}?`)) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/reactivate`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Reactivation failed');

            showToast(data.message, 'success');
            loadAdminDetails();
            loadAdminActivity();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function handleResend() {
        if (!confirm(`Resend invitation link to ${currentAdmin.email}?`)) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/resend-invitation`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Resend failed');

            showToast(`Invitation resent. OTP: ${data.dev_otp}`, 'success');
            loadAdminActivity();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function handleRevokeSessions() {
        if (!confirm(`Revoke all active sessions for ${currentAdmin.email}? The admin will be forced to log in again.`)) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/revoke-sessions`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Revoke sessions failed');

            showToast(data.message, 'success');
            loadAdminActivity();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function showToast(msg, type = 'success') {
        if (!elements.toast) return;
        elements.toast.textContent = msg;
        elements.toast.className = `sa-toast ${type} show`;
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 4000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
