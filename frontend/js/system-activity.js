/**
 * ==============================================================================
 * BugBash - Super Admin System Activity Controller
 * ==============================================================================
 * Unified platform activity stream with search, category filtering & pagination.
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    let currentPage = 1;
    const limit = 15;
    let currentCategory = 'all';
    let searchQuery = '';

    function getToken() {
        return sessionStorage.getItem('bugbash_super_admin_token');
    }

    async function loadActivities() {
        const token = getToken();
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }

        try {
            let url = `/super-admin/platform/activity?page=${currentPage}&limit=${limit}`;
            if (currentCategory && currentCategory !== 'all') {
                url += `&category=${currentCategory}`;
            }

            const resp = await fetch(`${API_BASE}${url}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return;

            const data = await resp.json();
            const tbody = document.getElementById('activityTableBody');
            if (!tbody) return;

            let activities = data.activities || [];
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                activities = activities.filter(a =>
                    (a.title && a.title.toLowerCase().includes(q)) ||
                    (a.description && a.description.toLowerCase().includes(q)) ||
                    (a.actor && a.actor.toLowerCase().includes(q))
                );
            }

            tbody.innerHTML = '';
            if (activities.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:#64748b;">No activities matching the specified criteria.</td></tr>`;
                return;
            }

            activities.forEach(item => {
                const tr = document.createElement('tr');
                const badgeColor = item.status === 'warning' ? '#f59e0b' : item.status === 'error' ? '#ef4444' : '#10b981';
                tr.innerHTML = `
                    <td>
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${badgeColor}; margin-right:8px;"></span>
                        <strong style="color:#f8fafc;">${item.title}</strong>
                    </td>
                    <td><span class="sa-actor-pill">${item.actor}</span></td>
                    <td><span class="sa-brand-badge-pill" style="font-size:0.65rem;">${item.category}</span></td>
                    <td style="max-width:320px;">${item.description}</td>
                    <td style="font-family:monospace; font-size:0.775rem;">${item.timestamp.replace('T', ' ').slice(0, 19)}</td>
                `;
                tbody.appendChild(tr);
            });

            // Update pagination UI
            const pageNumEl = document.getElementById('currentPageNumber');
            const totalRecordsEl = document.getElementById('totalRecordsText');
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');

            if (pageNumEl) pageNumEl.textContent = `Page ${currentPage}`;
            if (totalRecordsEl) totalRecordsEl.textContent = `Showing ${activities.length} of ${data.total} recorded events`;
            if (prevBtn) prevBtn.disabled = currentPage <= 1;
            if (nextBtn) nextBtn.disabled = (currentPage * limit) >= data.total;

        } catch (err) {
            console.error('Failed to load system activity:', err);
        }
    }

    function init() {
        loadActivities();

        const searchInput = document.getElementById('activitySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                loadActivities();
            });
        }

        const categoryPills = document.querySelectorAll('.sa-cat-pill');
        categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentCategory = pill.getAttribute('data-category');
                currentPage = 1;
                loadActivities();
            });
        });

        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadActivities();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentPage++;
                loadActivities();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
