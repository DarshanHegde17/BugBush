/**
 * BugBash - Admin Results & Analytics Controller
 * Handles results listing, multi-filtering, pagination, metrics cards, and report export.
 */

(function () {
    'use strict';

    // State
    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        page: 1,
        limit: 15,
        totalPages: 1,
        totalResults: 0,
        filters: {
            search: '',
            assessment_id: '',
            pass_fail: '',
            sort_by: 'completion_date',
            sort_order: 'desc'
        },
        searchDebounceTimer: null
    };

    // Helper: Auth Headers
    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
        };
    }

    // Helper: Format initials
    function getInitials(name) {
        if (!name) return 'C';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }

    // Helper: Grade CSS class
    function getGradeClass(grade) {
        const g = (grade || '').toUpperCase();
        if (g.startsWith('A')) return 'a';
        if (g.startsWith('B')) return 'b';
        if (g.startsWith('C')) return 'c';
        return 'f';
    }

    // Check Auth
    function checkAuth() {
        if (!state.token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    // Fetch and Populate Statistics
    async function fetchStatistics() {
        try {
            const url = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results/statistics` : '/api/v1/admin/results/statistics';
            const res = await fetch(url, { headers: getHeaders() });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch results statistics');
            const data = await res.json();

            // Populate cards
            const totalCandEl = document.getElementById('statTotalCandidates');
            if (totalCandEl) totalCandEl.textContent = data.total_evaluated_candidates || 0;

            const totalCompEl = document.getElementById('statTotalCompleted');
            if (totalCompEl) totalCompEl.textContent = data.total_assessments_completed || 0;

            const avgScoreEl = document.getElementById('statAverageScore');
            if (avgScoreEl) avgScoreEl.textContent = `${data.average_score || 0}%`;

            const passRateEl = document.getElementById('statPassRate');
            if (passRateEl) passRateEl.textContent = `${data.pass_rate || 0}%`;

            const failRateEl = document.getElementById('statFailureRate');
            if (failRateEl) failRateEl.textContent = `${data.failure_rate || 0}%`;

            const pendingEl = document.getElementById('statPendingResults');
            if (pendingEl) pendingEl.textContent = data.pending_results || 0;
        } catch (err) {
            console.warn('Error fetching statistics:', err);
        }
    }

    // Populate Assessment Filter Dropdown
    async function loadAssessmentsFilter() {
        try {
            const selectEl = document.getElementById('filterAssessment');
            if (!selectEl) return;
            const url = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/assessments` : '/api/v1/admin/assessments';
            const res = await fetch(url, { headers: getHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            const list = data.assessments || data || [];

            let opts = '<option value="">All Assessments</option>';
            list.forEach(a => {
                opts += `<option value="${a.id}">${a.title}</option>`;
            });
            selectEl.innerHTML = opts;
        } catch (err) {
            console.warn('Error loading assessment filter:', err);
        }
    }

    // Fetch Results List
    async function fetchResults() {
        const tbody = document.getElementById('resultsTableBody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-secondary);">Loading evaluation records...</td></tr>`;

        try {
            const params = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                sort_by: state.filters.sort_by,
                sort_order: state.filters.sort_order
            });

            if (state.filters.search) params.append('search', state.filters.search);
            if (state.filters.assessment_id) params.append('assessment_id', state.filters.assessment_id);
            if (state.filters.pass_fail) params.append('pass_fail', state.filters.pass_fail);

            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results` : '/api/v1/admin/results';
            const res = await fetch(`${baseUrl}?${params.toString()}`, { headers: getHeaders() });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Failed to fetch results');
            const data = await res.json();

            state.totalPages = data.pages || 1;
            state.totalResults = data.total || 0;

            renderResultsTable(data.results || []);
            updatePaginationInfo();
        } catch (err) {
            console.error('Error fetching results:', err);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--results-danger);">Failed to load assessment results. Please retry.</td></tr>`;
        }
    }

    // Render Table Rows
    function renderResultsTable(results) {
        const tbody = document.getElementById('resultsTableBody');
        if (!tbody) return;

        if (!results || results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="results-empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            <p style="font-weight:600; margin-bottom:4px;">No evaluation results found</p>
                            <span style="font-size:12px;">Try adjusting your search queries or active filters.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        results.forEach(r => {
            const gradeCls = getGradeClass(r.grade);
            const isPass = (r.pass_fail_status || 'Pass').toLowerCase() === 'pass';
            const initials = getInitials(r.candidate_name);

            html += `
                <tr>
                    <td>
                        <div class="candidate-cell">
                            <div class="candidate-avatar">
                                ${r.candidate_avatar ? `<img src="${r.candidate_avatar}" alt="${r.candidate_name}">` : initials}
                            </div>
                            <div class="candidate-meta">
                                <a href="/admin/candidate-performance?candidate_id=${encodeURIComponent(r.candidate_id || r.candidate_email)}" class="candidate-name">
                                    ${r.candidate_name}
                                </a>
                                <span class="candidate-email">${r.candidate_email}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <a href="/admin/assessment-analytics?assessment_id=${encodeURIComponent(r.assessment_id)}" style="color:var(--text-primary); text-decoration:none; font-weight:600;">
                            ${r.assessment_title}
                        </a>
                    </td>
                    <td>
                        <div class="score-display">
                            <span class="score-main">${r.obtained_marks} / ${r.total_marks}</span>
                            <span class="score-percent">${r.percentage}%</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge-grade ${gradeCls}">${r.grade || 'N/A'}</span>
                    </td>
                    <td>
                        <span class="badge-status ${isPass ? 'pass' : 'fail'}">
                            ${isPass ? 'Pass' : 'Fail'}
                        </span>
                    </td>
                    <td>
                        <span style="color:var(--text-secondary); font-size:12px;">${r.completion_date}</span>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <a href="/admin/result-details?id=${r.id}" class="btn-icon-action" title="View Full Candidate Scorecard">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </a>
                            <a href="/admin/candidate-performance?candidate_id=${encodeURIComponent(r.candidate_id || r.candidate_email)}" class="btn-icon-action" title="Candidate Performance Trend">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </a>
                            <a href="/admin/assessment-analytics?assessment_id=${encodeURIComponent(r.assessment_id)}" class="btn-icon-action" title="Assessment Analytics">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="20" x2="18" y2="10"></line>
                                    <line x1="12" y1="20" x2="12" y2="4"></line>
                                    <line x1="6" y1="20" x2="6" y2="14"></line>
                                </svg>
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Pagination Controls
    function updatePaginationInfo() {
        const infoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('btnPrevPage');
        const nextBtn = document.getElementById('btnNextPage');

        if (infoEl) {
            const start = state.totalResults === 0 ? 0 : (state.page - 1) * state.limit + 1;
            const end = Math.min(state.page * state.limit, state.totalResults);
            infoEl.textContent = `Showing ${start}-${end} of ${state.totalResults} results`;
        }

        if (prevBtn) prevBtn.disabled = state.page <= 1;
        if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
    }

    // Export Reports
    async function handleExportReport(format = 'csv') {
        const btn = document.getElementById('btnExportResults');
        if (btn) btn.disabled = true;

        try {
            const url = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results/export` : '/api/v1/admin/results/export';
            const payload = {
                report_type: 'results',
                format: format,
                assessment_id: state.filters.assessment_id || null,
                filters: {
                    search: state.filters.search,
                    pass_fail: state.filters.pass_fail
                }
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Export generation failed');
            const data = await res.json();

            // Trigger file download
            if (data.download_url) {
                const downloadLink = document.createElement('a');
                downloadLink.href = data.download_url;
                downloadLink.download = data.filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        } catch (err) {
            alert('Failed to generate export report: ' + err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // Event Bindings
    function bindEvents() {
        // Search Input with Debounce
        const searchInput = document.getElementById('resultsSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(state.searchDebounceTimer);
                state.searchDebounceTimer = setTimeout(() => {
                    state.filters.search = e.target.value.trim();
                    state.page = 1;
                    fetchResults();
                }, 350);
            });
        }

        // Assessment Filter Dropdown
        const asmtSelect = document.getElementById('filterAssessment');
        if (asmtSelect) {
            asmtSelect.addEventListener('change', (e) => {
                state.filters.assessment_id = e.target.value;
                state.page = 1;
                fetchResults();
            });
        }

        // Pass/Fail Filter Dropdown
        const passFailSelect = document.getElementById('filterPassFail');
        if (passFailSelect) {
            passFailSelect.addEventListener('change', (e) => {
                state.filters.pass_fail = e.target.value;
                state.page = 1;
                fetchResults();
            });
        }

        // Reset Filters Button
        const btnReset = document.getElementById('btnResetFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (asmtSelect) asmtSelect.value = '';
                if (passFailSelect) passFailSelect.value = '';
                state.filters.search = '';
                state.filters.assessment_id = '';
                state.filters.pass_fail = '';
                state.page = 1;
                fetchResults();
            });
        }

        // Pagination Buttons
        const prevBtn = document.getElementById('btnPrevPage');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (state.page > 1) {
                    state.page--;
                    fetchResults();
                }
            });
        }

        const nextBtn = document.getElementById('btnNextPage');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (state.page < state.totalPages) {
                    state.page++;
                    fetchResults();
                }
            });
        }

        // Export Button
        const exportBtn = document.getElementById('btnExportResults');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => handleExportReport('csv'));
        }

        // Sidebar Toggle
        const sidebarToggle = document.getElementById('sidebarToggleBtn');
        const sidebar = document.getElementById('adminSidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    // Init
    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        bindEvents();
        fetchStatistics();
        loadAssessmentsFilter();
        fetchResults();
    });

})();
