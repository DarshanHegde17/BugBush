/**
 * BugBash Super Admin - Roles & Permissions Management Controller
 * Handles listing system and custom roles, searching, filtering, and role deletion.
 */

(function () {
    'use strict';

    let state = {
        roles: [],
        search: '',
        filterType: 'all',
        selectedRole: null
    };

    const elements = {
        metricTotal: document.getElementById('metricTotalRoles'),
        metricCustom: document.getElementById('metricCustomRoles'),
        metricSystem: document.getElementById('metricSystemRoles'),
        metricAdmins: document.getElementById('metricTotalAdminsAssigned'),
        searchInput: document.getElementById('rolesSearchInput'),
        filterSelect: document.getElementById('rolesFilterSelect'),
        rolesGrid: document.getElementById('rolesCardsGrid'),
        deleteModal: document.getElementById('deleteRoleModal'),
        deleteModalRoleName: document.getElementById('deleteModalRoleName'),
        confirmDeleteBtn: document.getElementById('confirmDeleteRoleBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteRoleBtn'),
        toast: document.getElementById('saToast')
    };

    function init() {
        checkSuperAdminAuth();
        bindEvents();
        fetchRoles();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }

        const superAdminUser = JSON.parse(localStorage.getItem('bugbash_super_admin_user') || '{}');
        const navName = document.getElementById('superAdminNavName');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        
        if (superAdminUser.name) {
            if (navName) navName.textContent = superAdminUser.name;
            if (sidebarName) sidebarName.textContent = superAdminUser.name;
            if (sidebarAvatar) {
                const initials = superAdminUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                sidebarAvatar.textContent = initials || 'SA';
            }
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
        // Search
        let searchTimer;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    state.search = e.target.value.trim();
                    renderGrid();
                }, 250);
            });
        }

        // Filter
        if (elements.filterSelect) {
            elements.filterSelect.addEventListener('change', (e) => {
                state.filterType = e.target.value;
                renderGrid();
            });
        }

        // Delete Modal
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', executeRoleDelete);
        }

        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }

        // Logout
        const logoutBtn = document.getElementById('saLogoutBtn');
        const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
        [logoutBtn, sidebarLogoutBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    localStorage.removeItem('bugbash_super_admin_token');
                    sessionStorage.removeItem('bugbash_super_admin_token');
                    localStorage.removeItem('bugbash_super_admin_user');
                    window.location.href = '/super-admin/login';
                });
            }
        });
    }

    async function fetchRoles() {
        try {
            renderLoading();
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.SUPER_ADMIN_ROLES) || '/super-admin/roles';

            const res = await fetch(apiBase + endpoint, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                showToast('Super Admin clearance required. Redirecting to sign in...', 'error');
                setTimeout(() => { window.location.href = '/super-admin/login'; }, 1500);
                return;
            }

            if (!res.ok) throw new Error('Failed to load roles directory');

            const data = await res.json();
            state.roles = data.roles || [];

            // Update Metrics
            if (elements.metricTotal) elements.metricTotal.textContent = data.total_roles;
            if (elements.metricCustom) elements.metricCustom.textContent = data.custom_roles_count;
            if (elements.metricSystem) elements.metricSystem.textContent = data.system_roles_count;
            if (elements.metricAdmins) elements.metricAdmins.textContent = data.total_assigned_admins;

            renderGrid();
        } catch (err) {
            console.error('Fetch roles error:', err);
            renderError('Unable to load roles directory. Please refresh.');
        }
    }

    function renderLoading() {
        if (!elements.rolesGrid) return;
        elements.rolesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
                Loading roles &amp; permissions catalog...
            </div>
        `;
    }

    function renderError(msg) {
        if (!elements.rolesGrid) return;
        elements.rolesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #ef4444;">
                ${escapeHtml(msg)}
            </div>
        `;
    }

    function renderGrid() {
        if (!elements.rolesGrid) return;

        let filtered = state.roles;

        // Filter type
        if (state.filterType === 'system') {
            filtered = filtered.filter(r => r.is_system);
        } else if (state.filterType === 'custom') {
            filtered = filtered.filter(r => !r.is_system);
        }

        // Search
        if (state.search) {
            const q = state.search.toLowerCase();
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                r.slug.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            elements.rolesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                        No Roles Found
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
                        No administrative roles match your search or filter.
                    </div>
                    <a href="/super-admin/create-role" class="sa-btn-primary">
                        + Create Custom Role
                    </a>
                </div>
            `;
            return;
        }

        elements.rolesGrid.innerHTML = filtered.map(role => {
            const isSystem = role.is_system;
            const badgeClass = isSystem ? 'system' : 'custom';
            const badgeLabel = isSystem ? 'System Default' : 'Custom Role';
            const cardClass = isSystem ? 'system-card' : 'custom-card';
            const sampleChips = (role.sample_permissions || []).map(p => `
                <span class="sa-role-perm-chip">${escapeHtml(p)}</span>
            `).join('');

            return `
                <div class="sa-role-card ${cardClass}">
                    <div>
                        <div class="sa-role-header">
                            <a href="/super-admin/role-details?id=${encodeURIComponent(role.slug)}" class="sa-role-title">
                                ${escapeHtml(role.name)}
                            </a>
                            <span class="sa-role-badge ${badgeClass}">${badgeLabel}</span>
                        </div>

                        <div class="sa-role-desc">
                            ${escapeHtml(role.description)}
                        </div>

                        <div class="sa-role-meta-row">
                            <span>
                                <strong>${role.permissions_count}</strong> Permissions Authorized
                            </span>
                            <span>
                                <strong>${role.assigned_admins_count}</strong> Admins Assigned
                            </span>
                        </div>

                        <div class="sa-role-perms-preview">
                            ${sampleChips}
                        </div>
                    </div>

                    <div class="sa-role-actions">
                        <a href="/super-admin/role-details?id=${encodeURIComponent(role.slug)}" class="sa-btn-secondary" style="padding: 6px 12px; font-size: 0.775rem;">
                            View Details
                        </a>
                        ${!isSystem || role.slug !== 'super_admin' ? `
                            <a href="/super-admin/edit-role?id=${encodeURIComponent(role.slug)}" class="sa-btn-secondary" style="padding: 6px 12px; font-size: 0.775rem;">
                                Edit
                            </a>
                        ` : ''}
                        ${!isSystem && role.is_deletable ? `
                            <button type="button" class="sa-action-icon-btn danger" title="Delete Role" onclick="window.SuperAdminRoles.promptDelete('${escapeHtml(role.slug)}')">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function promptDelete(roleSlug) {
        const role = state.roles.find(r => r.slug === roleSlug);
        if (!role) return;

        state.selectedRole = role;
        if (elements.deleteModalRoleName) {
            elements.deleteModalRoleName.textContent = role.name;
        }

        if (elements.deleteModal) {
            elements.deleteModal.classList.add('open');
        }
    }

    function closeDeleteModal() {
        if (elements.deleteModal) {
            elements.deleteModal.classList.remove('open');
        }
        state.selectedRole = null;
    }

    async function executeRoleDelete() {
        if (!state.selectedRole) return;

        try {
            elements.confirmDeleteBtn.disabled = true;
            elements.confirmDeleteBtn.textContent = 'Deleting...';

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/roles/${encodeURIComponent(state.selectedRole.slug)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Failed to delete role');
            }

            closeDeleteModal();
            showToast(data.message || 'Role deleted successfully.', 'success');
            fetchRoles();
        } catch (err) {
            console.error('Delete role error:', err);
            showToast(err.message, 'error');
        } finally {
            if (elements.confirmDeleteBtn) {
                elements.confirmDeleteBtn.disabled = false;
                elements.confirmDeleteBtn.textContent = 'Permanently Delete Role';
            }
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

    // Export for inline onclick handlers
    window.SuperAdminRoles = {
        promptDelete,
        closeDeleteModal
    };

    document.addEventListener('DOMContentLoaded', init);
})();
