/**
 * ==============================================================================
 * BugBash - Super Admin Platform Overview Controller
 * ==============================================================================
 * Deep-dive infrastructure monitoring:
 * - Live cluster node telemetry
 * - Queue depth & worker consumer metrics
 * - Latency gauge tracking
 * - Incident log analysis
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    function getToken() {
        return sessionStorage.getItem('bugbash_super_admin_token');
    }

    async function loadHealthTelemetry() {
        const token = getToken();
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }

        try {
            const resp = await fetch(`${API_BASE}/super-admin/platform/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return;

            const data = await resp.json();

            // Populate timestamp and overall status
            const timeEl = document.getElementById('lastCheckTime');
            const statusEl = document.getElementById('overallClusterStatus');
            if (timeEl) timeEl.textContent = data.last_health_check;
            if (statusEl) statusEl.textContent = data.overall_status;

            // Render node list
            const nodesContainer = document.getElementById('platformNodesGrid');
            if (nodesContainer) {
                nodesContainer.innerHTML = '';
                data.services.forEach(srv => {
                    const statusClass = srv.status.toLowerCase();
                    const card = document.createElement('div');
                    card.className = 'sa-node-card';
                    card.innerHTML = `
                        <div class="sa-node-header">
                            <span class="sa-node-title">
                                <span class="sa-pulse-dot" style="${statusClass !== 'healthy' ? 'background:#f59e0b;' : ''}"></span>
                                ${srv.name}
                            </span>
                            <span class="sa-health-badge ${statusClass}">${srv.status}</span>
                        </div>
                        <p style="font-size:0.825rem; color:#94a3b8;">${srv.details}</p>
                        <div class="sa-node-metrics-list">
                            <div class="sa-node-metric-cell">
                                <span class="label">Latency</span>
                                <span class="val">${srv.latency_ms ? srv.latency_ms + ' ms' : 'Nominal'}</span>
                            </div>
                            <div class="sa-node-metric-cell">
                                <span class="label">Workers</span>
                                <span class="val">${srv.worker_count !== undefined && srv.worker_count !== null ? srv.worker_count : 'Managed'}</span>
                            </div>
                            <div class="sa-node-metric-cell">
                                <span class="label">Queue Depth</span>
                                <span class="val">${srv.queue_size !== undefined && srv.queue_size !== null ? srv.queue_size : '0'}</span>
                            </div>
                        </div>
                    `;
                    nodesContainer.appendChild(card);
                });
            }

            // Render incident table
            const incidentTableBody = document.getElementById('incidentsTableBody');
            if (incidentTableBody) {
                incidentTableBody.innerHTML = '';
                if (!data.recent_incidents || data.recent_incidents.length === 0) {
                    incidentTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">No active or past incidents recorded in the current window.</td></tr>`;
                } else {
                    data.recent_incidents.forEach(inc => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong style="color:#f8fafc;">${inc.service}</strong></td>
                            <td><span class="sa-health-badge healthy" style="font-size:0.7rem;">${inc.severity}</span></td>
                            <td>${inc.message}</td>
                            <td>${inc.timestamp}</td>
                        `;
                        incidentTableBody.appendChild(tr);
                    });
                }
            }

        } catch (err) {
            console.error('Failed to load platform telemetry:', err);
        }
    }

    function init() {
        loadHealthTelemetry();
        const refreshBtn = document.getElementById('refreshHealthBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Probing Nodes...';
                loadHealthTelemetry().then(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = 'Refresh Health Checks';
                });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
