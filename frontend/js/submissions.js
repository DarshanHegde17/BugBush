/**
 * BugBash - Enterprise Admin Submissions Management Controller
 * Handles live submissions directory, multi-filtering, pagination,
 * quick code inspection modals, and evaluation history timeline.
 */

(function () {
    'use strict';

    // State Management
    const state = {
        submissions: [],
        summary: {},
        total: 0,
        page: 1,
        limit: 15,
        pages: 1,
        sortBy: 'submitted_at',
        sortOrder: 'desc',
        searchQuery: '',
        assessmentFilter: 'all',
        languageFilter: 'all',
        questionTypeFilter: 'all',
        statusFilter: 'all',
        reviewFilter: 'all',
        startDate: '',
        endDate: '',
        isLoading: false,
        searchDebounceTimer: null
    };

    // DOM Elements Cache
    const elements = {};

    function initElements() {
        elements.totalCount = document.getElementById('statTotalSubmissions');
        elements.successCount = document.getElementById('statSuccessfulSubmissions');
        elements.failedCount = document.getElementById('statFailedSubmissions');
        elements.pendingCount = document.getElementById('statPendingEvaluation');
        elements.reviewCount = document.getElementById('statManualReviews');
        elements.errorCount = document.getElementById('statEvaluationErrors');

        elements.searchInput = document.getElementById('submissionSearchInput');
        elements.assessmentSelect = document.getElementById('filterAssessment');
        elements.languageSelect = document.getElementById('filterLanguage');
        elements.typeSelect = document.getElementById('filterType');
        elements.statusSelect = document.getElementById('filterStatus');
        elements.reviewSelect = document.getElementById('filterReview');
        elements.startDate = document.getElementById('filterStartDate');
        elements.endDate = document.getElementById('filterEndDate');
        elements.btnResetFilters = document.getElementById('btnResetFilters');

        elements.tableBody = document.getElementById('submissionsTableBody');
        elements.paginationInfo = document.getElementById('paginationInfoText');
        elements.btnPrevPage = document.getElementById('btnPrevPage');
        elements.btnNextPage = document.getElementById('btnNextPage');

        // Modals
        elements.codeModal = document.getElementById('quickCodeModal');
        elements.codeModalTitle = document.getElementById('codeModalTitle');
        elements.codeModalSubtitle = document.getElementById('codeModalSubtitle');
        elements.codeLangBadge = document.getElementById('codeLangBadge');
        elements.codeContent = document.getElementById('codeModalContent');
        elements.btnCopyCode = document.getElementById('btnCopyModalCode');
        elements.btnCloseCodeModal = document.getElementById('btnCloseCodeModal');

        elements.historyModal = document.getElementById('historyModal');
        elements.historyModalTitle = document.getElementById('historyModalTitle');
        elements.historyTimelineList = document.getElementById('historyTimelineList');
        elements.btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
    }

    // Auth Token Retrieval
    function getAdminToken() {
        return localStorage.getItem('bugbash_admin_token') || sessionStorage.getItem('bugbash_admin_token');
    }

    function checkAuth() {
        const token = getAdminToken();
        if (!token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    // Helper: Headers with Authorization
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAdminToken()}`
        };
    }

    // Fetch Submissions List & Summary Statistics
    async function fetchSubmissions() {
        if (!checkAuth()) return;
        state.isLoading = true;
        renderLoading();

        try {
            const params = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                sort_by: state.sortBy,
                sort_order: state.sortOrder
            });

            if (state.searchQuery) params.append('search', state.searchQuery);
            if (state.assessmentFilter !== 'all') params.append('assessment_id', state.assessmentFilter);
            if (state.languageFilter !== 'all') params.append('language', state.languageFilter);
            if (state.questionTypeFilter !== 'all') params.append('question_type', state.questionTypeFilter);
            if (state.statusFilter !== 'all') params.append('status', state.statusFilter);
            if (state.reviewFilter !== 'all') params.append('review_filter', state.reviewFilter);
            if (state.startDate) params.append('start_date', state.startDate);
            if (state.endDate) params.append('end_date', state.endDate);

            const res = await fetch(`/api/v1/admin/submissions?${params.toString()}`, {
                headers: getAuthHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) {
                throw new Error(`Failed to load submissions: HTTP ${res.status}`);
            }

            const data = await res.json();
            state.submissions = data.submissions || [];
            state.summary = data.summary || {};
            state.total = data.total || 0;
            state.pages = data.pages || 1;

            updateSummaryCards(state.summary);
            renderTable(state.submissions);
            updatePagination();
        } catch (err) {
            console.error('Error fetching submissions:', err);
            renderError(err.message);
        } finally {
            state.isLoading = false;
        }
    }

    // Update Top Metric Counters
    function updateSummaryCards(summary) {
        if (elements.totalCount) elements.totalCount.textContent = (summary.total_submissions ?? 0).toLocaleString();
        if (elements.successCount) elements.successCount.textContent = (summary.successful_submissions ?? 0).toLocaleString();
        if (elements.failedCount) elements.failedCount.textContent = (summary.failed_submissions ?? 0).toLocaleString();
        if (elements.pendingCount) elements.pendingCount.textContent = (summary.pending_evaluation ?? 0).toLocaleString();
        if (elements.reviewCount) elements.reviewCount.textContent = (summary.manual_reviews_required ?? 0).toLocaleString();
        if (elements.errorCount) elements.errorCount.textContent = (summary.evaluation_errors ?? 0).toLocaleString();
    }

    // Render Table Rows
    function renderTable(items) {
        if (!elements.tableBody) return;

        if (items.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="10">
                        <div class="state-container">
                            <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <div class="empty-title">No Submissions Found</div>
                            <div class="empty-desc">No candidate submissions match your current search and filter criteria.</div>
                            <button type="button" class="btn-filter-reset" onclick="window.__resetSubmissionsFilters()">Clear All Filters</button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const rowsHtml = items.map(sub => {
            const statusClass = getStatusClass(sub.evaluation_status);
            const formattedDate = formatDate(sub.submitted_at);
            const scoreDisplay = `${sub.score}/${sub.max_score}`;
            const isFullScore = sub.score >= sub.max_score && sub.max_score > 0;
            const isZeroScore = sub.score === 0;
            const scoreClass = isFullScore ? 'full' : (isZeroScore ? 'zero' : '');

            return `
                <tr data-sub-id="${escapeHtml(sub.id)}">
                    <td class="col-sub-id">
                        <a href="/admin/submission-details?id=${encodeURIComponent(sub.id)}" style="color: inherit; text-decoration: none;">
                            ${escapeHtml(sub.id)}
                        </a>
                    </td>
                    <td>
                        <div class="candidate-cell">
                            <span class="candidate-name">${escapeHtml(sub.candidate_name)}</span>
                            <span class="candidate-email">${escapeHtml(sub.candidate_email)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="assessment-cell">
                            <span class="assessment-title-text" title="${escapeHtml(sub.assessment_title || 'N/A')}">
                                ${escapeHtml(sub.assessment_title || 'General Assessment')}
                            </span>
                        </div>
                    </td>
                    <td>
                        <span class="question-title-text" title="${escapeHtml(sub.question_title)}">
                            ${escapeHtml(sub.question_title)}
                        </span>
                    </td>
                    <td>
                        ${sub.language ? `<span class="badge-lang">${escapeHtml(sub.language)}</span>` : '<span style="color:var(--text-muted); font-size:0.8rem;">MCQ</span>'}
                    </td>
                    <td style="white-space: nowrap; font-size: 0.8rem; color: var(--text-muted);">
                        ${formattedDate}
                    </td>
                    <td>
                        <span class="tests-passed-text">${sub.passed_test_cases}/${sub.total_test_cases}</span>
                    </td>
                    <td>
                        <span class="score-pill ${scoreClass}">${scoreDisplay}</span>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">
                            ${escapeHtml(sub.evaluation_status)}
                        </span>
                        ${sub.review_required && !sub.is_reviewed ? `<span class="status-pill reviewed" style="margin-top:4px; display:inline-block; font-size:0.68rem; padding:0.15rem 0.5rem;" title="Flagged for manual review">Needs Review</span>` : ''}
                    </td>
                    <td>
                        <div class="table-actions">
                            <a href="/admin/submission-details?id=${encodeURIComponent(sub.id)}" class="btn-table-action" title="View Full Details">
                                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </a>
                            ${sub.has_code ? `
                            <button type="button" class="btn-table-action" title="Quick Code View" onclick="window.__openQuickCode('${escapeHtml(sub.id)}')">
                                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <polyline points="16 18 22 12 16 6"></polyline>
                                    <polyline points="8 6 2 12 8 18"></polyline>
                                </svg>
                            </button>
                            ` : ''}
                            <a href="/admin/manual-review?id=${encodeURIComponent(sub.id)}" class="btn-table-action ${sub.review_required && !sub.is_reviewed ? 'review-alert' : ''}" title="Manual Review & Score Adjustment">
                                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </a>
                            <button type="button" class="btn-table-action" title="Evaluation History" onclick="window.__openQuickHistory('${escapeHtml(sub.id)}')">
                                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        elements.tableBody.innerHTML = rowsHtml;
    }

    // Status Pill Class Helper
    function getStatusClass(statusStr) {
        if (!statusStr) return 'pending';
        const s = statusStr.toLowerCase();
        if (s.includes('accepted')) return 'accepted';
        if (s.includes('wrong')) return 'wrong-answer';
        if (s.includes('time limit')) return 'time-limit-exceeded';
        if (s.includes('compilation')) return 'compilation-error';
        if (s.includes('runtime')) return 'runtime-error';
        if (s.includes('error')) return 'error';
        return 'pending';
    }

    function formatDate(isoStr) {
        if (!isoStr) return 'N/A';
        try {
            const dt = new Date(isoStr);
            return dt.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoStr;
        }
    }

    function renderLoading() {
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="10">
                        <div class="state-container">
                            <div class="state-spinner"></div>
                            <div style="font-weight:600; color:var(--text-secondary);">Loading Submissions Telemetry...</div>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    function renderError(msg) {
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="10">
                        <div class="state-container">
                            <svg class="empty-icon" style="color:var(--danger-red);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <div class="empty-title">Error Loading Submissions</div>
                            <div class="empty-desc">${escapeHtml(msg)}</div>
                            <button type="button" class="btn-filter-reset" onclick="location.reload()">Retry</button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    function updatePagination() {
        if (elements.paginationInfo) {
            const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
            const end = Math.min(state.page * state.limit, state.total);
            elements.paginationInfo.textContent = `Showing ${start}-${end} of ${state.total} submissions (Page ${state.page} of ${state.pages})`;
        }
        if (elements.btnPrevPage) elements.btnPrevPage.disabled = state.page <= 1;
        if (elements.btnNextPage) elements.btnNextPage.disabled = state.page >= state.pages;
    }

    // Modal Operations
    window.__openQuickCode = async function (subId) {
        if (!elements.codeModal) return;
        elements.codeModalTitle.textContent = `Submission Code (${subId})`;
        elements.codeModalSubtitle.textContent = 'Loading source code...';
        elements.codeContent.textContent = 'Fetching submitted code from secure sandbox...';
        elements.codeModal.classList.add('active');

        try {
            const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(subId)}/code`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Could not retrieve submission code.');
            const data = await res.json();
            elements.codeLangBadge.textContent = data.language || 'Code';
            elements.codeModalSubtitle.textContent = `Language: ${data.language}`;
            elements.codeContent.textContent = data.code || '// No code provided in this submission.';
        } catch (err) {
            elements.codeContent.textContent = `Error: ${err.message}`;
        }
    };

    window.__openQuickHistory = async function (subId) {
        if (!elements.historyModal) return;
        elements.historyModalTitle.textContent = `Evaluation History & Audit (${subId})`;
        elements.historyTimelineList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">Loading immutable evaluation timeline...</div>';
        elements.historyModal.classList.add('active');

        try {
            const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(subId)}/evaluation-history`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Could not retrieve evaluation history.');
            const list = await res.json();

            if (!list || list.length === 0) {
                elements.historyTimelineList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No evaluation history entries recorded.</div>';
                return;
            }

            elements.historyTimelineList.innerHTML = list.map(h => `
                <div class="history-item">
                    <div class="history-dot"></div>
                    <div class="history-header">
                        <span class="history-action-title">${escapeHtml(h.action)}</span>
                        <span class="history-time-stamp">${formatDate(h.timestamp)}</span>
                    </div>
                    <div class="history-actor-text">Actor: <strong>${escapeHtml(h.actor || 'System')}</strong> | Score: <strong>${h.score} pts</strong> | Status: <strong>${escapeHtml(h.execution_status)}</strong></div>
                    ${h.notes ? `<div class="history-notes-box">${escapeHtml(h.notes)}</div>` : ''}
                </div>
            `).join('');
        } catch (err) {
            elements.historyTimelineList.innerHTML = `<div style="color:var(--danger-red); font-size:0.85rem;">Error: ${escapeHtml(err.message)}</div>`;
        }
    };

    function closeModals() {
        if (elements.codeModal) elements.codeModal.classList.remove('active');
        if (elements.historyModal) elements.historyModal.classList.remove('active');
    }

    window.__resetSubmissionsFilters = function () {
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.assessmentSelect) elements.assessmentSelect.value = 'all';
        if (elements.languageSelect) elements.languageSelect.value = 'all';
        if (elements.typeSelect) elements.typeSelect.value = 'all';
        if (elements.statusSelect) elements.statusSelect.value = 'all';
        if (elements.reviewSelect) elements.reviewSelect.value = 'all';
        if (elements.startDate) elements.startDate.value = '';
        if (elements.endDate) elements.endDate.value = '';

        state.searchQuery = '';
        state.assessmentFilter = 'all';
        state.languageFilter = 'all';
        state.questionTypeFilter = 'all';
        state.statusFilter = 'all';
        state.reviewFilter = 'all';
        state.startDate = '';
        state.endDate = '';
        state.page = 1;
        fetchSubmissions();
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Attach Event Listeners
    function setupEventListeners() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(state.searchDebounceTimer);
                state.searchDebounceTimer = setTimeout(() => {
                    state.searchQuery = e.target.value.trim();
                    state.page = 1;
                    fetchSubmissions();
                }, 350);
            });
        }

        const handleSelectChange = () => {
            state.assessmentFilter = elements.assessmentSelect ? elements.assessmentSelect.value : 'all';
            state.languageFilter = elements.languageSelect ? elements.languageSelect.value : 'all';
            state.questionTypeFilter = elements.typeSelect ? elements.typeSelect.value : 'all';
            state.statusFilter = elements.statusSelect ? elements.statusSelect.value : 'all';
            state.reviewFilter = elements.reviewSelect ? elements.reviewSelect.value : 'all';
            state.startDate = elements.startDate ? elements.startDate.value : '';
            state.endDate = elements.endDate ? elements.endDate.value : '';
            state.page = 1;
            fetchSubmissions();
        };

        if (elements.assessmentSelect) elements.assessmentSelect.addEventListener('change', handleSelectChange);
        if (elements.languageSelect) elements.languageSelect.addEventListener('change', handleSelectChange);
        if (elements.typeSelect) elements.typeSelect.addEventListener('change', handleSelectChange);
        if (elements.statusSelect) elements.statusSelect.addEventListener('change', handleSelectChange);
        if (elements.reviewSelect) elements.reviewSelect.addEventListener('change', handleSelectChange);
        if (elements.startDate) elements.startDate.addEventListener('change', handleSelectChange);
        if (elements.endDate) elements.endDate.addEventListener('change', handleSelectChange);
        if (elements.btnResetFilters) elements.btnResetFilters.addEventListener('click', window.__resetSubmissionsFilters);

        if (elements.btnPrevPage) {
            elements.btnPrevPage.addEventListener('click', () => {
                if (state.page > 1) {
                    state.page--;
                    fetchSubmissions();
                }
            });
        }

        if (elements.btnNextPage) {
            elements.btnNextPage.addEventListener('click', () => {
                if (state.page < state.pages) {
                    state.page++;
                    fetchSubmissions();
                }
            });
        }

        // Modal Close handlers
        if (elements.btnCloseCodeModal) elements.btnCloseCodeModal.addEventListener('click', closeModals);
        if (elements.btnCloseHistoryModal) elements.btnCloseHistoryModal.addEventListener('click', closeModals);
        if (elements.codeModal) {
            elements.codeModal.addEventListener('click', (e) => {
                if (e.target === elements.codeModal) closeModals();
            });
        }
        if (elements.historyModal) {
            elements.historyModal.addEventListener('click', (e) => {
                if (e.target === elements.historyModal) closeModals();
            });
        }

        if (elements.btnCopyCode) {
            elements.btnCopyCode.addEventListener('click', () => {
                const code = elements.codeContent ? elements.codeContent.textContent : '';
                navigator.clipboard.writeText(code).then(() => {
                    const originalText = elements.btnCopyCode.innerHTML;
                    elements.btnCopyCode.innerHTML = '<span>&#10003; Copied!</span>';
                    setTimeout(() => { elements.btnCopyCode.innerHTML = originalText; }, 2000);
                });
            });
        }

        // Table column sorting
        document.querySelectorAll('.submissions-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.getAttribute('data-sort');
                if (state.sortBy === sortField) {
                    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortBy = sortField;
                    state.sortOrder = 'desc';
                }
                fetchSubmissions();
            });
        });
    }

    // Populate Assessments Dropdown dynamically
    async function loadAssessmentsCatalog() {
        if (!elements.assessmentSelect) return;
        try {
            const res = await fetch('/api/v1/admin/assessments', {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                const assessments = data.assessments || [];
                assessments.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.id;
                    opt.textContent = a.title;
                    elements.assessmentSelect.appendChild(opt);
                });
            }
        } catch {
            // Non-critical dropdown population
        }
    }

    // Initialization
    document.addEventListener('DOMContentLoaded', () => {
        initElements();
        setupEventListeners();
        loadAssessmentsCatalog();
        fetchSubmissions();
    });
})();
