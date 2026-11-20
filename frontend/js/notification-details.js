/**
 * BugBash - Enterprise Admin Notification Details Controller
 * Visualizes campaign delivery telemetry, recipient log breakdown,
 * multi-channel preview, and campaign lifecycle management.
 */

(function () {
    'use strict';

    let notificationId = null;
    let notificationData = null;
    let allRecipients = [];
    let recipientFilterStatus = '';
    let recipientSearchTerm = '';

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

    document.addEventListener('DOMContentLoaded', function () {
        if (!checkAuth()) return;

        const urlParams = new URLSearchParams(window.location.search);
        notificationId = urlParams.get('id');

        if (!notificationId) {
            alert('Notification ID missing');
            window.location.href = '/admin/notifications';
            return;
        }

        initEventListeners();
        loadNotificationDetails();
        loadDeliveryBreakdown();
    });

    function initEventListeners() {
        // Recipient search input
        const searchInput = document.getElementById('logSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                recipientSearchTerm = this.value.trim().toLowerCase();
                renderRecipientLogs();
            });
        }

        // Recipient status filter
        const statusSelect = document.getElementById('logStatusFilter');
        if (statusSelect) {
            statusSelect.addEventListener('change', function () {
                recipientFilterStatus = this.value;
                renderRecipientLogs();
            });
        }

        // Action buttons
        const btnSendNow = document.getElementById('btnActionSendNow');
        if (btnSendNow) btnSendNow.addEventListener('click', handleSendNow);

        const btnCancel = document.getElementById('btnActionCancel');
        if (btnCancel) btnCancel.addEventListener('click', handleCancelScheduled);

        const btnRetry = document.getElementById('btnActionRetry');
        if (btnRetry) btnRetry.addEventListener('click', handleRetryFailed);

        const btnDuplicate = document.getElementById('btnActionDuplicate');
        if (btnDuplicate) btnDuplicate.addEventListener('click', handleDuplicate);

        const btnArchive = document.getElementById('btnActionArchive');
        if (btnArchive) btnArchive.addEventListener('click', handleArchive);
    }

    async function loadNotificationDetails() {
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}`, {
                credentials: 'include',
                headers: getHeaders()
            });
            if (!res.ok) {
                alert('Notification not found or access denied');
                window.location.href = '/admin/notifications';
                return;
            }
            notificationData = await res.json();
            renderHeaderAndStats(notificationData);
            renderMessagePreview(notificationData);
        } catch (e) {
            console.error('Error loading notification details:', e);
        }
    }

    function renderHeaderAndStats(data) {
        document.getElementById('detailTitle').textContent = data.title;
        document.getElementById('detailCategory').textContent = data.category;
        
        const priorityEl = document.getElementById('detailPriority');
        priorityEl.textContent = data.priority;
        priorityEl.className = `notif-pill priority-${(data.priority || 'normal').toLowerCase()}`;

        const statusEl = document.getElementById('detailStatus');
        statusEl.textContent = data.status;
        const statusKey = (data.status || 'delivered').toLowerCase().replace(/\s+/g, '');
        statusEl.className = `notif-pill status-${statusKey}`;

        // Metadata chips
        document.getElementById('metaAuthor').textContent = data.created_by || 'Admin';
        document.getElementById('metaCreatedAt').textContent = data.created_at || '—';
        document.getElementById('metaSentAt').textContent = data.sent_at || data.scheduled_at || '—';
        document.getElementById('metaAudience').textContent = `${(data.target_audience || 'All Candidates').replace(/_/g, ' ')} (${(data.recipient_count || 0).toLocaleString()} recipients)`;
        document.getElementById('metaChannel').textContent = (data.channel || 'in_app').replace(/_/g, ' ');

        // Action URL
        const actionBox = document.getElementById('metaActionBox');
        if (actionBox) {
            if (data.action_url) {
                actionBox.style.display = 'block';
                const linkEl = document.getElementById('metaActionLink');
                linkEl.href = data.action_url;
                linkEl.textContent = data.action_url;
            } else {
                actionBox.style.display = 'none';
            }
        }

        // Stats
        const stats = data.stats || {};
        const total = stats.total_recipients || data.recipient_count || 0;
        const delivered = stats.delivered || 0;
        const pending = stats.pending || 0;
        const failed = stats.failed || 0;
        const read = stats.read || 0;

        document.getElementById('statTotalTargeted').textContent = total.toLocaleString();
        document.getElementById('statDeliveredCount').textContent = delivered.toLocaleString();
        document.getElementById('statPendingCount').textContent = pending.toLocaleString();
        document.getElementById('statFailedCount').textContent = failed.toLocaleString();
        document.getElementById('statReadCount').textContent = read.toLocaleString();

        const delPct = total > 0 ? Math.round((delivered / total) * 100) : 0;
        const readPct = delivered > 0 ? Math.round((read / delivered) * 100) : 0;

        document.getElementById('statDeliveredRate').textContent = `${delPct}%`;
        document.getElementById('statReadRate').textContent = `${readPct}%`;

        // Progress bar multi-segment
        const barDelivered = document.getElementById('barDelivered');
        const barPending = document.getElementById('barPending');
        const barFailed = document.getElementById('barFailed');

        if (total > 0) {
            if (barDelivered) barDelivered.style.width = `${(delivered / total) * 100}%`;
            if (barPending) barPending.style.width = `${(pending / total) * 100}%`;
            if (barFailed) barFailed.style.width = `${(failed / total) * 100}%`;
        }

        // Contextual action button visibility
        const btnSendNow = document.getElementById('btnActionSendNow');
        const btnCancel = document.getElementById('btnActionCancel');
        const btnRetry = document.getElementById('btnActionRetry');

        if (btnSendNow) btnSendNow.style.display = (data.status === 'Draft' || data.status === 'Scheduled') ? 'inline-flex' : 'none';
        if (btnCancel) btnCancel.style.display = (data.status === 'Scheduled') ? 'inline-flex' : 'none';
        if (btnRetry) btnRetry.style.display = (failed > 0 || data.status === 'Failed') ? 'inline-flex' : 'none';
    }

    function renderMessagePreview(data) {
        document.getElementById('previewCardTitle').textContent = data.title;
        document.getElementById('previewCardBody').textContent = data.message;

        const actionBtn = document.getElementById('previewCardActionBtn');
        if (actionBtn) {
            if (data.action_url) {
                actionBtn.style.display = 'inline-flex';
                actionBtn.href = data.action_url;
            } else {
                actionBtn.style.display = 'none';
            }
        }
    }

    async function loadDeliveryBreakdown() {
        const tbody = document.getElementById('recipientsLogTableBody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Loading recipient delivery telemetry...</td></tr>`;

        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/delivery`, {
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                allRecipients = data.recipients || [];
                renderRecipientLogs();
            } else {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">No individual recipient records available.</td></tr>`;
            }
        } catch (e) {
            console.error('Error fetching recipient breakdown:', e);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Error loading logs.</td></tr>`;
        }
    }

    function renderRecipientLogs() {
        const tbody = document.getElementById('recipientsLogTableBody');
        if (!tbody) return;

        let filtered = allRecipients;

        if (recipientFilterStatus) {
            filtered = filtered.filter(r => (r.delivery_status || '').toLowerCase() === recipientFilterStatus.toLowerCase());
        }

        if (recipientSearchTerm) {
            filtered = filtered.filter(r =>
                (r.recipient_name || '').toLowerCase().includes(recipientSearchTerm) ||
                (r.recipient_email || '').toLowerCase().includes(recipientSearchTerm)
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">No recipient records match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(r => {
            const delStatus = r.delivery_status || 'Delivered';
            const statusClass = delStatus.toLowerCase();
            const readStatus = r.read_status || 'Unread';
            const readClass = readStatus.toLowerCase();

            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(r.recipient_name || 'Candidate')}</strong>
                        <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(r.recipient_email || '—')}</div>
                    </td>
                    <td>
                        <span style="text-transform: capitalize; font-size:12px;">${escapeHtml(r.channel || 'in_app').replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                        <span class="status-badge-mini ${statusClass}">${escapeHtml(delStatus)}</span>
                    </td>
                    <td style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">
                        ${escapeHtml(r.sent_at || '—')}
                    </td>
                    <td>
                        <span class="status-badge-mini ${readClass}">${escapeHtml(readStatus)}</span>
                        ${r.read_at ? `<div style="font-size:10px; color:var(--text-secondary);">${escapeHtml(r.read_at)}</div>` : ''}
                    </td>
                    <td style="font-size:12px; color:${r.failure_reason ? 'var(--notif-danger)' : 'var(--text-secondary)'};">
                        ${escapeHtml(r.failure_reason || '—')}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function handleSendNow() {
        if (!confirm('Dispatch this notification to all targeted recipients immediately?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/send`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                alert('Notification dispatched successfully!');
                loadNotificationDetails();
                loadDeliveryBreakdown();
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail || 'Failed to dispatch'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to send notification');
        }
    }

    async function handleCancelScheduled() {
        if (!confirm('Cancel this scheduled notification?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/cancel`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                alert('Scheduled notification cancelled.');
                loadNotificationDetails();
            } else {
                alert('Failed to cancel');
            }
        } catch (e) {
            console.error(e);
            alert('Error cancelling notification');
        }
    }

    async function handleRetryFailed() {
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/retry`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                alert('Retry successfully initiated for failed recipients.');
                loadNotificationDetails();
                loadDeliveryBreakdown();
            } else {
                alert('Failed to initiate retry');
            }
        } catch (e) {
            console.error(e);
            alert('Error retrying notification');
        }
    }

    async function handleDuplicate() {
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/duplicate`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                window.location.href = `/admin/create-notification?id=${data.id}`;
            } else {
                alert('Failed to duplicate');
            }
        } catch (e) {
            console.error(e);
            alert('Error duplicating');
        }
    }

    async function handleArchive() {
        if (!confirm('Archive this notification campaign?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notifications/${notificationId}/archive`, {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                alert('Notification archived.');
                window.location.href = '/admin/notifications';
            } else {
                alert('Failed to archive');
            }
        } catch (e) {
            console.error(e);
            alert('Error archiving');
        }
    }

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
