/**
 * ==============================================================================
 * BugBash - Super Admin Dashboard Controller
 * ==============================================================================
 * Manages root platform dashboard operations:
 * - Authentication validation & identity resolution
 * - 8 Summary operational metrics from backend APIs
 * - Multi-category interactive platform analytics with date filters
 * - Live infrastructure health telemetry
 * - Unified recent activity feed
 * - Privilege-scoped quick action handlers
 * - Secure session sign-out
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    let currentAnalyticsData = null;
    let selectedRange = '30d';
    let currentAnalyticsTab = 'users';

    /**
     * Session Token Resolver (Strictly sessionStorage, NEVER localStorage)
     */
    function getSuperAdminToken() {
        return sessionStorage.getItem('bugbash_super_admin_token');
    }

    function redirectToLogin() {
        sessionStorage.removeItem('bugbash_super_admin_token');
        sessionStorage.removeItem('bugbash_super_admin_user');
        sessionStorage.removeItem('bugbash_super_admin_role');
        window.location.href = '/super-admin/login';
    }

    /**
     * Authenticated Fetch Wrapper
     */
    async function superAdminFetch(endpoint, options = {}) {
        const token = getSuperAdminToken();
        if (!token) {
            redirectToLogin();
            throw new Error('Unauthenticated');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };

        const resp = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (resp.status === 401 || resp.status === 403) {
            redirectToLogin();
            throw new Error('Unauthorized');
        }

        return resp;
    }

    /**
     * Toast notification display
     */
    function showToast(message, type = 'success') {
        let container = document.getElementById('saToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'saToastContainer';
            container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:9999; display:flex; flex-direction:column; gap:8px;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: #121826;
            color: #f8fafc;
            border: 1px solid ${type === 'success' ? '#10b981' : '#ef4444'};
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 10px;
            transition: opacity 0.3s ease;
        `;
        toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==========================================================================
    // 1. Identity & Profile Resolution
    // ==========================================================================
    async function initIdentity() {
        try {
            const resp = await superAdminFetch('/super-admin/auth/me');
            if (resp.ok) {
                const user = await resp.json();
                
                const nameEl = document.getElementById('superAdminNavName');
                const sidebarNameEl = document.getElementById('sidebarUserName');
                const avatarEl = document.getElementById('sidebarUserAvatar');
                
                if (nameEl) nameEl.textContent = user.name || 'Super Administrator';
                if (sidebarNameEl) sidebarNameEl.textContent = user.name || 'Super Administrator';
                if (avatarEl && user.name) {
                    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    avatarEl.textContent = initials || 'SA';
                }
            }
        } catch (err) {
            console.error('Failed to load Super Admin profile:', err);
        }
    }

    // ==========================================================================
    // 2. Summary Statistics (8 Cards)
    // ==========================================================================
    async function loadStatistics() {
        try {
            const resp = await superAdminFetch('/super-admin/dashboard/statistics');
            if (!resp.ok) return;

            const data = await resp.json();

            function setVal(id, val) {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(val).toLocaleString();
            }

            setVal('statTotalUsers', data.total_registered_users);
            setVal('statActiveUsers', data.total_active_users);
            setVal('statTotalAdmins', data.total_admins);
            setVal('statActiveAssessments', data.active_assessments);
            setVal('statTotalSubmissions', data.total_submissions);
            setVal('statCompletedEvaluations', data.completed_evaluations);
            setVal('statPendingMl', data.pending_ml_analyses);
            setVal('statSuspendedAccounts', data.suspended_accounts);

        } catch (err) {
            console.error('Failed to load summary statistics:', err);
        }
    }

    // ==========================================================================
    // 3. Platform Analytics & Charts
    // ==========================================================================
    async function loadAnalytics(range = '30d') {
        selectedRange = range;
        try {
            const resp = await superAdminFetch(`/super-admin/dashboard/analytics?range=${range}`);
            if (!resp.ok) return;

            currentAnalyticsData = await resp.json();
            renderAnalyticsTab(currentAnalyticsTab);

        } catch (err) {
            console.error('Failed to load analytics data:', err);
        }
    }

    function renderAnalyticsTab(tab) {
        currentAnalyticsTab = tab;
        if (!currentAnalyticsData || !window.SuperAdminCharts) return;

        const primaryCanvas = 'primaryAnalyticsChart';
        const secondaryCanvas = 'secondaryAnalyticsChart';
        const titlePrimary = document.getElementById('primaryChartTitle');
        const titleSecondary = document.getElementById('secondaryChartTitle');

        if (tab === 'users') {
            const u = currentAnalyticsData.users;
            if (titlePrimary) titlePrimary.textContent = 'User Registration Velocity';
            if (titleSecondary) titleSecondary.textContent = 'Account Roles Distribution';

            const labels = (u.daily_registrations || []).map(d => d.date);
            const vals = (u.daily_registrations || []).map(d => d.registrations);
            window.SuperAdminCharts.renderLineChart(primaryCanvas, labels, vals, 'Registrations', '#ff6b35');

            const roleLabels = Object.keys(u.roles_breakdown || {}).map(r => r.replace('_', ' ').toUpperCase());
            const roleVals = Object.values(u.roles_breakdown || {});
            window.SuperAdminCharts.renderDoughnutChart(secondaryCanvas, roleLabels, roleVals);

        } else if (tab === 'assessments') {
            const a = currentAnalyticsData.assessments;
            if (titlePrimary) titlePrimary.textContent = 'Assessment Creation & Completion Trends';
            if (titleSecondary) titleSecondary.textContent = 'Assessment Category Breakdown';

            const labels = (a.trend || []).map(d => d.date);
            const vals = (a.trend || []).map(d => d.created);
            window.SuperAdminCharts.renderLineChart(primaryCanvas, labels, vals, 'Created', '#8b5cf6');

            const catLabels = Object.keys(a.category_distribution || {});
            const catVals = Object.values(a.category_distribution || {});
            window.SuperAdminCharts.renderDoughnutChart(secondaryCanvas, catLabels, catVals);

        } else if (tab === 'submissions') {
            const s = currentAnalyticsData.submissions;
            if (titlePrimary) titlePrimary.textContent = 'Daily Submission Volume';
            if (titleSecondary) titleSecondary.textContent = 'Programming Language Breakdown';

            const labels = (s.daily_submissions || []).map(d => d.date);
            const vals = (s.daily_submissions || []).map(d => d.total);
            window.SuperAdminCharts.renderLineChart(primaryCanvas, labels, vals, 'Submissions', '#10b981');

            const langLabels = Object.keys(s.language_breakdown || {});
            const langVals = Object.values(s.language_breakdown || {});
            window.SuperAdminCharts.renderDoughnutChart(secondaryCanvas, langLabels, langVals);

        } else if (tab === 'ml') {
            const m = currentAnalyticsData.ml;
            if (titlePrimary) titlePrimary.textContent = 'ML Code Analyses Volume';
            if (titleSecondary) titleSecondary.textContent = 'Algorithm Pattern Classifications';

            const labels = (m.trend || []).map(d => d.date);
            const vals = (m.trend || []).map(d => d.analyses);
            window.SuperAdminCharts.renderLineChart(primaryCanvas, labels, vals, 'Analyses', '#3b82f6');

            const algoLabels = Object.keys(m.algorithm_distribution || {});
            const algoVals = Object.values(m.algorithm_distribution || {});
            window.SuperAdminCharts.renderDoughnutChart(secondaryCanvas, algoLabels, algoVals);
        }
    }

    function setupAnalyticsControls() {
        // Tab buttons
        const tabs = document.querySelectorAll('.sa-tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.getAttribute('data-tab');
                renderAnalyticsTab(tab);
            });
        });

        // Date range filters
        const filters = document.querySelectorAll('.sa-filter-btn');
        filters.forEach(btn => {
            btn.addEventListener('click', () => {
                filters.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                const range = btn.getAttribute('data-range');
                loadAnalytics(range);
            });
        });
    }

    // ==========================================================================
    // 4. Platform Infrastructure Health
    // ==========================================================================
    async function loadPlatformHealth() {
        const grid = document.getElementById('platformHealthGrid');
        if (!grid) return;

        try {
            const resp = await superAdminFetch('/super-admin/platform/health');
            if (!resp.ok) return;

            const data = await resp.json();
            grid.innerHTML = '';

            data.services.forEach(srv => {
                const statusClass = srv.status.toLowerCase();
                const card = document.createElement('div');
                card.className = 'sa-health-card';
                card.innerHTML = `
                    <div class="sa-health-card-top">
                        <span class="sa-health-name">${srv.name}</span>
                        <span class="sa-health-badge ${statusClass}">
                            <span class="sa-pulse-dot" style="${statusClass !== 'healthy' ? 'background:#f59e0b;' : ''}"></span>
                            ${srv.status}
                        </span>
                    </div>
                    <div class="sa-health-details">${srv.details}</div>
                    <div class="sa-health-meta">
                        <span>Latency: <strong>${srv.latency_ms ? srv.latency_ms + 'ms' : 'Nominal'}</strong></span>
                        <span>Checked: ${srv.last_check}</span>
                    </div>
                `;
                grid.appendChild(card);
            });

        } catch (err) {
            console.error('Failed to load platform health:', err);
        }
    }

    // ==========================================================================
    // 5. Recent Platform Activity
    // ==========================================================================
    async function loadRecentActivity(category = 'all') {
        const container = document.getElementById('recentActivityTimeline');
        if (!container) return;

        try {
            const endpoint = category === 'all'
                ? '/super-admin/platform/activity?limit=8'
                : `/super-admin/platform/activity?category=${category}&limit=8`;

            const resp = await superAdminFetch(endpoint);
            if (!resp.ok) return;

            const data = await resp.json();
            container.innerHTML = '';

            if (data.activities.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:24px; color:#64748b; font-size:0.85rem;">No recent activities logged in this category.</div>`;
                return;
            }

            data.activities.forEach(item => {
                const timeAgo = formatTimeAgo(item.timestamp);
                const el = document.createElement('div');
                el.className = 'sa-activity-item';
                el.innerHTML = `
                    <div class="sa-act-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                    <div class="sa-act-info">
                        <div class="sa-act-title-row">
                            <span class="sa-act-title">${item.title}</span>
                            <span class="sa-act-time">${timeAgo}</span>
                        </div>
                        <div class="sa-act-desc">${item.description}</div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:3px;">Actor: <code style="font-family:monospace; color:#ff6b35;">${item.actor}</code></div>
                    </div>
                `;
                container.appendChild(el);
            });

        } catch (err) {
            console.error('Failed to load recent activity:', err);
        }
    }

    function formatTimeAgo(isoString) {
        if (!isoString) return 'Just now';
        const now = new Date();
        const past = new Date(isoString);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    }

    function setupActivityFilters() {
        const pills = document.querySelectorAll('.sa-act-filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const cat = pill.getAttribute('data-cat');
                loadRecentActivity(cat);
            });
        });
    }

    // ==========================================================================
    // 6. Quick Actions with Confirmation Guard
    // ==========================================================================
    function setupQuickActions() {
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                if (action === 'system-config' || action === 'audit-logs') {
                    const confirmed = confirm(`Proceed to ${btn.innerText.trim()} module? This area contains privileged root controls.`);
                    if (!confirmed) {
                        e.preventDefault();
                    }
                }
            });
        });
    }

    // ==========================================================================
    // 7. Sign Out
    // ==========================================================================
    function setupLogout() {
        const logoutBtn = document.getElementById('saLogoutBtn');
        const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

        async function handleSignOut(e) {
            if (e) e.preventDefault();
            const token = getSuperAdminToken();
            if (token) {
                try {
                    await fetch(`${API_BASE}/super-admin/auth/logout`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (err) {}
            }
            redirectToLogin();
        }

        if (logoutBtn) logoutBtn.addEventListener('click', handleSignOut);
        if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleSignOut);
    }

    // ==========================================================================
    // 8. Mobile Sidebar Toggle & Theme
    // ==========================================================================
    function setupLayoutInteractions() {
        const toggleBtn = document.getElementById('saSidebarToggleBtn');
        const sidebar = document.getElementById('saSidebar');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }

    // ==========================================================================
    // Initialization Dispatcher
    // ==========================================================================
    async function init() {
        const token = getSuperAdminToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        setupLayoutInteractions();
        setupLogout();
        setupQuickActions();

        await initIdentity();
        await loadStatistics();
        await loadAnalytics('30d');
        setupAnalyticsControls();
        await loadPlatformHealth();
        await loadRecentActivity('all');
        setupActivityFilters();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
