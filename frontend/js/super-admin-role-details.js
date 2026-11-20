/**
 * BugBash Super Admin - Role Details Controller
 * Renders granular permissions breakdown and assigned administrators roster.
 * Provides role assignment, reassignment, and role removal actions.
 */

(function () {
    'use strict';

    let roleId = '';
    let roleData = null;

    const elements = {
        roleTitle: document.getElementById('roleDetailsTitle'),
        roleBadge: document.getElementById('roleDetailsBadge'),
        roleDesc: document.getElementById('roleDetailsDesc'),
        permsCount: document.getElementById('roleDetailsPermsCount'),
        adminsCount: document.getElementById('roleDetailsAdminsCount'),
        editBtn: document.getElementById('roleEditBtn'),
        assignBtn: document.getElementById('roleAssignBtn'),
        deleteBtn: document.getElementById('roleDeleteBtn'),
        tabPermsBtn: document.getElementById('tabPermsBtn'),
        tabAdminsBtn: document.getElementById('tabAdminsBtn'),
        tabPermsView: document.getElementById('tabPermsView'),
        tabAdminsView: document.getElementById('tabAdminsView'),
        permissionsList: document.getElementById('rolePermissionsBreakdown'),
        adminsTableBody: document.getElementById('assignedAdminsTableBody'),
        assignModal: document.getElementById('assignAdminModal'),
        assignAdminEmailInput: document.getElementById('assignAdminEmailInput'),
        confirmAssignBtn: document.getElementById('confirmAssignBtn'),
        cancelAssignBtn: document.getElementById('cancelAssignBtn'),
        toast: document.getElementById('saToast')
    };

    function init() {
        checkSuperAdminAuth();

        const urlParams = new URLSearchParams(window.location.search);
        roleId = urlParams.get('id');

        if (!roleId) {
            window.location.href = '/super-admin/roles';
            return;
        }

        bindEvents();
        loadRoleDetails();
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
        if (elements.tabPermsBtn && elements.tabAdminsBtn) {
            elements.tabPermsBtn.addEventListener('click', () => switchTab('perms'));
            elements.tabAdminsBtn.addEventListener('click', () => switchTab('admins'));
        }

        if (elements.editBtn) {
            elements.editBtn.addEventListener('click', () => {
                window.location.href = `/super-admin/edit-role?id=${encodeURIComponent(roleId)}`;
            });
        }

        if (elements.assignBtn) {
            elements.assignBtn.addEventListener('click', openAssignModal);
        }

        if (elements.cancelAssignBtn) {
            elements.cancelAssignBtn.addEventListener('click', closeAssignModal);
        }

        if (elements.confirmAssignBtn) {
            elements.confirmAssignBtn.addEventListener('click', executeRoleAssignment);
        }
    }

    function switchTab(tab) {
        if (tab === 'perms') {
            elements.tabPermsBtn.classList.add('active');
            elements.tabAdminsBtn.classList.remove('active');
            elements.tabPermsView.style.display = 'block';
            elements.tabAdminsView.style.display = 'none';
        } else {
            elements.tabAdminsBtn.classList.add('active');
            elements.tabPermsBtn.classList.remove('active');
            elements.tabAdminsView.style.display = 'block';
            elements.tabPermsView.style.display = 'none';
        }
    }

    async function loadRoleDetails() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/roles/${encodeURIComponent(roleId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) throw new Error('Role not found');

            roleData = await res.json();
            renderHeader();
            renderPermissions();
            renderAdmins();
        } catch (err) {
            console.error('Load role details error:', err);
            showToast(err.message, 'error');
        }
    }

    function renderHeader() {
        if (!roleData) return;

        if (elements.roleTitle) elements.roleTitle.textContent = roleData.name;
        if (elements.roleDesc) elements.roleDesc.textContent = roleData.description;

        if (elements.roleBadge) {
            const isSystem = roleData.is_system;
            elements.roleBadge.className = `sa-role-badge ${isSystem ? 'system' : 'custom'}`;
            elements.roleBadge.textContent = isSystem ? 'System Default' : 'Custom Role';
        }

        const perms = roleData.permissions || [];
        const admins = roleData.assigned_admins || [];

        if (elements.permsCount) elements.permsCount.textContent = perms.includes('*') ? 'All (Root Clearance)' : perms.length;
        if (elements.adminsCount) elements.adminsCount.textContent = admins.length;

        if (elements.editBtn) {
            elements.editBtn.style.display = (!roleData.is_system || roleData.slug !== 'super_admin') ? 'inline-flex' : 'none';
        }
    }

    function renderPermissions() {
        if (!elements.permissionsList || !roleData) return;

        const perms = roleData.permissions || [];
        if (perms.includes('*')) {
            elements.permissionsList.innerHTML = `
                <div class="sa-notice-box security">
                    <div>
                        <strong>Root Platform Clearance (*):</strong>
                        This role possesses unrestricted, full-privilege administrative access to every system capability, telemetry stream, and configuration setting on the platform.
                    </div>
                </div>
            `;
            return;
        }

        // Group permissions by category
        const groups = {};
        perms.forEach(p => {
            const mod = p.split(':')[0] || 'general';
            if (!groups[mod]) groups[mod] = [];
            groups[mod].push(p);
        });

        elements.permissionsList.innerHTML = Object.entries(groups).map(([mod, pList]) => `
            <div class="sa-module-section">
                <div class="sa-module-header">
                    <div class="sa-module-title" style="text-transform: capitalize;">
                        ${escapeHtml(mod.replace(/_/g, ' '))} Module
                    </div>
                    <span class="sa-role-perm-chip" style="color: var(--primary-color);">
                        ${pList.length} Authorized
                    </span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${pList.map(p => `
                        <span class="sa-perm-pill">${escapeHtml(p)}</span>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    function renderAdmins() {
        if (!elements.adminsTableBody || !roleData) return;

        const admins = roleData.assigned_admins || [];
        if (admins.length === 0) {
            elements.adminsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        No administrators currently assigned to this role.
                    </td>
                </tr>
            `;
            return;
        }

        elements.adminsTableBody.innerHTML = admins.map(a => {
            const initials = (a.name || a.email).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            return `
                <tr>
                    <td>
                        <div class="sa-user-cell">
                            <div class="sa-user-avatar-circle">${initials}</div>
                            <div class="sa-user-name-meta">
                                <a href="/super-admin/admin-details?id=${encodeURIComponent(a.id)}" class="sa-user-name-row">
                                    ${escapeHtml(a.name)}
                                </a>
                                <span class="sa-user-email-row">${escapeHtml(a.email)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(a.organization_name || 'BugBash Operations')}</span>
                    </td>
                    <td>
                        <span class="sa-badge ${a.account_status.toLowerCase()}">${escapeHtml(a.account_status)}</span>
                    </td>
                    <td style="text-align: right;">
                        <button type="button" class="sa-btn-secondary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="window.RoleDetails.removeAdminRole('${escapeHtml(a.id)}')">
                            Reset to Default Role
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openAssignModal() {
        if (elements.assignModal) elements.assignModal.classList.add('open');
    }

    function closeAssignModal() {
        if (elements.assignModal) elements.assignModal.classList.remove('open');
        if (elements.assignAdminEmailInput) elements.assignAdminEmailInput.value = '';
    }

    async function executeRoleAssignment() {
        const adminEmail = elements.assignAdminEmailInput.value.trim();
        if (!adminEmail) {
            showToast('Please specify administrator email or ID.', 'error');
            return;
        }

        try {
            elements.confirmAssignBtn.disabled = true;
            elements.confirmAssignBtn.textContent = 'Assigning...';

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminEmail)}/assign-role`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ role_id: roleData.slug })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to assign role');

            closeAssignModal();
            showToast(`Role assigned to ${data.email} successfully.`, 'success');
            loadRoleDetails();
        } catch (err) {
            console.error('Assign error:', err);
            showToast(err.message, 'error');
        } finally {
            elements.confirmAssignBtn.disabled = false;
            elements.confirmAssignBtn.textContent = 'Assign Role';
        }
    }

    async function removeAdminRole(adminId) {
        if (!confirm('Reset this administrator to the default "General Administrator" role?')) return;

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}/remove-role`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to remove role');

            showToast(`Administrator reset to standard role.`, 'success');
            loadRoleDetails();
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

    window.RoleDetails = {
        removeAdminRole
    };

    document.addEventListener('DOMContentLoaded', init);
})();
