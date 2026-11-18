/**
 * ==============================================================================
 * BugBash - Practice Coding Hub Controller
 * ==============================================================================
 * Integrates with FastAPI practice endpoints:
 * - GET /api/v1/practice/statistics
 * - GET /api/v1/practice/recommendations
 * - GET /api/v1/practice/problems
 * Provides debounce searching, category filtering, difficulty selection,
 * dynamic problem cards rendering, and navigation to problem workspace.
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    function getAuthToken() {
        return localStorage.getItem('bugbash_auth_token') ||
               sessionStorage.getItem('bugbash_auth_token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('token');
    }

    // State
    const state = {
        category: 'all',
        difficulty: 'all',
        language: 'all',
        status: 'all',
        search: ''
    };

    let debounceTimer = null;

    // Elements
    const elements = {
        statSolved: document.getElementById('statSolvedCount'),
        statAttempted: document.getElementById('statAttemptedCount'),
        statEasy: document.getElementById('statEasySolved'),
        statMedium: document.getElementById('statMediumSolved'),
        statHard: document.getElementById('statHardSolved'),
        statStreak: document.getElementById('statCurrentStreak'),
        
        categoryChips: document.getElementById('categoryChips'),
        searchInput: document.getElementById('problemSearchInput'),
        difficultySelect: document.getElementById('difficultySelect'),
        languageSelect: document.getElementById('languageSelect'),
        statusSelect: document.getElementById('statusSelect'),
        
        recommendationsGrid: document.getElementById('recommendationsGrid'),
        problemsCatalogGrid: document.getElementById('problemsCatalogGrid'),
        problemCountBadge: document.getElementById('problemCountBadge'),
        
        topbarName: document.getElementById('topbarUserName'),
        topbarAvatar: document.getElementById('topbarAvatar'),
        sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
        sidebar: document.getElementById('sidebar'),
        logoutBtn: document.getElementById('sidebarLogoutBtn')
    };

    /**
     * Compute Monogram Initials
     */
    function getInitials(name) {
        if (!name) return 'CA';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Load Topbar User Information
     */
    async function loadUserProfile() {
        const token = getAuthToken();
        if (!token) return;

        try {
            const resp = await fetch(`${API_BASE}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const user = await resp.json();
                if (elements.topbarName) {
                    elements.topbarName.textContent = (user.full_name || 'Candidate').split(' ')[0];
                }
                if (elements.topbarAvatar) {
                    if (user.avatar_url) {
                        elements.topbarAvatar.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    } else {
                        elements.topbarAvatar.textContent = getInitials(user.full_name);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching user profile:', err);
        }
    }

    /**
     * Fetch Practice Statistics
     */
    async function loadStatistics() {
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        try {
            const resp = await fetch(`${API_BASE}/practice/statistics`, { headers });
            if (!resp.ok) return;

            const stats = await resp.json();
            if (elements.statSolved) elements.statSolved.textContent = stats.problems_solved ?? stats.solved_count ?? 0;
            if (elements.statAttempted) elements.statAttempted.textContent = stats.problems_attempted ?? stats.attempted_count ?? 0;
            if (elements.statEasy) elements.statEasy.textContent = stats.easy_solved ?? 0;
            if (elements.statMedium) elements.statMedium.textContent = stats.medium_solved ?? 0;
            if (elements.statHard) elements.statHard.textContent = stats.hard_solved ?? 0;
            if (elements.statStreak) elements.statStreak.textContent = `${stats.current_streak ?? stats.streak_days ?? 0}d`;
        } catch (err) {
            console.error('Error loading practice statistics:', err);
        }
    }

    /**
     * Fetch Personalized Recommendations
     */
    async function loadRecommendations() {
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        try {
            const resp = await fetch(`${API_BASE}/practice/recommendations`, { headers });
            if (!resp.ok) return;

            const recs = await resp.json();
            renderRecommendations(recs);
        } catch (err) {
            console.error('Error loading recommendations:', err);
        }
    }

    function renderRecommendations(recs) {
        if (!elements.recommendationsGrid) return;
        if (!recs || recs.length === 0) {
            document.getElementById('recommendationsSection').style.display = 'none';
            return;
        }

        elements.recommendationsGrid.innerHTML = recs.map(r => `
            <div class="recommendation-card">
                <div class="rec-reason-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    <span>${r.recommendation_reason}</span>
                </div>
                <h3 class="rec-problem-title">${r.title}</h3>
                <div class="rec-meta-row">
                    <span class="badge ${getDifficultyBadgeClass(r.difficulty)}">${r.difficulty}</span>
                    <span class="rec-topic-text">${r.topic}</span>
                    <span class="rec-accuracy-text">Est. ${r.estimated_minutes} mins</span>
                </div>
                <div class="rec-actions">
                    <a href="practice-problem.html?id=${r.problem_id}" class="btn btn-primary btn-sm" style="width:100%; justify-content:center;">
                        <span>Solve Challenge</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>
                </div>
            </div>
        `).join('');
    }

    function getDifficultyBadgeClass(diff) {
        const d = (diff || '').toLowerCase();
        if (d === 'easy') return 'badge-easy';
        if (d === 'medium') return 'badge-medium';
        return 'badge-hard';
    }

    /**
     * Fetch & Filter Practice Problems Catalog
     */
    async function loadProblems() {
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const params = new URLSearchParams();
        if (state.category && state.category !== 'all') {
            params.append('topic', state.category);
        }
        if (state.difficulty && state.difficulty !== 'all') {
            params.append('difficulty', state.difficulty);
        }
        if (state.language && state.language !== 'all') {
            params.append('language', state.language);
        }
        if (state.status && state.status !== 'all') {
            params.append('status', state.status);
        }
        if (state.search) {
            params.append('search', state.search);
        }

        try {
            const resp = await fetch(`${API_BASE}/practice/problems?${params.toString()}`, { headers });
            if (!resp.ok) return;

            const problems = await resp.json();
            renderProblems(problems);
        } catch (err) {
            console.error('Error loading problems:', err);
        }
    }

    function renderProblems(problems) {
        if (!elements.problemsCatalogGrid) return;

        if (elements.problemCountBadge) {
            elements.problemCountBadge.textContent = `${problems.length} Problem${problems.length === 1 ? '' : 's'}`;
        }

        if (problems.length === 0) {
            elements.problemsCatalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 6px;">No problems matched your filters</h3>
                    <p style="font-size: 13px;">Try clearing your search query or adjusting your topic / difficulty filter.</p>
                </div>
            `;
            return;
        }

        elements.problemsCatalogGrid.innerHTML = problems.map(p => `
            <div class="problem-card">
                <div class="problem-card-top">
                    <span class="badge ${getDifficultyBadgeClass(p.difficulty)}">${p.difficulty}</span>
                    <span class="status-indicator-pill ${p.status === 'Solved' ? 'active' : (p.status === 'Attempted' ? 'pending' : '')}">
                        ${p.status}
                    </span>
                </div>
                <h3 class="problem-card-title">${p.title}</h3>
                <div class="problem-card-tags">
                    ${(p.tags || []).slice(0, 3).map(t => `<span class="problem-tag">${t}</span>`).join('')}
                </div>
                <div class="problem-card-meta">
                    <span>${p.category}</span>
                    <span>Acc: ${p.acceptance_rate}</span>
                </div>
                <div class="problem-card-footer">
                    <div class="problem-langs">
                        ${(p.languages || []).slice(0, 3).map(l => `<span class="lang-dot" title="${l}">${l}</span>`).join('')}
                    </div>
                    <a href="practice-problem.html?id=${p.id}" class="btn ${p.status === 'Solved' ? 'btn-secondary' : 'btn-primary'} btn-sm">
                        <span>${p.status === 'Solved' ? 'Review Code' : 'Solve'}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </a>
                </div>
            </div>
        `).join('');
    }

    /**
     * Setup Event Listeners
     */
    function setupListeners() {
        // Category Chips
        if (elements.categoryChips) {
            elements.categoryChips.addEventListener('click', (e) => {
                const btn = e.target.closest('.category-chip');
                if (!btn) return;
                elements.categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                state.category = btn.getAttribute('data-category');
                loadProblems();
            });
        }

        // Search Input (Debounced)
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    state.search = elements.searchInput.value.trim();
                    loadProblems();
                }, 300);
            });
        }

        // Difficulty Select
        if (elements.difficultySelect) {
            elements.difficultySelect.addEventListener('change', () => {
                state.difficulty = elements.difficultySelect.value;
                loadProblems();
            });
        }

        // Language Select
        if (elements.languageSelect) {
            elements.languageSelect.addEventListener('change', () => {
                state.language = elements.languageSelect.value;
                loadProblems();
            });
        }

        // Status Select
        if (elements.statusSelect) {
            elements.statusSelect.addEventListener('change', () => {
                state.status = elements.statusSelect.value;
                loadProblems();
            });
        }

        // Sidebar & Logout
        if (elements.sidebarToggleBtn && elements.sidebar) {
            elements.sidebarToggleBtn.addEventListener('click', () => {
                elements.sidebar.classList.toggle('collapsed');
            });
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('bugbash_auth_token');
                sessionStorage.removeItem('bugbash_auth_token');
                window.location.href = '../login.html';
            });
        }
    }

    function init() {
        loadUserProfile();
        loadStatistics();
        loadRecommendations();
        loadProblems();
        setupListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
