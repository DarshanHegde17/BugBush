/**
 * BugBash - Super Admin System Configuration Hub Controller
 * Manages configuration overview, service health summaries, and audit trail.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentication Check
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    // Initialize Theme and User display
    initTheme();
    loadSuperAdminIdentity();

    // Elements
    const generalMeta = document.getElementById('generalMeta');
    const assessmentMeta = document.getElementById('assessmentMeta');
    const securityMeta = document.getElementById('securityMeta');
    const emailMeta = document.getElementById('emailMeta');
    const integrationsMeta = document.getElementById('integrationsMeta');
    const maintenanceMeta = document.getElementById('maintenanceMeta');
    const maintenanceBanner = document.getElementById('maintenanceBanner');
    const auditTableBody = document.getElementById('auditTableBody');

    try {
        await Promise.all([loadConfiguration(), loadIntegrationsSummary(), loadAuditLogs()]);
    } catch (err) {
        console.error('Error initializing system configuration overview:', err);
    }

    // =========================================================================
    // API Fetchers
    // =========================================================================
    async function loadConfiguration() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const data = await resp.json();
            renderConfigSummary(data);
        } catch (e) {
            console.error('Failed to load configuration:', e);
        }
    }

    async function loadIntegrationsSummary() {
        try {
            const resp = await fetch('/api/v1/super-admin/integrations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return;
            const items = await resp.json();
            renderIntegrationsSummary(items);
        } catch (e) {
            console.error('Failed to load integrations summary:', e);
        }
    }

    async function loadAuditLogs() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration/audit?limit=8', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return;
            const logs = await resp.json();
            renderAuditLogs(logs);
        } catch (e) {
            console.error('Failed to load audit logs:', e);
        }
    }

    // =========================================================================
    // Render Functions
    // =========================================================================
    function renderConfigSummary(data) {
        const { general, assessment, security, email, maintenance } = data;

        // General
        if (generalMeta) {
            generalMeta.innerHTML = `
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Platform Name</span>
                    <span class="sa-config-meta-val">${escapeHtml(general.platform_name)}</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Timezone</span>
                    <span class="sa-config-meta-val">${escapeHtml(general.default_timezone)}</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Theme Default</span>
                    <span class="sa-config-meta-val">${general.default_theme.toUpperCase()}</span>
                </div>
            `;
        }

        // Assessment
        if (assessmentMeta) {
            assessmentMeta.innerHTML = `
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Default Duration</span>
                    <span class="sa-config-meta-val">${assessment.default_duration_minutes} Minutes</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Execution Limit</span>
                    <span class="sa-config-meta-val">${assessment.code_execution_time_limit_seconds}s</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Languages Supported</span>
                    <span class="sa-config-meta-val">${assessment.allowed_languages.length} Runtimes</span>
                </div>
            `;
        }

        // Security
        if (securityMeta) {
            securityMeta.innerHTML = `
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Min Password Length</span>
                    <span class="sa-config-meta-val">${security.min_password_length} Characters</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Account Lockout</span>
                    <span class="sa-config-meta-val">${security.account_lockout_duration_minutes} Mins (${security.login_attempt_limit} attempts)</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Session Lifespan</span>
                    <span class="sa-config-meta-val">${security.session_expiration_hours} Hours</span>
                </div>
            `;
        }

        // Email
        if (emailMeta) {
            const statusClass = email.is_configured ? 'connected' : 'unconfigured';
            const statusText = email.is_configured ? 'Configured & Active' : 'Not Configured';
            emailMeta.innerHTML = `
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">SMTP Gateway</span>
                    <span class="sa-config-meta-val">${escapeHtml(email.smtp_host)}:${email.smtp_port}</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Sender Address</span>
                    <span class="sa-config-meta-val">${escapeHtml(email.sender_email)}</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Status</span>
                    <span class="sa-status-badge ${statusClass}">${statusText}</span>
                </div>
            `;
        }

        // Maintenance
        if (maintenanceMeta) {
            const isMaint = maintenance.status === 'Active';
            const badgeClass = isMaint ? 'degraded' : 'connected';
            maintenanceMeta.innerHTML = `
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Current State</span>
                    <span class="sa-status-badge ${badgeClass}">${isMaint ? 'MAINTENANCE ACTIVE' : 'NORMAL OPERATIONS'}</span>
                </div>
                <div class="sa-config-meta-item">
                    <span class="sa-config-meta-label">Bypass Routes</span>
                    <span class="sa-config-meta-val">${maintenance.exempt_routes.length} Protected</span>
                </div>
            `;

            if (isMaint && maintenanceBanner) {
                maintenanceBanner.style.display = 'flex';
                maintenanceBanner.className = 'sa-maint-banner active';
                document.getElementById('maintBannerMsg').textContent = maintenance.message;
            } else if (maintenanceBanner) {
                maintenanceBanner.style.display = 'none';
            }
        }
    }

    function renderIntegrationsSummary(items) {
        if (!integrationsMeta) return;
        const connectedCount = items.filter(i => i.status === 'Connected').length;
        const total = items.length;
        integrationsMeta.innerHTML = `
            <div class="sa-config-meta-item">
                <span class="sa-config-meta-label">Operational Services</span>
                <span class="sa-status-badge connected">${connectedCount} / ${total} Online</span>
            </div>
            <div class="sa-config-meta-item">
                <span class="sa-config-meta-label">Sandbox Engine</span>
                <span class="sa-config-meta-val">${items.find(i => i.id === 'code_execution_sandbox')?.status || 'Active'}</span>
            </div>
            <div class="sa-config-meta-item">
                <span class="sa-config-meta-label">Database Cluster</span>
                <span class="sa-config-meta-val">${items.find(i => i.id === 'mongodb_database')?.status || 'Connected'}</span>
            </div>
        `;
    }

    function renderAuditLogs(logs) {
        if (!auditTableBody) return;
        if (!logs || logs.length === 0) {
            auditTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">No system configuration changes recorded yet.</td></tr>`;
            return;
        }

        auditTableBody.innerHTML = logs.map(item => `
            <tr>
                <td style="white-space: nowrap; font-size: 0.82rem; color: var(--text-secondary);">${formatTimestamp(item.timestamp)}</td>
                <td><span style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(item.category)}</span></td>
                <td><span class="sa-status-badge connected" style="font-size: 0.75rem;">${escapeHtml(item.action)}</span></td>
                <td style="font-size: 0.84rem; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.details)}</td>
                <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(item.actor)}</td>
            </tr>
        `).join('');
    }

    // =========================================================================
    // Helpers
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTimestamp(isoStr) {
        if (!isoStr) return '—';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoStr;
        }
    }

    function initTheme() {
        const themeBtn = document.getElementById('theme-toggle-btn');
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('theme', next);
            });
        }
    }

    function loadSuperAdminIdentity() {
        const email = localStorage.getItem('bugbash_super_admin_email') || 'Super Administrator';
        const nameEl = document.getElementById('sidebarUserName');
        if (nameEl) nameEl.textContent = email;

        const logoutBtn = document.getElementById('saLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('bugbash_super_admin_token');
                sessionStorage.removeItem('bugbash_super_admin_token');
                window.location.href = '/super-admin/login';
            });
        }
    }
});
