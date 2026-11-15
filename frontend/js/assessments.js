/**
 * BugBash - My Assessments Page Controller
 * Handles live backend data fetching, dynamic filters, details modal,
 * and secure examination session initialization.
 */

(function () {
    'use strict';

    // Application State
    const state = {
        token: null,
        currentUser: null,
        assessments: [],
        statistics: null,
        activeStatusFilter: 'all',
        activeDifficultyFilter: 'all',
        activeCategoryFilter: 'all',
        searchQuery: '',
        selectedAssessment: null,
        isStartingExam: false
    };

    // DOM Elements
    const elements = {
        // Layout & Topbar
        dashboardSidebar: document.getElementById('dashboardSidebar'),
        sidebarCollapseBtn: document.getElementById('sidebarCollapseBtn'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        userMenuWrapper: document.getElementById('userMenuWrapper'),
        userMenuTrigger: document.getElementById('userMenuTrigger'),
        userDropdownPanel: document.getElementById('userDropdownPanel'),
        userDisplayName: document.getElementById('userDisplayName'),
        userAvatarInitials: document.getElementById('userAvatarInitials'),
        dropdownUserName: document.getElementById('dropdownUserName'),
        dropdownUserEmail: document.getElementById('dropdownUserEmail'),
        sidebarLogoutBtn: document.getElementById('sidebarLogoutBtn'),
        dropdownLogoutBtn: document.getElementById('dropdownLogoutBtn'),
        navAssessmentsBadge: document.getElementById('navAssessmentsBadge'),

        // Overview Metric Cards
        statTotalCount: document.getElementById('statTotalCount'),
        statAvailableCount: document.getElementById('statAvailableCount'),
        statUpcomingCount: document.getElementById('statUpcomingCount'),
        statCompletedCount: document.getElementById('statCompletedCount'),
        statExpiredCount: document.getElementById('statExpiredCount'),

        // Filter Tabs & Controls
        filterTabs: document.querySelectorAll('.filter-tab'),
        tabCountAll: document.getElementById('tabCountAll'),
        tabCountAvailable: document.getElementById('tabCountAvailable'),
        tabCountUpcoming: document.getElementById('tabCountUpcoming'),
        tabCountInProgress: document.getElementById('tabCountInProgress'),
        tabCountCompleted: document.getElementById('tabCountCompleted'),
        tabCountExpired: document.getElementById('tabCountExpired'),
        difficultyFilter: document.getElementById('difficultyFilter'),
        categoryFilter: document.getElementById('categoryFilter'),
        assessmentSearchInput: document.getElementById('assessmentSearchInput'),

        // Grid Container
        assessmentsGrid: document.getElementById('assessmentsGrid'),

        // Details Modal
        assessmentDetailsModal: document.getElementById('assessmentDetailsModal'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalDismissBtn: document.getElementById('modalDismissBtn'),
        modalStartBtn: document.getElementById('modalStartBtn'),
        modalStartBtnText: document.getElementById('modalStartBtnText'),
        modalCategoryBadge: document.getElementById('modalCategoryBadge'),
        modalStatusBadge: document.getElementById('modalStatusBadge'),
        modalAssessmentTitle: document.getElementById('modalAssessmentTitle'),
        modalAssessmentDesc: document.getElementById('modalAssessmentDesc'),
        modalDuration: document.getElementById('modalDuration'),
        modalTotalMarks: document.getElementById('modalTotalMarks'),
        modalAttempts: document.getElementById('modalAttempts'),
        modalDifficulty: document.getElementById('modalDifficulty'),
        modalStartDate: document.getElementById('modalStartDate'),
        modalDeadline: document.getElementById('modalDeadline'),
        modalQuestionsList: document.getElementById('modalQuestionsList'),
        modalLanguagesStack: document.getElementById('modalLanguagesStack'),
        modalRulesList: document.getElementById('modalRulesList'),
        confirmExamRules: document.getElementById('confirmExamRules'),
        confirmationBoxWrapper: document.getElementById('confirmationBoxWrapper'),

        // Toasts
        toastContainer: document.getElementById('toastContainer')
    };

    // =========================================================================
    // 1. Initialization & Authentication Check
    // =========================================================================
    function init() {
        // Resolve Auth Token
        state.token = localStorage.getItem('bb_auth_token') || sessionStorage.getItem('bb_auth_token');
        if (!state.token) {
            console.warn('[BugBash] No authorization token found. Redirecting to login.');
            window.location.href = '../login.html';
            return;
        }

        bindEvents();
        loadUserProfile();
        loadStatistics();
        fetchAssessments();
    }

    // =========================================================================
    // 2. Event Binding
    // =========================================================================
    function bindEvents() {
        // Sidebar Toggle
        if (elements.sidebarCollapseBtn) {
            elements.sidebarCollapseBtn.addEventListener('click', toggleSidebar);
        }
        if (elements.mobileMenuBtn) {
            elements.mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
        }
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);
        }

        // Profile Menu Toggle
        if (elements.userMenuTrigger) {
            elements.userMenuTrigger.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleUserMenu();
            });
        }
        document.addEventListener('click', function (e) {
            if (elements.userMenuWrapper && !elements.userMenuWrapper.contains(e.target)) {
                closeUserMenu();
            }
        });

        // Logout
        if (elements.sidebarLogoutBtn) {
            elements.sidebarLogoutBtn.addEventListener('click', handleLogout);
        }
        if (elements.dropdownLogoutBtn) {
            elements.dropdownLogoutBtn.addEventListener('click', handleLogout);
        }

        // Status Filter Tabs
        elements.filterTabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                elements.filterTabs.forEach(function (t) {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                state.activeStatusFilter = tab.getAttribute('data-status') || 'all';
                fetchAssessments();
            });
        });

        // Secondary Filters
        if (elements.difficultyFilter) {
            elements.difficultyFilter.addEventListener('change', function () {
                state.activeDifficultyFilter = this.value;
                fetchAssessments();
            });
        }
        if (elements.categoryFilter) {
            elements.categoryFilter.addEventListener('change', function () {
                state.activeCategoryFilter = this.value;
                fetchAssessments();
            });
        }
        if (elements.assessmentSearchInput) {
            let debounceTimer = null;
            elements.assessmentSearchInput.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    state.searchQuery = elements.assessmentSearchInput.value.trim();
                    fetchAssessments();
                }, 300);
            });
        }

        // Modal Controls
        if (elements.modalCloseBtn) {
            elements.modalCloseBtn.addEventListener('click', closeModal);
        }
        if (elements.modalDismissBtn) {
            elements.modalDismissBtn.addEventListener('click', closeModal);
        }
        if (elements.assessmentDetailsModal) {
            elements.assessmentDetailsModal.addEventListener('click', function (e) {
                if (e.target === elements.assessmentDetailsModal) {
                    closeModal();
                }
            });
        }
        if (elements.confirmExamRules) {
            elements.confirmExamRules.addEventListener('change', function () {
                updateModalStartButtonState();
            });
        }
        if (elements.modalStartBtn) {
            elements.modalStartBtn.addEventListener('click', handleModalStartAction);
        }
    }

    // =========================================================================
    // 3. API Communication
    // =========================================================================
    async function apiRequest(endpoint, options = {}) {
        const url = `${window.BUG_BASH_CONFIG ? window.BUG_BASH_CONFIG.API_BASE_URL : 'http://127.0.0.1:8000'}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            if (response.status === 401) {
                console.warn('[BugBash] Session expired or unauthorized. Redirecting to login.');
                localStorage.removeItem('bb_auth_token');
                sessionStorage.removeItem('bb_auth_token');
                window.location.href = '../login.html';
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'An unexpected error occurred.');
            }
            return data;
        } catch (err) {
            console.error(`[BugBash API Error] ${endpoint}:`, err);
            throw err;
        }
    }

    // Load User Profile
    async function loadUserProfile() {
        try {
            const profile = await apiRequest('/api/v1/users/me');
            if (profile) {
                state.currentUser = profile;
                renderUserProfile(profile);
            }
        } catch (err) {
            console.warn('[BugBash] Could not load user profile.');
        }
    }

    // Load Statistics Cards (5 Backend-Calculated Metrics)
    async function loadStatistics() {
        try {
            const stats = await apiRequest('/api/v1/users/me/assessments/statistics');
            if (stats) {
                state.statistics = stats;
                renderStatistics(stats);
            }
        } catch (err) {
            console.error('[BugBash] Error loading assessment statistics:', err);
        }
    }

    // Fetch Filtered Assessments
    async function fetchAssessments() {
        showGridLoading();
        try {
            const params = new URLSearchParams();
            if (state.activeStatusFilter && state.activeStatusFilter !== 'all') {
                params.append('status', state.activeStatusFilter);
            }
            if (state.activeDifficultyFilter && state.activeDifficultyFilter !== 'all') {
                params.append('difficulty', state.activeDifficultyFilter);
            }
            if (state.activeCategoryFilter && state.activeCategoryFilter !== 'all') {
                params.append('category', state.activeCategoryFilter);
            }
            if (state.searchQuery) {
                params.append('q', state.searchQuery);
            }

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const assessments = await apiRequest(`/api/v1/users/me/assessments${queryString}`);
            if (assessments) {
                state.assessments = assessments;
                renderAssessmentsGrid(assessments);
            }
        } catch (err) {
            renderGridError('Unable to load assessments. Please check your connection and try again.');
        }
    }

    // Fetch Full Assessment Details for Modal
    async function openAssessmentModal(assessmentId) {
        try {
            showToast('Loading assessment details...', 'info');
            const detail = await apiRequest(`/api/v1/assessments/${assessmentId}`);
            if (detail) {
                state.selectedAssessment = detail;
                renderAssessmentModal(detail);
                elements.assessmentDetailsModal.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        } catch (err) {
            showToast(err.message || 'Failed to open assessment details.', 'error');
        }
    }

    // Start Assessment Attempt
    async function startAssessmentAttempt(assessmentId) {
        if (state.isStartingExam) return;
        state.isStartingExam = true;

        if (elements.modalStartBtn) {
            elements.modalStartBtn.disabled = true;
            elements.modalStartBtnText.textContent = 'Initializing Session...';
        }

        try {
            const res = await apiRequest(`/api/v1/assessments/${assessmentId}/start`, {
                method: 'POST'
            });

            if (res && res.exam_url) {
                showToast(res.message || 'Exam initialized! Redirecting to workspace...', 'success');
                setTimeout(() => {
                    window.location.href = res.exam_url;
                }, 800);
            }
        } catch (err) {
            showToast(err.message || 'Unable to start assessment.', 'error');
            state.isStartingExam = false;
            updateModalStartButtonState();
        }
    }

    // =========================================================================
    // 4. UI Rendering Functions
    // =========================================================================
    function renderUserProfile(profile) {
        const name = profile.full_name || 'Candidate';
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'BB';

        if (elements.userDisplayName) elements.userDisplayName.textContent = name;
        if (elements.dropdownUserName) elements.dropdownUserName.textContent = name;
        if (elements.userAvatarInitials) elements.userAvatarInitials.textContent = initials;
        if (elements.dropdownUserEmail) elements.dropdownUserEmail.textContent = profile.email || '';
    }

    function renderStatistics(stats) {
        if (elements.statTotalCount) elements.statTotalCount.textContent = stats.total_assessments;
        if (elements.statAvailableCount) elements.statAvailableCount.textContent = stats.available_assessments;
        if (elements.statUpcomingCount) elements.statUpcomingCount.textContent = stats.upcoming_assessments;
        if (elements.statCompletedCount) elements.statCompletedCount.textContent = stats.completed_assessments;
        if (elements.statExpiredCount) elements.statExpiredCount.textContent = stats.expired_assessments;

        // Update tab count badges
        if (elements.tabCountAll) elements.tabCountAll.textContent = stats.total_assessments;
        if (elements.tabCountAvailable) elements.tabCountAvailable.textContent = stats.available_assessments;
        if (elements.tabCountUpcoming) elements.tabCountUpcoming.textContent = stats.upcoming_assessments;
        if (elements.tabCountInProgress) elements.tabCountInProgress.textContent = stats.in_progress_assessments || 0;
        if (elements.tabCountCompleted) elements.tabCountCompleted.textContent = stats.completed_assessments;
        if (elements.tabCountExpired) elements.tabCountExpired.textContent = stats.expired_assessments;

        // Sidebar badge
        if (elements.navAssessmentsBadge) {
            elements.navAssessmentsBadge.textContent = stats.available_assessments + (stats.in_progress_assessments || 0);
        }
    }

    function renderAssessmentsGrid(assessments) {
        if (!elements.assessmentsGrid) return;
        elements.assessmentsGrid.innerHTML = '';

        if (!assessments || assessments.length === 0) {
            elements.assessmentsGrid.innerHTML = `
                <div class="assessments-empty-state">
                    <div class="empty-icon-circle">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </div>
                    <h3 class="empty-title">No Assessments Found</h3>
                    <p class="empty-desc">No coding assessments match your current filter criteria. Try clearing search filters or selecting 'All' tab.</p>
                    <button type="button" class="btn btn-secondary" id="btnResetFilters">Clear All Filters</button>
                </div>
            `;
            const btnReset = document.getElementById('btnResetFilters');
            if (btnReset) {
                btnReset.addEventListener('click', resetFilters);
            }
            return;
        }

        assessments.forEach(item => {
            const card = createAssessmentCardElement(item);
            elements.assessmentsGrid.appendChild(card);
        });
    }

    function createAssessmentCardElement(item) {
        const card = document.createElement('article');
        card.className = 'assessment-card';
        card.setAttribute('data-id', item.id);

        const statusClass = (item.status || 'available').toLowerCase().replace(' ', '-');
        const qCount = item.questions_count || (item.questions ? item.questions.length : 3);
        const creator = item.creator_name || 'BugBash Academic Committee';

        // Action button configuration
        let actionBtnHtml = '';
        if (item.status === 'Available') {
            actionBtnHtml = `<button type="button" class="btn-action-start" data-action="start" data-id="${item.id}">Start Assessment</button>`;
        } else if (item.status === 'In Progress') {
            actionBtnHtml = `<button type="button" class="btn-action-start" data-action="start" data-id="${item.id}">Continue Exam</button>`;
        } else if (item.status === 'Upcoming') {
            actionBtnHtml = `<button type="button" class="btn-action-start upcoming-btn" disabled title="Scheduled to start on ${item.start_date}">Scheduled</button>`;
        } else if (item.status === 'Completed') {
            actionBtnHtml = `<a href="dashboard.html#results" class="btn-action-start completed-btn" title="View evaluated scorecard">View Results</a>`;
        } else if (item.status === 'Expired') {
            actionBtnHtml = `<button type="button" class="btn-action-start expired-btn" disabled title="Deadline passed on ${item.deadline}">Expired</button>`;
        }

        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <span class="card-category-badge">${escapeHtml(item.category || 'General')}</span>
                    <span class="card-status-badge ${statusClass}">
                        <span class="status-indicator-dot" style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>
                        ${escapeHtml(item.status)}
                    </span>
                </div>
                <h2 class="assessment-card-title">${escapeHtml(item.title)}</h2>
                <p class="assessment-card-desc">${escapeHtml(item.description || '')}</p>

                <div class="assessment-meta-list">
                    <div class="meta-item">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        <span><strong>${qCount}</strong> Questions</span>
                    </div>
                    <div class="meta-item">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span><strong>${escapeHtml(item.duration || '60 mins')}</strong></span>
                    </div>
                    <div class="meta-item">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        <span>Difficulty: <strong>${escapeHtml(item.difficulty || 'Medium')}</strong></span>
                    </div>
                    <div class="meta-item">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Due: <strong>${escapeHtml(item.deadline || 'No Deadline')}</strong></span>
                    </div>
                </div>

                <div class="assessment-creator-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>Assigned by <strong>${escapeHtml(creator)}</strong></span>
                </div>
            </div>

            <div class="card-actions-row">
                <button type="button" class="btn-details" data-action="details" data-id="${item.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Details</span>
                </button>
                ${actionBtnHtml}
            </div>
        `;

        // Bind Card Buttons
        const btnDetails = card.querySelector('[data-action="details"]');
        if (btnDetails) {
            btnDetails.addEventListener('click', () => openAssessmentModal(item.id));
        }

        const btnStart = card.querySelector('[data-action="start"]');
        if (btnStart) {
            btnStart.addEventListener('click', () => openAssessmentModal(item.id));
        }

        return card;
    }

    function renderAssessmentModal(detail) {
        const statusClass = (detail.status || 'available').toLowerCase().replace(' ', '-');

        if (elements.modalCategoryBadge) elements.modalCategoryBadge.textContent = detail.category || 'Assessment';
        if (elements.modalStatusBadge) {
            elements.modalStatusBadge.textContent = detail.status || 'Available';
            elements.modalStatusBadge.className = `card-status-badge ${statusClass}`;
        }
        if (elements.modalAssessmentTitle) elements.modalAssessmentTitle.textContent = detail.title;
        if (elements.modalAssessmentDesc) elements.modalAssessmentDesc.textContent = detail.description || '';

        // Spec Grid
        if (elements.modalDuration) elements.modalDuration.textContent = detail.duration || '60 mins';
        if (elements.modalTotalMarks) elements.modalTotalMarks.textContent = (detail.total_marks || 100) + ' Points';
        if (elements.modalAttempts) {
            const used = detail.attempts_used || 0;
            const allowed = detail.allowed_attempts || 1;
            elements.modalAttempts.textContent = `${used} of ${allowed} used`;
        }
        if (elements.modalDifficulty) elements.modalDifficulty.textContent = detail.difficulty || 'Medium';
        if (elements.modalStartDate) elements.modalStartDate.textContent = detail.start_date || 'Open';
        if (elements.modalDeadline) elements.modalDeadline.textContent = detail.deadline || 'No Deadline';

        // Questions List
        if (elements.modalQuestionsList) {
            elements.modalQuestionsList.innerHTML = '';
            const questions = detail.questions || [];
            if (questions.length === 0) {
                elements.modalQuestionsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Questions revealed upon starting assessment session.</p>';
            } else {
                questions.forEach(q => {
                    const row = document.createElement('div');
                    row.className = 'question-preview-row';
                    row.innerHTML = `
                        <div class="question-title-wrap">
                            <span class="question-order-pill">Q${q.order || 1}</span>
                            <span style="font-weight:600;color:var(--text-primary);">${escapeHtml(q.title)}</span>
                        </div>
                        <div class="question-tags">
                            <span style="font-size:12px;color:var(--text-muted);">${escapeHtml(q.difficulty)}</span>
                            <span class="badge-points">${q.points || 25} pts</span>
                        </div>
                    `;
                    elements.modalQuestionsList.appendChild(row);
                });
            }
        }

        // Allowed Languages
        if (elements.modalLanguagesStack) {
            elements.modalLanguagesStack.innerHTML = '';
            const langs = detail.allowed_languages || ['Python', 'C++', 'Java', 'JavaScript', 'Go'];
            langs.forEach(l => {
                const pill = document.createElement('span');
                pill.className = 'lang-pill';
                pill.textContent = l;
                elements.modalLanguagesStack.appendChild(pill);
            });
        }

        // Rules List
        if (elements.modalRulesList) {
            elements.modalRulesList.innerHTML = '';
            const rules = detail.rules || [
                'Full-screen lock is enforced. Tab-switching or minimizing is flagged and logged.',
                'Code execution happens inside isolated, non-networked sandboxes with 2.0s execution timeout.',
                'Plagiarism & duplicate logic detection algorithms compare submissions automatically.',
                'Submissions are final once confirmed or upon assessment countdown expiry.'
            ];
            rules.forEach(r => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>${escapeHtml(r)}</span>
                `;
                elements.modalRulesList.appendChild(li);
            });
        }

        // Reset Checkbox & Start Button State
        if (elements.confirmExamRules) {
            elements.confirmExamRules.checked = false;
        }
        updateModalStartButtonState();
    }

    function updateModalStartButtonState() {
        if (!state.selectedAssessment || !elements.modalStartBtn) return;
        const item = state.selectedAssessment;

        const isUpcoming = item.status === 'Upcoming';
        const isExpired = item.status === 'Expired';
        const isCompleted = item.status === 'Completed' && (item.attempts_used >= item.allowed_attempts);
        const isConfirmed = elements.confirmExamRules ? elements.confirmExamRules.checked : true;

        if (isUpcoming) {
            elements.modalStartBtn.disabled = true;
            elements.modalStartBtnText.textContent = 'Scheduled (Opens ' + item.start_date + ')';
            if (elements.confirmationBoxWrapper) elements.confirmationBoxWrapper.style.display = 'none';
        } else if (isExpired) {
            elements.modalStartBtn.disabled = true;
            elements.modalStartBtnText.textContent = 'Assessment Expired';
            if (elements.confirmationBoxWrapper) elements.confirmationBoxWrapper.style.display = 'none';
        } else if (isCompleted) {
            elements.modalStartBtn.disabled = true;
            elements.modalStartBtnText.textContent = 'Max Attempts Exhausted';
            if (elements.confirmationBoxWrapper) elements.confirmationBoxWrapper.style.display = 'none';
        } else {
            if (elements.confirmationBoxWrapper) elements.confirmationBoxWrapper.style.display = 'block';
            elements.modalStartBtn.disabled = !isConfirmed;
            elements.modalStartBtnText.textContent = item.status === 'In Progress' ? 'Continue Examination' : 'Start Examination';
        }
    }

    function handleModalStartAction() {
        if (!state.selectedAssessment) return;
        startAssessmentAttempt(state.selectedAssessment.id);
    }

    function closeModal() {
        if (elements.assessmentDetailsModal) {
            elements.assessmentDetailsModal.classList.remove('open');
            document.body.style.overflow = '';
        }
        state.selectedAssessment = null;
        state.isStartingExam = false;
    }

    function showGridLoading() {
        if (!elements.assessmentsGrid) return;
        elements.assessmentsGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    }

    function renderGridError(message) {
        if (!elements.assessmentsGrid) return;
        elements.assessmentsGrid.innerHTML = `
            <div class="assessments-empty-state">
                <div class="empty-icon-circle" style="color:var(--danger); background:var(--danger-light);">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3 class="empty-title">Error Loading Assessments</h3>
                <p class="empty-desc">${escapeHtml(message)}</p>
                <button type="button" class="btn btn-primary" id="btnRetryAssessments">Retry</button>
            </div>
        `;
        const btnRetry = document.getElementById('btnRetryAssessments');
        if (btnRetry) {
            btnRetry.addEventListener('click', fetchAssessments);
        }
    }

    function resetFilters() {
        state.activeStatusFilter = 'all';
        state.activeDifficultyFilter = 'all';
        state.activeCategoryFilter = 'all';
        state.searchQuery = '';

        if (elements.difficultyFilter) elements.difficultyFilter.value = 'all';
        if (elements.categoryFilter) elements.categoryFilter.value = 'all';
        if (elements.assessmentSearchInput) elements.assessmentSearchInput.value = '';

        elements.filterTabs.forEach((tab, index) => {
            if (index === 0) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        fetchAssessments();
    }

    // =========================================================================
    // 5. Sidebar & Navigation Helpers
    // =========================================================================
    function toggleSidebar() {
        if (!elements.dashboardSidebar) return;
        elements.dashboardSidebar.classList.toggle('collapsed');
        const isCollapsed = elements.dashboardSidebar.classList.contains('collapsed');
        localStorage.setItem('bb_sidebar_collapsed', isCollapsed ? '1' : '0');
    }

    function toggleMobileSidebar() {
        if (!elements.dashboardSidebar) return;
        elements.dashboardSidebar.classList.toggle('mobile-open');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.toggle('active');
        }
    }

    function closeMobileSidebar() {
        if (!elements.dashboardSidebar) return;
        elements.dashboardSidebar.classList.remove('mobile-open');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove('active');
        }
    }

    function toggleUserMenu() {
        if (!elements.userDropdownPanel) return;
        elements.userDropdownPanel.classList.toggle('open');
        const isOpen = elements.userDropdownPanel.classList.contains('open');
        if (elements.userMenuTrigger) {
            elements.userMenuTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    function closeUserMenu() {
        if (!elements.userDropdownPanel) return;
        elements.userDropdownPanel.classList.remove('open');
        if (elements.userMenuTrigger) {
            elements.userMenuTrigger.setAttribute('aria-expanded', 'false');
        }
    }

    function handleLogout() {
        localStorage.removeItem('bb_auth_token');
        sessionStorage.removeItem('bb_auth_token');
        window.location.href = '../login.html';
    }

    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3200);
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

    // Run on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
