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
        if (window.location.pathname.includes('/admin/') || document.getElementById('adminAssessmentsPage')) {
            initAdminAssessments();
            return;
        }

        // Resolve Candidate Auth Token
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

    // =========================================================================
    // Admin Assessment Management Controller
    // =========================================================================
    async function initAdminAssessments() {
        const token = sessionStorage.getItem('bugbash_admin_token') || localStorage.getItem('bugbash_admin_token');
        if (!token) {
            window.location.href = '/admin/login';
            return;
        }

        const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL) || 
                         (window.location.origin ? window.location.origin + '/api/v1' : 'http://127.0.0.1:8000/api/v1');

        async function adminApi(endpoint, options = {}) {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(options.headers || {})
                }
            });
            if (res.status === 401 || res.status === 403) {
                sessionStorage.removeItem('bugbash_admin_token');
                window.location.href = '/admin/login';
                throw new Error('Unauthorized');
            }
            return res;
        }

        // Setup Layout & Profile
        try {
            const meRes = await adminApi('/admin/auth/me');
            if (meRes.ok) {
                const adminUser = await meRes.json();
                const greetingName = document.getElementById('adminGreetingName');
                const pillName = document.getElementById('userPillName');
                const sidebarName = document.getElementById('sidebarAdminName');
                if (greetingName) greetingName.textContent = adminUser.full_name || 'Admin';
                if (pillName) pillName.textContent = adminUser.full_name || 'Admin';
                if (sidebarName) sidebarName.textContent = adminUser.full_name || 'Admin';
            }
        } catch (_) {}

        // Sidebar & Theme Toggles
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        const sidebar = document.getElementById('adminSidebar');
        const mainWrapper = document.getElementById('mainWrapper');
        if (toggleBtn && sidebar && mainWrapper) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainWrapper.classList.toggle('expanded');
            });
        }

        const themeToggle = document.getElementById('themeToggleBtn');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('bugbash_theme', next);
            });
        }

        // Logout
        document.querySelectorAll('.btn-admin-logout').forEach(b => {
            b.addEventListener('click', async (e) => {
                e.preventDefault();
                try { await adminApi('/admin/auth/logout', { method: 'POST' }); } catch (_) {}
                sessionStorage.removeItem('bugbash_admin_token');
                window.location.href = '/admin/login';
            });
        });

        // Admin Assessments State
        let currentStatusFilter = 'all';
        let currentSearchQuery = '';
        let currentTypeFilter = 'all';
        let currentPage = 1;
        const pageSize = 15;

        // Elements
        const tableBody = document.getElementById('adminAssessmentsTableBody');
        const searchInput = document.getElementById('adminAssessmentSearch');
        const filterPills = document.querySelectorAll('.filter-pill[data-status]');
        const typeSelect = document.getElementById('adminTypeFilter');
        const prevBtn = document.getElementById('btnPagePrev');
        const nextBtn = document.getElementById('btnPageNext');
        const pageIndicator = document.getElementById('pageIndicator');
        const showingCountEl = document.getElementById('showingCount');

        async function loadAssessments() {
            if (!tableBody) return;
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted, #64748b);">
                        <div style="display: inline-block; width: 24px; height: 24px; border: 2px solid #ff6b35; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                        <div style="margin-top: 8px;">Loading assessment records...</div>
                    </td>
                </tr>
            `;

            try {
                const offset = (currentPage - 1) * pageSize;
                let url = `/admin/assessments?status=${encodeURIComponent(currentStatusFilter)}&limit=${pageSize}&offset=${offset}`;
                if (currentSearchQuery) url += `&search=${encodeURIComponent(currentSearchQuery)}`;
                if (currentTypeFilter && currentTypeFilter !== 'all') url += `&type=${encodeURIComponent(currentTypeFilter)}`;

                const res = await adminApi(url);
                if (!res.ok) throw new Error('Failed to fetch assessments');

                const data = await res.json();
                const assessments = data.assessments || [];
                const stats = data.statistics || {};
                const totalCount = data.total_count || 0;

                // Update Metrics Cards
                updateMetric('totalAssessmentsCount', stats.total_assessments);
                updateMetric('publishedAssessmentsCount', stats.published_assessments);
                updateMetric('draftAssessmentsCount', stats.draft_assessments);
                updateMetric('scheduledAssessmentsCount', stats.scheduled_assessments);
                updateMetric('completedAssessmentsCount', stats.completed_assessments);

                // Update Pagination Controls
                if (showingCountEl) showingCountEl.textContent = `${Math.min(assessments.length, pageSize)} of ${totalCount}`;
                if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${Math.max(1, Math.ceil(totalCount / pageSize))}`;
                if (prevBtn) prevBtn.disabled = currentPage <= 1;
                if (nextBtn) nextBtn.disabled = currentPage >= Math.ceil(totalCount / pageSize);

                if (assessments.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 48px; color: var(--text-muted, #64748b);">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary, #f8fafc);">No assessments found</div>
                                <div style="font-size: 12px; margin-top: 4px;">Adjust your search or filters, or create a new assessment.</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tableBody.innerHTML = assessments.map(a => {
                    const st = a.status || 'Draft';
                    const badgeClass = `badge-${st.toLowerCase().replace(/\s+/g, '-')}`;
                    return `
                        <tr>
                            <td>
                                <div class="assessment-cell-info">
                                    <a href="/admin/assessment-details?id=${encodeURIComponent(a.id)}" class="assessment-cell-title">${escapeHtml(a.title)}</a>
                                    <span class="assessment-cell-id">${escapeHtml(a.id)} &bull; ${escapeHtml(a.difficulty || 'Medium')}</span>
                                </div>
                            </td>
                            <td><span style="font-weight: 500;">${escapeHtml(a.assessment_type || 'Coding Exam')}</span></td>
                            <td style="text-align: center;"><strong>${a.total_questions || 0}</strong></td>
                            <td>${a.duration_minutes || 60} mins</td>
                            <td><strong>${a.total_marks || 100}</strong> pts</td>
                            <td>${a.assigned_candidates_count || 0} candidates</td>
                            <td><span class="badge-status ${badgeClass}">${escapeHtml(st)}</span></td>
                            <td>${escapeHtml(a.created_date || 'Nov 2026')}</td>
                            <td>
                                <div class="table-actions">
                                    <a href="/admin/assessment-details?id=${encodeURIComponent(a.id)}" class="btn-tbl-action" title="View Details">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </a>
                                    ${a.can_edit ? `
                                        <a href="/admin/edit-assessment?id=${encodeURIComponent(a.id)}" class="btn-tbl-action" title="Edit Assessment">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </a>
                                    ` : ''}
                                    <button type="button" class="btn-tbl-action btn-menu-trigger" data-id="${encodeURIComponent(a.id)}" data-status="${escapeHtml(st)}" data-title="${escapeHtml(a.title)}" title="More Actions">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');

                // Wire action dropdowns
                wireActionMenuListeners();

            } catch (err) {
                console.error('[BugBash Admin] Failed to load assessments:', err);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 32px; color: #ef4444;">
                            Failed to load assessments from server. Please refresh or check connection.
                        </td>
                    </tr>
                `;
            }
        }

        function updateMetric(id, val) {
            const el = document.getElementById(id);
            if (el) el.textContent = val !== undefined && val !== null ? Number(val).toLocaleString() : '0';
        }

        function wireActionMenuListeners() {
            document.querySelectorAll('.btn-menu-trigger').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const aid = btn.getAttribute('data-id');
                    const st = btn.getAttribute('data-status');
                    const title = btn.getAttribute('data-title');

                    // Remove existing floating menus
                    document.querySelectorAll('.tbl-dropdown-menu').forEach(m => m.remove());

                    const menu = document.createElement('div');
                    menu.className = 'tbl-dropdown-menu active';
                    menu.innerHTML = `
                        <button type="button" class="tbl-dropdown-item" data-action="duplicate" data-id="${aid}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Duplicate Assessment
                        </button>
                        ${st === 'Draft' || st === 'Scheduled' ? `
                            <button type="button" class="tbl-dropdown-item" data-action="publish" data-id="${aid}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Publish Now
                            </button>
                        ` : ''}
                        ${st !== 'Archived' ? `
                            <button type="button" class="tbl-dropdown-item" data-action="archive" data-id="${aid}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
                        ` : ''}
                        ${st === 'Draft' || st === 'Archived' ? `
                            <button type="button" class="tbl-dropdown-item item-danger" data-action="delete" data-id="${aid}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                Delete
                            </button>
                        ` : ''}
                    `;

                    btn.parentElement.appendChild(menu);

                    menu.querySelectorAll('[data-action]').forEach(actionBtn => {
                        actionBtn.addEventListener('click', async () => {
                            const action = actionBtn.getAttribute('data-action');
                            menu.remove();
                            await handleAssessmentAction(action, aid, title);
                        });
                    });
                });
            });

            document.addEventListener('click', () => {
                document.querySelectorAll('.tbl-dropdown-menu').forEach(m => m.remove());
            });
        }

        async function handleAssessmentAction(action, aid, title) {
            if (action === 'duplicate') {
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(aid)}/duplicate`, { method: 'POST' });
                    if (res.ok) {
                        alert(`Assessment '${title}' cloned successfully!`);
                        loadAssessments();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to duplicate assessment.');
                    }
                } catch (e) {
                    alert('Network error while duplicating assessment.');
                }
            } else if (action === 'publish') {
                if (!confirm(`Are you sure you want to publish '${title}'? Candidates will be able to start attempts according to the schedule.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(aid)}/publish`, { method: 'POST' });
                    if (res.ok) {
                        alert(`Assessment '${title}' published successfully!`);
                        loadAssessments();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to publish assessment.');
                    }
                } catch (e) {
                    alert('Network error while publishing assessment.');
                }
            } else if (action === 'archive') {
                if (!confirm(`Archive assessment '${title}'? Candidates will no longer be able to start new attempts.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(aid)}/archive`, { method: 'POST' });
                    if (res.ok) {
                        alert(`Assessment '${title}' archived.`);
                        loadAssessments();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to archive assessment.');
                    }
                } catch (e) {
                    alert('Network error while archiving assessment.');
                }
            } else if (action === 'delete') {
                if (!confirm(`Permanently delete assessment '${title}'? This action cannot be undone.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(aid)}`, { method: 'DELETE' });
                    if (res.ok) {
                        alert(`Assessment '${title}' deleted.`);
                        loadAssessments();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to delete assessment.');
                    }
                } catch (e) {
                    alert('Network error while deleting assessment.');
                }
            }
        }

        // Filters & Search Event Listeners
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentStatusFilter = pill.getAttribute('data-status') || 'all';
                currentPage = 1;
                loadAssessments();
            });
        });

        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                currentTypeFilter = typeSelect.value;
                currentPage = 1;
                loadAssessments();
            });
        }

        let searchTimeout = null;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentSearchQuery = searchInput.value.trim();
                    currentPage = 1;
                    loadAssessments();
                }, 300);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadAssessments();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentPage++;
                loadAssessments();
            });
        }

        // Initial Load
        loadAssessments();
    }

    // Run on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
