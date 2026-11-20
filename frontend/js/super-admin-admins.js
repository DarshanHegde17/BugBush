/**
 * BugBash Super Admin - Admin Management Controller
 * Handles administrator listing, search, status filtering, pagination,
 * and lifecycle transitions (suspend, reactivate, deactivate, resend invitation, revoke sessions).
 */

(function () {
    'use strict';

    let state = {
        admins: [],
        total: 0,
        page: 1,
        limit: 20,
        search: '',
        statusFilter: '',
        sortBy: 'created_at',
        sortOrder: 'desc',
        selectedAdmin: null,
        pendingAction: null
    };

    // DOM Elements
    const elements = {
        totalMetric: document.getElementById('metricTotalAdmins'),
        activeMetric: document.getElementById('metricActiveAdmins'),
        pendingMetric: document.getElementById('metricPendingAdmins'),
        suspendedMetric: document.getElementById('metricSuspendedAdmins'),
        searchInput: document.getElementById('adminSearchInput'),
        statusSelect: document.getElementById('adminStatusFilter'),
        sortSelect: document.getElementById('adminSortSelect'),
        tableBody: document.getElementById('adminsTableBody'),
        paginationBar: document.getElementById('adminsPaginationBar'),
        pageInfo: document.getElementById('adminsPageInfo'),
        prevBtn: document.getElementById('adminsPrevBtn'),
        nextBtn: document.getElementById('adminsNextBtn'),
        confirmModal: document.getElementById('actionConfirmModal'),
        confirmModalTitle: document.getElementById('confirmModalTitle'),
        confirmModalBody: document.getElementById('confirmModalBody'),
        confirmReasonGroup: document.getElementById('confirmReasonGroup'),
        confirmReasonInput: document.getElementById('confirmReasonInput'),
        confirmActionBtn: document.getElementById('confirmActionBtn'),
        cancelActionBtn: document.getElementById('cancelActionBtn'),
        toast: document.getElementById('saToast')
    };

    function init() {
        checkSuperAdminAuth();
        bindEvents();
        fetchAdmins();
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
        // Search debounce
        let searchTimer;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    state.search = e.target.value.trim();
                    state.page = 1;
                    fetchAdmins();
                }, 300);
            });
        }

        // Status Filter
        if (elements.statusSelect) {
            elements.statusSelect.addEventListener('change', (e) => {
                state.statusFilter = e.target.value;
                state.page = 1;
                fetchAdmins();
            });
        }

        // Sort By
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'name_asc') {
                    state.sortBy = 'name';
                    state.sortOrder = 'asc';
                } else if (val === 'name_desc') {
                    state.sortBy = 'name';
                    state.sortOrder = 'desc';
                } else if (val === 'status') {
                    state.sortBy = 'status';
                    state.sortOrder = 'asc';
                } else {
                    state.sortBy = 'created_at';
                    state.sortOrder = 'desc';
                }
                fetchAdmins();
            });
        }

        // Pagination
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener('click', () => {
                if (state.page > 1) {
                    state.page--;
                    fetchAdmins();
                }
            });
        }

        if (elements.nextBtn) {
            elements.nextBtn.addEventListener('click', () => {
                const maxPage = Math.ceil(state.total / state.limit) || 1;
                if (state.page < maxPage) {
                    state.page++;
                    fetchAdmins();
                }
            });
        }

        // Modal Action Confirmation
        if (elements.confirmActionBtn) {
            elements.confirmActionBtn.addEventListener('click', executeConfirmedAction);
        }

        if (elements.cancelActionBtn) {
            elements.cancelActionBtn.addEventListener('click', closeModal);
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

    async function fetchAdmins() {
        renderLoading();

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.SUPER_ADMIN_ADMINS) || '/super-admin/admins';
            
            const url = new URL(apiBase + endpoint, window.location.origin);
            url.searchParams.set('page', state.page);
            url.searchParams.set('limit', state.limit);
            url.searchParams.set('sort_by', state.sortBy);
            url.searchParams.set('sort_order', state.sortOrder);
            if (state.search) url.searchParams.set('search', state.search);
            if (state.statusFilter) url.searchParams.set('status', state.statusFilter);

            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                showToast('Super Admin authorization required. Redirecting to sign in...', 'error');
                setTimeout(() => { window.location.href = '/super-admin/login'; }, 1500);
                return;
            }

            if (!res.ok) {
                throw new Error(`Failed to load administrators: HTTP ${res.status}`);
            }

            const data = await res.json();
            state.admins = data.admins || [];
            state.total = data.total || 0;

            // Update Metrics
            if (elements.totalMetric) elements.totalMetric.textContent = data.total;
            if (elements.activeMetric) elements.activeMetric.textContent = data.active_count;
            if (elements.pendingMetric) elements.pendingMetric.textContent = data.pending_count;
            if (elements.suspendedMetric) elements.suspendedMetric.textContent = data.suspended_count;

            renderTable();
            renderPagination();
        } catch (err) {
            console.error('Fetch admins error:', err);
            renderError('Unable to load administrators. Please check connectivity or refresh.');
        }
    }

    function renderLoading() {
        if (!elements.tableBody) return;
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted);">
                    <div style="display: inline-flex; align-items: center; gap: 10px;">
                        <svg class="sa-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        Loading administrators directory...
                    </div>
                </td>
            </tr>
        `;
    }

    function renderError(msg) {
        if (!elements.tableBody) return;
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px; color: #ef4444;">
                    <div class="sa-empty-title">${escapeHtml(msg)}</div>
                </td>
            </tr>
        `;
    }

    function renderTable() {
        if (!elements.tableBody) return;

        if (state.admins.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="sa-empty-state">
                            <div class="sa-empty-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <div class="sa-empty-title">No Administrators Found</div>
                            <div class="sa-empty-desc">No administrator accounts match your active search or filter criteria.</div>
                            <a href="/super-admin/create-admin" class="sa-btn-primary" style="margin-top: 8px;">
                                Invite New Administrator
                            </a>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = state.admins.map(admin => {
            const initials = (admin.name || admin.email)
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            const statusClass = admin.account_status.toLowerCase().replace(/\s+/g, '-');
            const isPending = statusClass.includes('pending');
            const isSuspended = statusClass === 'suspended';
            const isSuperAdmin = admin.role === 'super_admin';

            return `
                <tr>
                    <td>
                        <div class="sa-user-cell">
                            <div class="sa-user-avatar-circle">
                                ${admin.profile_image ? `<img src="${escapeHtml(admin.profile_image)}" alt="">` : initials}
                            </div>
                            <div class="sa-user-name-meta">
                                <a href="/super-admin/admin-details?id=${encodeURIComponent(admin.id)}" class="sa-user-name-row">
                                    ${escapeHtml(admin.name)}
                                </a>
                                <span class="sa-user-email-row">${escapeHtml(admin.email)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="sa-role-pill">${escapeHtml(formatRole(admin.role))}</span>
                    </td>
                    <td>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(admin.organization_name || 'BugBash Operations')}</span>
                    </td>
                    <td>
                        <span class="sa-badge ${statusClass}">
                            ${escapeHtml(admin.account_status)}
                        </span>
                    </td>
                    <td>
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(admin.created_at)}</span>
                    </td>
                    <td>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(admin.last_login || 'Never')}</span>
                    </td>
                    <td>
                        <div class="sa-actions-flex">
                            <a href="/super-admin/admin-details?id=${encodeURIComponent(admin.id)}" class="sa-action-icon-btn" title="View Admin Information">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </a>
                            <a href="/super-admin/edit-admin?id=${encodeURIComponent(admin.id)}" class="sa-action-icon-btn" title="Edit Profile Details">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </a>
                            ${isPending ? `
                                <button type="button" class="sa-action-icon-btn" title="Resend Invitation" onclick="window.SuperAdminAdmins.resendInvite('${escapeHtml(admin.id)}')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="23 4 23 10 17 10"></polyline>
                                        <polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                    </svg>
                                </button>
                            ` : ''}
                            ${!isSuperAdmin ? `
                                ${isSuspended ? `
                                    <button type="button" class="sa-action-icon-btn" style="color:#10b981;" title="Reactivate Account" onclick="window.SuperAdminAdmins.promptAction('${escapeHtml(admin.id)}', 'reactivate')">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </button>
                                ` : `
                                    <button type="button" class="sa-action-icon-btn danger" title="Suspend Account" onclick="window.SuperAdminAdmins.promptAction('${escapeHtml(admin.id)}', 'suspend')">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                        </svg>
                                    </button>
                                `}
                                <button type="button" class="sa-action-icon-btn danger" title="Revoke All Sessions" onclick="window.SuperAdminAdmins.promptAction('${escapeHtml(admin.id)}', 'revoke')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        elements.tableBody.innerHTML = rows;
    }

    function renderPagination() {
        if (!elements.pageInfo) return;
        const total = state.total;
        const start = total === 0 ? 0 : (state.page - 1) * state.limit + 1;
        const end = Math.min(state.page * state.limit, total);

        elements.pageInfo.textContent = `Showing ${start} to ${end} of ${total} administrators`;
        if (elements.prevBtn) elements.prevBtn.disabled = state.page <= 1;
        if (elements.nextBtn) elements.nextBtn.disabled = end >= total;
    }

    // Lifecycle Actions Modal
    function promptAction(adminId, actionType) {
        const admin = state.admins.find(a => a.id === adminId);
        if (!admin) return;

        state.selectedAdmin = admin;
        state.pendingAction = actionType;

        if (!elements.confirmModal) return;

        if (actionType === 'suspend') {
            elements.confirmModalTitle.textContent = 'Suspend Administrator Account';
            elements.confirmModalBody.innerHTML = `
                Are you sure you want to suspend administrator <strong>${escapeHtml(admin.name)}</strong> (${escapeHtml(admin.email)})?
                <br><br>
                Suspended admins are immediately blocked from logging in, and all existing active sessions are terminated.
            `;
            elements.confirmReasonGroup.style.display = 'flex';
            elements.confirmReasonInput.value = '';
            elements.confirmActionBtn.textContent = 'Suspend Account';
            elements.confirmActionBtn.className = 'sa-btn-danger';
        } else if (actionType === 'reactivate') {
            elements.confirmModalTitle.textContent = 'Reactivate Administrator Account';
            elements.confirmModalBody.innerHTML = `
                Restore active operational status for <strong>${escapeHtml(admin.name)}</strong> (${escapeHtml(admin.email)})?
                <br><br>
                The administrator will be permitted to authenticate and access the Admin Portal immediately.
            `;
            elements.confirmReasonGroup.style.display = 'none';
            elements.confirmActionBtn.textContent = 'Reactivate Account';
            elements.confirmActionBtn.className = 'sa-btn-primary';
        } else if (actionType === 'revoke') {
            elements.confirmModalTitle.textContent = 'Revoke All Active Sessions';
            elements.confirmModalBody.innerHTML = `
                Terminate all active JWT session tokens for <strong>${escapeHtml(admin.name)}</strong> (${escapeHtml(admin.email)})?
                <br><br>
                The administrator will be immediately forced to sign in again.
            `;
            elements.confirmReasonGroup.style.display = 'none';
            elements.confirmActionBtn.textContent = 'Revoke All Sessions';
            elements.confirmActionBtn.className = 'sa-btn-danger';
        }

        elements.confirmModal.classList.add('open');
    }

    function closeModal() {
        if (elements.confirmModal) elements.confirmModal.classList.remove('open');
        state.selectedAdmin = null;
        state.pendingAction = null;
    }

    async function executeConfirmedAction() {
        if (!state.selectedAdmin || !state.pendingAction) return;

        const admin = state.selectedAdmin;
        const action = state.pendingAction;
        const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';

        try {
            elements.confirmActionBtn.disabled = true;
            elements.confirmActionBtn.textContent = 'Processing...';

            let endpoint = '';
            let body = null;

            if (action === 'suspend') {
                endpoint = `${apiBase}/super-admin/admins/${encodeURIComponent(admin.id)}/suspend`;
                body = JSON.stringify({ reason: elements.confirmReasonInput.value.trim() || 'Suspension by Super Admin' });
            } else if (action === 'reactivate') {
                endpoint = `${apiBase}/super-admin/admins/${encodeURIComponent(admin.id)}/reactivate`;
            } else if (action === 'revoke') {
                endpoint = `${apiBase}/super-admin/admins/${encodeURIComponent(admin.id)}/revoke-sessions`;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: body
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Operation failed');
            }

            closeModal();
            showToast(data.message || 'Action executed successfully.', 'success');
            fetchAdmins();
        } catch (err) {
            console.error('Action error:', err);
            showToast(err.message, 'error');
        } finally {
            if (elements.confirmActionBtn) elements.confirmActionBtn.disabled = false;
        }
    }

    async function resendInvite(adminId) {
        const admin = state.admins.find(a => a.id === adminId);
        if (!admin) return;

        if (!confirm(`Resend invitation link and fresh verification code to ${admin.email}?`)) {
            return;
        }

        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(admin.id)}/resend-invitation`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to resend invitation');

            showToast(`Invitation resent to ${admin.email}. OTP: ${data.dev_otp}`, 'success');
            fetchAdmins();
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

    function formatRole(role) {
        if (!role) return 'Admin';
        return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

    // Export globally for inline onclick handlers
    window.SuperAdminAdmins = {
        promptAction,
        resendInvite,
        closeModal
    };

    document.addEventListener('DOMContentLoaded', init);
})();
