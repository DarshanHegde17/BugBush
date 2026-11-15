/**
 * BugBash - User Dashboard & Portal Controller
 * Manages authenticated data fetching, live metric cards, assessment filtering,
 * practice coding challenges, interactive scorecards, profile editing, and secure session management.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Authentication Check
    const token = getAuthToken();
    if (!token) {
        redirectToLogin();
        return;
    }

    // 2. Initialize UI Components
    initSidebar();
    initThemeToggle();
    initProfileDropdown();
    initSearchHandler();
    initModalHandlers();

    // 3. Load Authenticated User Profile & Data
    await loadUserProfile();

    // 4. Page-Specific Initialization
    const isProfilePage = window.location.pathname.includes('profile.html') || window.location.pathname.endsWith('/profile');
    if (isProfilePage) {
        initProfilePageForms();
    } else {
        initDashboardViews();
        await Promise.all([
            loadDashboardSummary(),
            loadMyAssessments(),
            loadPracticeProblems(),
            loadResults()
        ]);
    }
});

// ==============================================================================
// 1. Session & Auth Helpers
// ==============================================================================
function getAuthToken() {
    return sessionStorage.getItem('bugbash_token') || localStorage.getItem('bugbash_token');
}

function redirectToLogin() {
    // Determine proper relative path to login
    const isSubdir = window.location.pathname.includes('/user/');
    const loginUrl = isSubdir ? '../login.html' : 'login.html';
    window.location.href = loginUrl;
}

function handleLogout() {
    sessionStorage.removeItem('bugbash_token');
    sessionStorage.removeItem('bugbash_user');
    localStorage.removeItem('bugbash_token');
    localStorage.removeItem('bugbash_user');
    showToast('Signed out successfully.', 'info');
    setTimeout(() => {
        redirectToLogin();
    }, 400);
}

async function apiFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const baseUrl = window.BugBashConfig?.API_BASE_URL || (window.location.origin + '/api/v1');
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Session expired or unauthorized
            showToast('Your session has expired. Please sign in again.', 'warning');
            setTimeout(() => handleLogout(), 1200);
            return null;
        }

        return response;
    } catch (err) {
        console.error(`[BugBash API Error]: Failed request to ${url}`, err);
        showToast('Unable to connect to BugBash server. Please check your network.', 'error');
        return null;
    }
}

// ==============================================================================
// 2. User Profile Loading & Topbar Header
// ==============================================================================
let currentUser = null;

async function loadUserProfile() {
    const resp = await apiFetch('/users/me');
    if (!resp || !resp.ok) return;

    currentUser = await resp.json();

    // Populate Topbar
    const topbarUserName = document.getElementById('topbarUserName');
    if (topbarUserName) {
        const firstName = (currentUser.full_name || 'Candidate').split(' ')[0];
        topbarUserName.textContent = firstName;
    }

    const userDisplayName = document.getElementById('userDisplayName');
    if (userDisplayName) {
        userDisplayName.textContent = currentUser.full_name || 'Candidate';
    }

    const dropdownUserName = document.getElementById('dropdownUserName');
    if (dropdownUserName) dropdownUserName.textContent = currentUser.full_name || 'Candidate User';

    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    if (dropdownUserEmail) dropdownUserEmail.textContent = currentUser.email || '';

    // Initials Avatar
    const initials = getInitials(currentUser.full_name || 'CA');
    const userAvatarInitials = document.getElementById('userAvatarInitials');
    if (userAvatarInitials) userAvatarInitials.textContent = initials;

    // Profile Page Specific Elements
    const profileLargeAvatar = document.getElementById('profileLargeAvatar');
    if (profileLargeAvatar) profileLargeAvatar.textContent = initials;

    const profileCardFullName = document.getElementById('profileCardFullName');
    if (profileCardFullName) profileCardFullName.textContent = currentUser.full_name || 'Candidate Name';

    const profileCardCollege = document.getElementById('profileCardCollege');
    if (profileCardCollege) profileCardCollege.textContent = currentUser.college_name || 'BugBash Academy';

    const infoEmail = document.getElementById('infoEmail');
    if (infoEmail) infoEmail.textContent = currentUser.email || '';

    const infoPhone = document.getElementById('infoPhone');
    if (infoPhone) infoPhone.textContent = currentUser.phone_number || 'Not provided';

    const infoCreatedAt = document.getElementById('infoCreatedAt');
    if (infoCreatedAt) infoCreatedAt.textContent = currentUser.created_at || 'Recently';

    // Form inputs on Profile Page
    const profileFullNameInput = document.getElementById('profileFullName');
    if (profileFullNameInput) profileFullNameInput.value = currentUser.full_name || '';

    const profileEmailInput = document.getElementById('profileEmail');
    if (profileEmailInput) profileEmailInput.value = currentUser.email || '';

    const profilePhoneInput = document.getElementById('profilePhone');
    if (profilePhoneInput) profilePhoneInput.value = currentUser.phone_number || '';
}

function getInitials(name) {
    if (!name) return 'CA';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ==============================================================================
// 3. Dashboard Overview & Metric Cards (Section 3)
// ==============================================================================
async function loadDashboardSummary() {
    const resp = await apiFetch('/users/me/dashboard');
    if (!resp || !resp.ok) return;

    const data = await resp.json();

    // 4 Summary Cards
    const totalEl = document.getElementById('totalAssessmentsVal');
    if (totalEl) totalEl.textContent = data.total_assessments;

    const completedEl = document.getElementById('completedAssessmentsVal');
    if (completedEl) completedEl.textContent = data.completed_assessments;

    const completionRateSubtitle = document.getElementById('completionRateSubtitle');
    if (completionRateSubtitle) {
        completionRateSubtitle.textContent = `${data.completion_rate}% completion rate`;
    }

    const pendingEl = document.getElementById('pendingAssessmentsVal');
    if (pendingEl) pendingEl.textContent = data.pending_assessments;

    const avgEl = document.getElementById('averageScoreVal');
    if (avgEl) avgEl.textContent = `${data.average_score}%`;

    const sidebarPendingBadge = document.getElementById('sidebarPendingBadge');
    if (sidebarPendingBadge) sidebarPendingBadge.textContent = data.pending_assessments;

    // Overview Upcoming Assessments List
    renderOverviewAssessments(data.upcoming_assessments || []);

    // Recent Activity Timeline
    renderActivityTimeline(data.recent_activity || []);
}

function renderOverviewAssessments(items) {
    const container = document.getElementById('overviewAssessmentsList');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <p>No active assessments at this moment.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(a => `
        <div class="assessment-card" style="padding: 16px 18px;">
            <div class="card-top-tags">
                <span class="badge ${getDifficultyClass(a.difficulty)}">${a.difficulty}</span>
                <span class="badge badge-category">${escapeHtml(a.category)}</span>
                <span class="badge-status ${getStatusClass(a.status)}">${a.status}</span>
            </div>
            <h4 class="assessment-title" style="font-size: 15px; margin-bottom: 6px;">${escapeHtml(a.title)}</h4>
            <div class="assessment-meta-list" style="margin-bottom: 12px; padding-top: 8px;">
                <div class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>${a.duration_minutes} Mins</span>
                </div>
                <div class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${escapeHtml(a.deadline)}</span>
                </div>
            </div>
            <div>
                <button type="button" class="btn btn-primary btn-sm" style="width: 100%;" onclick="handleStartAssessment('${a.id}', '${escapeHtml(a.title)}')">
                    <span>${a.status === 'In Progress' ? 'Resume Assessment' : 'Start Assessment'}</span>
                </button>
            </div>
        </div>
    `).join('');
}

function renderActivityTimeline(items) {
    const container = document.getElementById('overviewActivityList');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                <p>No recent activity recorded yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(act => `
        <div class="activity-item">
            <div class="activity-icon-pill">
                ${getActivityIconSvg(act.icon || act.type)}
            </div>
            <div class="activity-content">
                <div class="activity-title">${escapeHtml(act.title)}</div>
                <div class="activity-desc">${escapeHtml(act.description)}</div>
                <div class="activity-time">${escapeHtml(act.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// ==============================================================================
// 4. My Assessments (Section 4)
// ==============================================================================
let allAssessments = [];
let currentAssessmentFilter = 'all';

async function loadMyAssessments() {
    const resp = await apiFetch('/users/me/assessments');
    if (!resp || !resp.ok) return;

    allAssessments = await resp.json();
    renderFilteredAssessments();
}

function renderFilteredAssessments() {
    const grid = document.getElementById('fullAssessmentsGrid');
    if (!grid) return;

    const filtered = allAssessments.filter(a => {
        if (currentAssessmentFilter === 'all') return true;
        return a.status.toLowerCase() === currentAssessmentFilter.toLowerCase();
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 12px;">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">No assessments match filter</h3>
                <p style="font-size: 13.5px; color: var(--text-muted);">Try selecting "All" to view all assessments assigned to your account.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(a => `
        <div class="assessment-card">
            <div>
                <div class="card-top-tags">
                    <span class="badge ${getDifficultyClass(a.difficulty)}">${a.difficulty}</span>
                    <span class="badge badge-category">${escapeHtml(a.category)}</span>
                    <span class="badge-status ${getStatusClass(a.status)}">${a.status}</span>
                </div>
                <h3 class="assessment-title">${escapeHtml(a.title)}</h3>
                <p class="assessment-desc">${escapeHtml(a.description)}</p>
            </div>

            <div>
                <div class="assessment-meta-list">
                    <div class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${a.duration_minutes} Mins</span>
                    </div>
                    <div class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${escapeHtml(a.deadline)}</span>
                    </div>
                </div>

                ${getAssessmentActionButton(a)}
            </div>
        </div>
    `).join('');
}

function getAssessmentActionButton(a) {
    if (a.status === 'Completed') {
        return `
            <button type="button" class="btn btn-secondary btn-sm" style="width: 100%;" onclick="openScorecardByAssessmentId('${a.id}')">
                <span>View Result Scorecard (${a.score || 94}%)</span>
            </button>
        `;
    }
    if (a.status === 'Upcoming') {
        return `
            <button type="button" class="btn btn-secondary btn-sm" style="width: 100%; opacity: 0.7;" disabled>
                <span>Opens on ${escapeHtml(a.start_date || 'Scheduled Date')}</span>
            </button>
        `;
    }
    if (a.status === 'Expired') {
        return `
            <button type="button" class="btn btn-secondary btn-sm" style="width: 100%; opacity: 0.6;" disabled>
                <span>Assessment Expired</span>
            </button>
        `;
    }

    return `
        <button type="button" class="btn btn-primary btn-sm" style="width: 100%;" onclick="handleStartAssessment('${a.id}', '${escapeHtml(a.title)}')">
            <span>${a.status === 'In Progress' ? 'Resume Assessment' : 'Start Assessment'}</span>
        </button>
    `;
}

function handleStartAssessment(id, title) {
    showToast(`Launching secure assessment workspace for: "${title}". Full proctored IDE launches in next stage!`, 'success');
}

// ==============================================================================
// 5. Practice Coding (Section 5)
// ==============================================================================
let allPracticeProblems = [];
let practiceFilterDiff = 'all';
let practiceFilterLang = 'all';
let practiceSearchQuery = '';

async function loadPracticeProblems() {
    const resp = await apiFetch('/practice/problems');
    if (!resp || !resp.ok) return;

    allPracticeProblems = await resp.json();
    renderFilteredPracticeProblems();
}

function renderFilteredPracticeProblems() {
    const grid = document.getElementById('practiceGrid');
    if (!grid) return;

    const filtered = allPracticeProblems.filter(p => {
        if (practiceFilterDiff !== 'all' && p.difficulty.toLowerCase() !== practiceFilterDiff.toLowerCase()) return false;
        if (practiceFilterLang !== 'all' && !p.languages.some(l => l.toLowerCase() === practiceFilterLang.toLowerCase())) return false;
        if (practiceSearchQuery) {
            const q = practiceSearchQuery.toLowerCase();
            const matchTitle = p.title.toLowerCase().includes(q);
            const matchCat = p.category.toLowerCase().includes(q);
            const matchTags = p.tags.some(t => t.toLowerCase().includes(q));
            if (!matchTitle && !matchCat && !matchTags) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                <p style="color: var(--text-muted); font-size: 14px;">No coding problems matched your filter criteria.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="practice-card">
            <div>
                <div class="card-top-tags">
                    <span class="badge ${getDifficultyClass(p.difficulty)}">${p.difficulty}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(p.category)}</span>
                    ${p.solved ? '<span class="badge badge-easy">✓ Solved</span>' : ''}
                </div>
                <h3 class="practice-title">${escapeHtml(p.title)}</h3>
                <div class="practice-tags">
                    ${p.tags.map(t => `<span class="practice-tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            </div>

            <div class="practice-footer">
                <span class="acceptance-rate">${p.acceptance_rate} Acceptance</span>
                <button type="button" class="btn btn-primary btn-sm" onclick="handleSolveProblem('${p.id}', '${escapeHtml(p.title)}')">
                    <span>Solve Challenge</span>
                </button>
            </div>
        </div>
    `).join('');
}

function handleSolveProblem(id, title) {
    showToast(`Launching code workspace for "${title}". Multi-language cloud compiler environment loaded!`, 'info');
}

// ==============================================================================
// 6. Results & Reports Table & Scorecards (Section 7)
// ==============================================================================
let allResults = [];

async function loadResults() {
    const resp = await apiFetch('/users/me/results');
    if (!resp || !resp.ok) return;

    allResults = await resp.json();
    renderResultsTable();
}

function renderResultsTable() {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;

    if (allResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 36px; color: var(--text-muted);">
                    No completed assessment results available yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allResults.map(r => `
        <tr>
            <td>
                <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(r.assessment_title)}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Verified Candidate Assessment</div>
            </td>
            <td style="color: var(--text-secondary);">${escapeHtml(r.completion_date)}</td>
            <td>
                <span style="font-weight: 700;">${r.score}</span>
                <span style="color: var(--text-muted);"> / ${r.max_score}</span>
            </td>
            <td>
                <span class="score-pill ${r.percentage >= 90 ? 'high' : (r.percentage >= 75 ? 'medium' : 'low')}">
                    ${r.percentage}%
                </span>
            </td>
            <td>
                <span class="badge ${r.percentage >= 90 ? 'badge-easy' : 'badge-medium'}">
                    ${escapeHtml(r.result_status)}
                </span>
            </td>
            <td style="text-align: right;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="openScorecardById('${r.id}')">
                    <span>View Scorecard</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function openScorecardById(resultId) {
    const result = allResults.find(r => r.id === resultId);
    if (!result) return;
    displayScorecardModal(result);
}

function openScorecardByAssessmentId(asmtId) {
    const result = allResults.find(r => r.assessment_id === asmtId);
    if (result) {
        displayScorecardModal(result);
    } else {
        // Fallback default result for completed test
        displayScorecardModal({
            assessment_title: "Verified Algorithmic Assessment",
            score: 94,
            percentage: 94.0,
            completion_date: "Nov 10, 2026",
            result_status: "Distinction",
            feedback: "Exceptional algorithmic efficiency and clean code structure. Passed all edge and stress cases.",
            metrics: {
                logic_correctness: 96,
                time_complexity: 92,
                space_efficiency: 95,
                code_quality: 93
            }
        });
    }
}

function displayScorecardModal(r) {
    const modal = document.getElementById('scorecardModal');
    if (!modal) return;

    document.getElementById('modalAssessmentTitle').textContent = r.assessment_title || 'Assessment Scorecard';
    document.getElementById('modalScoreDisplay').textContent = `${r.percentage || r.score}%`;
    document.getElementById('modalStatusBadge').textContent = r.result_status || 'Passed';
    document.getElementById('modalDateDisplay').textContent = r.completion_date || 'Recently';

    const metrics = r.metrics || {
        logic_correctness: 94,
        time_complexity: 90,
        space_efficiency: 92,
        code_quality: 91
    };

    document.getElementById('metricLogicVal').textContent = `${metrics.logic_correctness}%`;
    document.getElementById('metricLogicBar').style.width = `${metrics.logic_correctness}%`;

    document.getElementById('metricTimeVal').textContent = `${metrics.time_complexity}%`;
    document.getElementById('metricTimeBar').style.width = `${metrics.time_complexity}%`;

    document.getElementById('metricSpaceVal').textContent = `${metrics.space_efficiency}%`;
    document.getElementById('metricSpaceBar').style.width = `${metrics.space_efficiency}%`;

    document.getElementById('metricQualityVal').textContent = `${metrics.code_quality}%`;
    document.getElementById('metricQualityBar').style.width = `${metrics.code_quality}%`;

    document.getElementById('modalFeedbackText').textContent = r.feedback || 'High performance evaluation achieved.';

    modal.classList.add('active');
}

// ==============================================================================
// 7. Profile Page Forms (Section 8)
// ==============================================================================
function initProfilePageForms() {
    // 1. Update Profile Form
    const profileForm = document.getElementById('updateProfileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('profileFullName').value.trim();
            const phoneNumber = document.getElementById('profilePhone').value.trim();

            const btn = document.getElementById('btnSaveProfile');
            if (btn) btn.disabled = true;

            const resp = await apiFetch('/users/me/profile', {
                method: 'PUT',
                body: JSON.stringify({ full_name: fullName, phone_number: phoneNumber })
            });

            if (btn) btn.disabled = false;

            if (resp && resp.ok) {
                const updated = await resp.json();
                currentUser = updated;
                showToast('Profile information successfully updated.', 'success');
                await loadUserProfile();
            } else {
                const data = resp ? await resp.json().catch(() => ({})) : {};
                showToast(data.detail || 'Unable to update profile.', 'error');
            }
        });
    }

    // 2. Change Password Form
    const passwordForm = document.getElementById('changePasswordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                showToast('New password and confirmation do not match.', 'error');
                return;
            }

            const btn = document.getElementById('btnChangePassword');
            if (btn) btn.disabled = true;

            const resp = await apiFetch('/users/me/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmNewPassword
                })
            });

            if (btn) btn.disabled = false;

            if (resp && resp.ok) {
                showToast('Password changed successfully!', 'success');
                passwordForm.reset();
            } else {
                const data = resp ? await resp.json().catch(() => ({})) : {};
                showToast(data.detail || 'Failed to update password.', 'error');
            }
        });
    }
}

// ==============================================================================
// 8. Navigation, SPA Views & Interactive Controls
// ==============================================================================
function initDashboardViews() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
    const sections = {
        dashboard: document.getElementById('viewDashboard'),
        assessments: document.getElementById('viewAssessments'),
        practice: document.getElementById('viewPractice'),
        results: document.getElementById('viewResults')
    };

    function switchView(viewName) {
        if (!sections[viewName]) return;

        // Toggle active nav item
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Toggle sections
        Object.entries(sections).forEach(([key, section]) => {
            if (section) section.classList.toggle('active', key === viewName);
        });

        // Update URL hash
        window.location.hash = viewName;
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // Quick action buttons in hero
    const btnHeroPractice = document.getElementById('btnHeroPractice');
    if (btnHeroPractice) {
        btnHeroPractice.addEventListener('click', () => switchView('practice'));
    }

    const btnHeroAssessments = document.getElementById('btnHeroAssessments');
    if (btnHeroAssessments) {
        btnHeroAssessments.addEventListener('click', () => switchView('assessments'));
    }

    const linkViewAllAssessments = document.getElementById('linkViewAllAssessments');
    if (linkViewAllAssessments) {
        linkViewAllAssessments.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('assessments');
        });
    }

    // Filter pills on Assessments page
    const asmtFilters = document.querySelectorAll('#assessmentStatusFilters .filter-pill-btn');
    asmtFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            asmtFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAssessmentFilter = btn.dataset.status;
            renderFilteredAssessments();
        });
    });

    // Filter pills on Practice page
    const diffFilters = document.querySelectorAll('#practiceDifficultyFilters .filter-pill-btn');
    diffFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            diffFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            practiceFilterDiff = btn.dataset.difficulty;
            renderFilteredPracticeProblems();
        });
    });

    const langSelect = document.getElementById('practiceLangSelect');
    if (langSelect) {
        langSelect.addEventListener('change', () => {
            practiceFilterLang = langSelect.value;
            renderFilteredPracticeProblems();
        });
    }

    // Check initial hash
    if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (sections[hash]) switchView(hash);
    }
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('bugbash_sidebar_collapsed', sidebar.classList.contains('collapsed'));
        });

        // Restore preference
        if (localStorage.getItem('bugbash_sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
    }

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);
}

function initProfileDropdown() {
    const pill = document.getElementById('profilePillTrigger');
    const menu = document.getElementById('profileDropdownMenu');
    if (!pill || !menu) return;

    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !pill.contains(e.target)) {
            menu.classList.remove('show');
        }
    });
}

function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;

    const sunIcon = toggleBtn.querySelector('.icon-sun');
    const moonIcon = toggleBtn.querySelector('.icon-moon');

    function syncIcons() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (sunIcon && moonIcon) {
            sunIcon.style.display = currentTheme === 'dark' ? 'block' : 'none';
            moonIcon.style.display = currentTheme === 'dark' ? 'none' : 'block';
        }
    }

    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('bugbash_theme', newTheme);
        syncIcons();
    });

    syncIcons();
}

function initSearchHandler() {
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    // Keyboard shortcut Ctrl + K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });

    searchInput.addEventListener('input', (e) => {
        practiceSearchQuery = e.target.value.trim();
        renderFilteredPracticeProblems();
    });
}

function initModalHandlers() {
    const modal = document.getElementById('scorecardModal');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

// ==============================================================================
// 9. Toast Notifications
// ==============================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==============================================================================
// 10. Formatters & SVG Helpers
// ==============================================================================
function getDifficultyClass(diff) {
    switch ((diff || '').toLowerCase()) {
        case 'easy': return 'badge-easy';
        case 'medium': return 'badge-medium';
        case 'hard': return 'badge-hard';
        default: return 'badge-easy';
    }
}

function getStatusClass(status) {
    switch ((status || '').toLowerCase()) {
        case 'available': return 'available';
        case 'in progress': return 'inprogress';
        case 'upcoming': return 'upcoming';
        case 'completed': return 'completed';
        default: return 'available';
    }
}

function getActivityIconSvg(icon) {
    switch (icon) {
        case 'award':
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>';
        case 'check-circle':
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        case 'user':
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        case 'shield':
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
        case 'code':
        default:
            return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
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
