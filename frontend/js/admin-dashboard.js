/**
 * BugBash - Enterprise Admin Dashboard & Profile Controller
 * Vanilla JavaScript implementation managing admin authentication,
 * live telemetry statistics, Chart.js visual analytics, recent activity feed,
 * role permissions, and profile password management.
 */

(function () {
    'use strict';

    // State
    let adminUser = null;
    let chartInstances = {};

    // Base API Configuration
    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL) || 
                     (window.location.origin ? window.location.origin + '/api/v1' : 'http://127.0.0.1:8000/api/v1');

    /**
     * Retrieves stored admin JWT token
     */
    function getAdminToken() {
        return sessionStorage.getItem('bugbash_admin_token') || localStorage.getItem('bugbash_admin_token');
    }

    /**
     * Redirects unauthorized requests to Admin Login
     */
    function redirectToLogin() {
        sessionStorage.removeItem('bugbash_admin_token');
        sessionStorage.removeItem('bugbash_admin_user');
        localStorage.removeItem('bugbash_admin_token');
        localStorage.removeItem('bugbash_admin_user');
        window.location.href = '/admin/login';
    }

    /**
     * Authenticated Fetch Wrapper
     */
    async function apiRequest(endpoint, options = {}) {
        const token = getAdminToken();
        if (!token) {
            redirectToLogin();
            throw new Error('Unauthenticated');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLogin();
            throw new Error('Unauthorized');
        }

        return response;
    }

    /**
     * Displays a toast notification
     */
    function showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : '⚠'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Initializes Admin Dashboard & Profile
     */
    document.addEventListener('DOMContentLoaded', async () => {
        const token = getAdminToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        // Setup Layout & Common Controls
        initLayoutControls();

        try {
            // 1. Fetch Admin Profile
            await fetchAdminProfile();

            // 2. Page Specific Initializations
            const isProfilePage = window.location.pathname.includes('profile') || document.getElementById('adminProfileContainer');
            if (isProfilePage) {
                await initProfilePage();
            } else {
                await initDashboardPage();
            }
        } catch (err) {
            console.error('[BugBash Admin] Initialization error:', err);
        }
    });

    /**
     * Layout Controls (Sidebar Toggle, Theme Toggle, Dropdowns, Logout)
     */
    function initLayoutControls() {
        // Sidebar Toggle
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        const sidebar = document.getElementById('adminSidebar');
        const mainWrapper = document.getElementById('mainWrapper');

        if (toggleBtn && sidebar && mainWrapper) {
            const isCollapsed = localStorage.getItem('bugbash_sidebar_collapsed') === 'true';
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
                mainWrapper.classList.add('expanded');
            }

            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainWrapper.classList.toggle('expanded');
                localStorage.setItem('bugbash_sidebar_collapsed', sidebar.classList.contains('collapsed'));
            });
        }

        // User Menu Dropdown Toggle
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdownMenu');
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!userMenuBtn.contains(e.target)) {
                    userDropdown.classList.remove('active');
                }
            });
        }

        // Theme Toggle
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nextTheme);
                localStorage.setItem('bugbash_theme', nextTheme);
                // Re-render charts for appropriate text contrast
                updateChartsTheme(nextTheme);
            });
        }

        // Logout Buttons
        const logoutBtns = document.querySelectorAll('.btn-admin-logout, #sidebarLogoutBtn, #dropdownLogoutBtn');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await apiRequest('/admin/auth/logout', { method: 'POST' });
                } catch (_) {}
                redirectToLogin();
            });
        });
    }

    /**
     * Fetches currently authenticated admin profile
     */
    async function fetchAdminProfile() {
        const res = await apiRequest('/admin/auth/me');
        if (!res.ok) return;

        adminUser = await res.json();
        sessionStorage.setItem('bugbash_admin_user', JSON.stringify(adminUser));

        // Update Topbar Greeting
        const greetingEl = document.getElementById('adminGreetingName');
        if (greetingEl) {
            greetingEl.textContent = adminUser.full_name || adminUser.name || 'Admin';
        }

        // Update Topbar User Menu Pill
        const pillNameEl = document.getElementById('userPillName');
        const pillAvatarEl = document.getElementById('userPillAvatar');
        if (pillNameEl) pillNameEl.textContent = adminUser.full_name || 'Admin';
        if (pillAvatarEl) pillAvatarEl.textContent = getInitials(adminUser.full_name || 'Admin');

        // Update Sidebar Footer
        const sidebarNameEl = document.getElementById('sidebarAdminName');
        const sidebarAvatarEl = document.getElementById('sidebarAdminAvatar');
        const sidebarRoleEl = document.getElementById('sidebarAdminRole');
        if (sidebarNameEl) sidebarNameEl.textContent = adminUser.full_name || 'Admin';
        if (sidebarAvatarEl) sidebarAvatarEl.textContent = getInitials(adminUser.full_name || 'Admin');
        if (sidebarRoleEl) sidebarRoleEl.textContent = formatRole(adminUser.role);
    }

    /**
     * Initializes Dashboard Overview & Analytics
     */
    async function initDashboardPage() {
        await Promise.all([
            fetchStatistics(),
            fetchAnalytics(),
            fetchRecentActivity()
        ]);
    }

    /**
     * Fetches summary statistics from backend
     */
    async function fetchStatistics() {
        try {
            const res = await apiRequest('/admin/dashboard/statistics');
            if (!res.ok) return;
            const stats = await res.json();

            updateStatElement('statTotalQuestions', stats.total_questions);
            updateStatElement('statTotalAssessments', stats.total_assessments);
            updateStatElement('statActiveAssessments', stats.active_assessments);
            updateStatElement('statRegisteredUsers', stats.registered_users);
            updateStatElement('statCompletedSubmissions', stats.completed_submissions);
            updateStatElement('statPendingEvaluations', stats.pending_evaluations);
        } catch (e) {
            console.warn('[BugBash Admin] Failed to fetch statistics:', e);
        }
    }

    function updateStatElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = (value !== undefined && value !== null) ? Number(value).toLocaleString() : '0';
        }
    }

    /**
     * Fetches analytics and renders Chart.js charts
     */
    async function fetchAnalytics() {
        if (typeof Chart === 'undefined') {
            console.warn('[BugBash Admin] Chart.js is not loaded.');
            return;
        }

        try {
            const res = await apiRequest('/admin/dashboard/analytics');
            if (!res.ok) return;
            const analytics = await res.json();

            renderParticipationChart(analytics.participation);
            renderLanguageChart(analytics.language_usage);
            renderPassFailChart(analytics.pass_fail || analytics.pass_fail_rate);
            renderDifficultyChart(analytics.difficulty_distribution);
        } catch (e) {
            console.warn('[BugBash Admin] Failed to fetch analytics:', e);
        }
    }

    /**
     * Assessment Participation Timeline Chart
     */
    function renderParticipationChart(data) {
        const ctx = document.getElementById('chartParticipation');
        if (!ctx || !data) return;

        if (chartInstances.participation) chartInstances.participation.destroy();

        const labels = data.timeline_labels || data.labels || [];
        const values = data.participation_counts || data.values || [];

        chartInstances.participation = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Submissions',
                    data: values,
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.12)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#ff6b35',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#171c2b',
                        borderColor: '#232a3d',
                        borderWidth: 1,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    }
                }
            }
        });
    }

    /**
     * Programming Language Usage Doughnut Chart
     */
    function renderLanguageChart(data) {
        const ctx = document.getElementById('chartLanguages');
        if (!ctx || !data) return;

        if (chartInstances.languages) chartInstances.languages.destroy();

        const labels = data.languages || data.labels || [];
        const percentages = data.percentages || data.counts || [];

        chartInstances.languages = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: percentages,
                    backgroundColor: ['#ff6b35', '#3b82f6', '#10b981', '#f59e0b', '#a855f7'],
                    borderWidth: 2,
                    borderColor: '#131824'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', boxWidth: 12, padding: 14 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    /**
     * Pass / Fail Breakdown Chart
     */
    function renderPassFailChart(data) {
        const ctx = document.getElementById('chartPassFail');
        if (!ctx || !data) return;

        if (chartInstances.passFail) chartInstances.passFail.destroy();

        const passed = data.passed_count ?? data.passed ?? 74;
        const failed = data.failed_count ?? data.failed ?? 26;

        chartInstances.passFail = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 2,
                    borderColor: '#131824'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', boxWidth: 12, padding: 14 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    /**
     * Question Difficulty Distribution Bar Chart
     */
    function renderDifficultyChart(data) {
        const ctx = document.getElementById('chartDifficulty');
        if (!ctx || !data) return;

        if (chartInstances.difficulty) chartInstances.difficulty.destroy();

        const counts = [
            data.easy_count ?? (data.counts ? data.counts[0] : 0),
            data.medium_count ?? (data.counts ? data.counts[1] : 0),
            data.hard_count ?? (data.counts ? data.counts[2] : 0)
        ];

        chartInstances.difficulty = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Easy', 'Medium', 'Hard'],
                datasets: [{
                    label: 'Questions',
                    data: counts,
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#64748b' }
                    }
                }
            }
        });
    }

    /**
     * Updates chart color palette on theme toggle
     */
    function updateChartsTheme(theme) {
        const textColor = theme === 'dark' ? '#64748b' : '#94a3b8';
        Object.values(chartInstances).forEach(chart => {
            if (chart.options && chart.options.scales) {
                if (chart.options.scales.x) chart.options.scales.x.ticks.color = textColor;
                if (chart.options.scales.y) chart.options.scales.y.ticks.color = textColor;
            }
            chart.update();
        });
    }

    /**
     * Fetches recent administrative activity stream
     */
    async function fetchRecentActivity() {
        const container = document.getElementById('activityFeedList');
        if (!container) return;

        try {
            const res = await apiRequest('/admin/dashboard/recent-activity');
            if (!res.ok) return;

            const data = await res.json();
            const activities = data.activities || [];

            if (activities.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px;">No recent administrative activity recorded.</p>';
                return;
            }

            container.innerHTML = activities.map(item => `
                <div class="activity-item">
                    <div class="activity-dot dot-${escapeHtml(item.type ? item.type.split('_')[0] : 'assessment')}"></div>
                    <div class="activity-details">
                        <span class="activity-actor">${escapeHtml(item.actor || item.user_name || 'System')}</span>
                        <span class="activity-action">${escapeHtml(item.title || item.action || item.description || '')}</span>
                    </div>
                    <span class="activity-badge">${escapeHtml(item.status_badge || item.category || item.type || 'LOG')}</span>
                    <span class="activity-time">${escapeHtml(item.time_ago || 'just now')}</span>
                </div>
            `).join('');
        } catch (e) {
            console.warn('[BugBash Admin] Failed to fetch activity feed:', e);
        }
    }

    /**
     * Initializes Admin Profile Page (`/admin/profile`)
     */
    async function initProfilePage() {
        if (!adminUser) return;

        // Populate Profile Info Card
        setText('profileFullName', adminUser.full_name || 'Admin');
        setText('profileEmail', adminUser.email || '');
        setText('profilePhone', adminUser.phone_number || 'Not provided');
        setText('profileRole', formatRole(adminUser.role));
        setText('profileOrganization', adminUser.organization_name || 'BugBash Global Platform');
        setText('profileStatus', adminUser.account_status || 'Active');
        setText('profileAvatarInitial', getInitials(adminUser.full_name || 'Admin'));

        if (adminUser.created_at) {
            const dateStr = new Date(adminUser.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            setText('profileJoinedDate', dateStr);
        }

        // Fetch & Populate Permissions
        await fetchPermissions();

        // Wire Change Password Form
        initPasswordForm();
    }

    async function fetchPermissions() {
        const container = document.getElementById('profilePermissionsGrid');
        if (!container) return;

        try {
            const res = await apiRequest('/admin/permissions');
            if (!res.ok) return;

            const data = await res.json();
            const permissions = data.permissions || [];

            if (permissions.length === 0) {
                container.innerHTML = '<span class="permission-tag">Standard Admin Access</span>';
                return;
            }

            container.innerHTML = permissions.map(p => `
                <span class="permission-tag">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ${escapeHtml(formatPermission(p))}
                </span>
            `).join('');
        } catch (e) {
            console.warn('[BugBash Admin] Failed to fetch permissions:', e);
        }
    }

    function initPasswordForm() {
        const form = document.getElementById('adminChangePasswordForm');
        if (!form) return;

        const currentPwd = document.getElementById('currentPassword');
        const newPwd = document.getElementById('newPassword');
        const confirmPwd = document.getElementById('confirmPassword');
        const strengthFill = document.getElementById('pwdStrengthFill');
        const btnSubmit = document.getElementById('btnSubmitPassword');

        // Password visibility toggles
        document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    targetInput.type = targetInput.type === 'password' ? 'text' : 'password';
                }
            });
        });

        // Live strength indicator
        if (newPwd && strengthFill) {
            newPwd.addEventListener('input', () => {
                const val = newPwd.value;
                let score = 0;
                if (val.length >= 8) score += 25;
                if (/[A-Z]/.test(val)) score += 25;
                if (/[a-z]/.test(val) && /[0-9]/.test(val)) score += 25;
                if (/[^A-Za-z0-9]/.test(val)) score += 25;

                strengthFill.style.width = `${score}%`;
                if (score < 50) {
                    strengthFill.style.background = '#ef4444';
                } else if (score < 100) {
                    strengthFill.style.background = '#f59e0b';
                } else {
                    strengthFill.style.background = '#10b981';
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (newPwd.value !== confirmPwd.value) {
                showToast('New passwords do not match.', 'error');
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Updating...';
            }

            try {
                const res = await apiRequest('/admin/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        current_password: currentPwd.value,
                        new_password: newPwd.value,
                        confirm_password: confirmPwd.value
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast('Password updated successfully!', 'success');
                    form.reset();
                    if (strengthFill) strengthFill.style.width = '0%';
                } else {
                    showToast(data.detail || 'Password update failed.', 'error');
                }
            } catch (err) {
                showToast('Network error while updating password.', 'error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Update Password';
                }
            }
        });
    }

    // Helper Utilities
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function getInitials(name) {
        if (!name) return 'A';
        const parts = name.trim().split(/\s+/);
        return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
    }

    function formatRole(role) {
        if (!role) return 'Administrator';
        return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function formatPermission(perm) {
        return perm.replace(/:/g, ' - ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
