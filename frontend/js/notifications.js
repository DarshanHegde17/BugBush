/**
 * BugBash - Enterprise Admin Notifications Controller
 * Manages notification campaign listing, multi-filtering, delivery telemetry,
 * pagination, and lifecycle actions (send, cancel, retry, duplicate, archive).
 */

(function () {
    'use strict';

    let currentPage = 1;
    const limit = 15;
    let searchTimeout = null;

    // Authentication token helper
    function getAuthToken() {
        return localStorage.getItem('bugbash_admin_token') || localStorage.getItem('access_token') || '';
    }

    function checkAuth() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getAuthToken()
        };
    }

    // Initialize Page
    document.addEventListener('DOMContentLoaded', function () {
        if (!checkAuth()) return;

        initEventListeners();
        loadStatistics();
        loadNotifications(1);
    });

    function initEventListeners() {
        const searchInput = document.getElementById('notifSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentPage = 1;
                    loadNotifications(1);
                }, 300);
            });
        }

        const filterIds = ['filterCategory', 'filterStatus', 'filterChannel', 'filterPriority', 'sortOrder'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    currentPage = 1;
                    loadNotifications(1);
                });
            }
        });

        const resetBtn = document.getElementById('btnResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                filterIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                currentPage = 1;
                loadNotifications(1);
            });
        }

        // Pagination buttons
        const prevBtn = document.getElementById('btnPrevPage');
        const nextBtn = document.getElementById('btnNextPage');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) loadNotifications(currentPage - 1); });
        if (nextBtn) nextBtn.addEventListener('click', () => { loadNotifications(currentPage + 1); });
    }

    // Fetch and render summary metrics
    async function loadStatistics() {
        try {
            const res = await fetch('/api/v1/admin/notifications/statistics', { credentials: 'include', headers: getHeaders() });
            if (!res.ok) return;
            const data = await res.json();

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(val || 0).toLocaleString();
            };

            setVal('statTotalNotifs', data.total_notifications);
            setVal('statDelivered', data.successfully_delivered);
            setVal('statPending', data.pending_delivery);
            setVal('statFailed', data.failed_notifications);
            setVal('statScheduled', data.scheduled_notifications);
            setVal('statRead', data.read_notifications);
        } catch (err) {
            console.error('Failed to load notification stats:', err);
        }
    }

    // Fetch and render notifications table
    async function loadNotifications(page) {
        currentPage = page || 1;
        const tbody = document.getElementById('notificationsTableBody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="7" class="notif-empty-state"><div class="notif-empty-title">Loading notifications...</div></td></tr>`;

        const search = document.getElementById('notifSearchInput')?.value.trim() || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const channel = document.getElementById('filterChannel')?.value || '';
        const priority = document.getElementById('filterPriority')?.value || '';

        const params = new URLSearchParams({
            page: currentPage,
            limit: limit
        });
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (status) params.append('status', status);
        if (channel) params.append('channel', channel);
        if (priority) params.append('priority', priority);

        try {
            const res = await fetch(`/api/v1/admin/notifications?${params.toString()}`, { credentials: 'include', headers: getHeaders() });
            if (!res.ok) {
                tbody.innerHTML = `<tr><td colspan="7" class="notif-empty-state"><div class="notif-empty-title">Error loading notifications</div></td></tr>`;
                return;
            }
            const data = await res.json();
            renderTable(data.notifications || []);
            renderPagination(data.total, data.page, data.pages);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            tbody.innerHTML = `<tr><td colspan="7" class="notif-empty-state"><div class="notif-empty-title">Failed to connect to notification service</div></td></tr>`;
        }
    }

    function renderTable(items) {
        const tbody = document.getElementById('notificationsTableBody');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="notif-empty-state">
                        <div class="notif-empty-icon">&#128227;</div>
                        <div class="notif-empty-title">No notifications found</div>
                        <p>No announcements match your search or filter criteria.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => {
            const priorityClass = `priority-${(item.priority || 'normal').toLowerCase()}`;
            const statusKey = (item.status || 'delivered').toLowerCase().replace(/\s+/g, '');
            const statusClass = `status-${statusKey}`;

            let channelIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            let channelLabel = 'In-App';
            if (item.channel === 'email') {
                channelIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
                channelLabel = 'Email';
            } else if (item.channel === 'in_app_and_email') {
                channelIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
                channelLabel = 'In-App & Email';
            }

            const dateDisplay = item.sent_at || item.scheduled_at || item.created_at || '—';
            const datePrefix = item.status === 'Scheduled' ? 'Scheduled: ' : (item.status === 'Delivered' ? 'Sent: ' : 'Created: ');

            // Contextual actions
            let actionButtons = `
                <a href="/admin/notification-details?id=${item.id}" class="action-btn" title="View Details">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </a>
                <button type="button" class="action-btn" onclick="window.duplicateNotification('${item.id}')" title="Duplicate Notification">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            `;

            if (item.status === 'Draft' || item.status === 'Scheduled') {
                actionButtons += `
                    <a href="/admin/create-notification?id=${item.id}" class="action-btn" title="Edit Notification">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </a>
                `;
            }

            if (item.status === 'Scheduled') {
                actionButtons += `
                    <button type="button" class="action-btn danger" onclick="window.cancelScheduled('${item.id}')" title="Cancel Scheduled Dispatch">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </button>
                `;
            }

            if (item.status === 'Failed') {
                actionButtons += `
                    <button type="button" class="action-btn" onclick="window.retryDelivery('${item.id}')" title="Retry Delivery">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                    </button>
                `;
            }

            return `
                <tr>
                    <td>
                        <div class="notif-title-cell">
                            <a href="/admin/notification-details?id=${item.id}" class="notif-title-link">${escapeHtml(item.title)}</a>
                            <div class="notif-meta-chips">
                                <span class="notif-pill category">${escapeHtml(item.category)}</span>
                                <span>&bull; By ${escapeHtml(item.created_by)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong>${(item.recipient_count || 0).toLocaleString()}</strong> candidates
                        <div style="font-size: 11px; color: var(--text-secondary); text-transform: capitalize;">${escapeHtml(item.target_audience.replace(/_/g, ' '))}</div>
                    </td>
                    <td>
                        <span class="channel-tag">
                            ${channelIcon}
                            ${channelLabel}
                        </span>
                    </td>
                    <td>
                        <span class="notif-pill ${priorityClass}">${escapeHtml(item.priority)}</span>
                    </td>
                    <td>
                        <span class="notif-pill ${statusClass}">${escapeHtml(item.status)}</span>
                    </td>
                    <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">
                        <span style="font-size: 11px; display: block; opacity: 0.7;">${datePrefix}</span>
                        ${escapeHtml(dateDisplay)}
                    </td>
                    <td>
                        <div class="notif-actions-cell">
                            ${actionButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderPagination(total, page, totalPages) {
        const infoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('btnPrevPage');
        const nextBtn = document.getElementById('btnNextPage');

        if (infoEl) {
            const start = total === 0 ? 0 : (page - 1) * limit + 1;
            const end = Math.min(page * limit, total);
            infoEl.textContent = `Showing ${start}-${end} of ${total} notifications`;
        }

        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    // Global action functions
    window.duplicateNotification = async function (id) {
        if (!confirm('Duplicate this notification as a new draft?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notifications/${id}/duplicate`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                window.location.href = `/admin/create-notification?id=${data.id}`;
            } else {
                alert('Failed to duplicate notification');
            }
        } catch (e) {
            console.error(e);
            alert('Error duplicating notification');
        }
    };

    window.cancelScheduled = async function (id) {
        if (!confirm('Are you sure you want to cancel this scheduled notification?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notifications/${id}/cancel`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                loadNotifications(currentPage);
                loadStatistics();
            } else {
                alert('Failed to cancel scheduled notification');
            }
        } catch (e) {
            console.error(e);
            alert('Error cancelling notification');
        }
    };

    window.retryDelivery = async function (id) {
        try {
            const res = await fetch(`/api/v1/admin/notifications/${id}/retry`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                alert('Retry initiated for failed recipients.');
                loadNotifications(currentPage);
                loadStatistics();
            } else {
                alert('Failed to trigger retry');
            }
        } catch (e) {
            console.error(e);
            alert('Error triggering retry');
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

})();
