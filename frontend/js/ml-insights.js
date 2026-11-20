/**
 * BugBash - Admin ML Insights Dashboard Controller
 * Telemetry counters, 10-stage ML evaluation pipeline status, and searchable analyses directory.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        page: 1,
        limit: 15,
        totalPages: 1,
        totalAnalyses: 0,
        filters: {
            search: '',
            language: '',
            status: ''
        },
        searchDebounceTimer: null
    };

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
        };
    }

    function checkAuth() {
        if (!state.token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    // 1. Fetch Summary Statistics
    async function fetchStatistics() {
        try {
            const url = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights/statistics` : '/api/v1/admin/ml-insights/statistics';
            const res = await fetch(url, { headers: getHeaders() });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch ML statistics');
            const data = await res.json();

            const totalEl = document.getElementById('statTotalAnalyses');
            if (totalEl) totalEl.textContent = data.total_code_analyses || 0;

            const successEl = document.getElementById('statSuccessAnalyses');
            if (successEl) successEl.textContent = data.successfully_analyzed || 0;

            const pendingEl = document.getElementById('statPendingAnalyses');
            if (pendingEl) pendingEl.textContent = data.pending_analyses || 0;

            const confEl = document.getElementById('statAvgConfidence');
            if (confEl) confEl.textContent = `${data.average_confidence || 0}%`;

            const optEl = document.getElementById('statOptimizations');
            if (optEl) optEl.textContent = data.optimizations_detected || 0;

            const failEl = document.getElementById('statFailures');
            if (failEl) failEl.textContent = data.analysis_failures || 0;
        } catch (err) {
            console.warn('Error fetching ML statistics:', err);
        }
    }

    // 2. Fetch 10-Stage Pipeline Status
    async function fetchPipelineStatus() {
        const container = document.getElementById('pipelineStagesContainer');
        if (!container) return;

        try {
            const url = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights/pipeline` : '/api/v1/admin/ml-insights/pipeline';
            const res = await fetch(url, { headers: getHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            const stages = data.stages || [];

            let html = '';
            stages.forEach(st => {
                const statusCls = (st.status || 'pending').toLowerCase();
                const isActive = statusCls === 'in_progress';

                html += `
                    <div class="pipeline-stage-box ${isActive ? 'active' : ''}">
                        <div class="stage-top-row">
                            <span class="stage-num-badge">${st.stage_number}</span>
                            <span class="stage-status-indicator ${statusCls}">
                                ${statusCls === 'completed' ? '&#10003; Done' : (statusCls === 'in_progress' ? '&bull; Running' : st.status)}
                            </span>
                        </div>
                        <div class="stage-name">${st.name}</div>
                        <div class="stage-details">${st.details || ''}</div>
                        ${st.execution_time_ms ? `<div class="stage-latency">${st.execution_time_ms}ms latency</div>` : ''}
                    </div>
                `;
            });

            container.innerHTML = html;

            const vTag = document.getElementById('pipelineVersionTag');
            if (vTag && data.pipeline_version) vTag.textContent = data.pipeline_version;
        } catch (err) {
            console.warn('Error fetching pipeline status:', err);
        }
    }

    // 3. Fetch Analyses Directory
    async function fetchAnalyses() {
        const tbody = document.getElementById('analysesTableBody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-secondary);">Loading ML evaluations...</td></tr>`;

        try {
            const params = new URLSearchParams({
                page: state.page,
                limit: state.limit
            });

            if (state.filters.search) params.append('search', state.filters.search);
            if (state.filters.language) params.append('language', state.filters.language);
            if (state.filters.status) params.append('status', state.filters.status);

            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights/analyses` : '/api/v1/admin/ml-insights/analyses';
            const res = await fetch(`${baseUrl}?${params.toString()}`, { headers: getHeaders() });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Failed to load analyses');
            const data = await res.json();

            state.totalPages = data.pages || 1;
            state.totalAnalyses = data.total || 0;

            renderAnalysesTable(data.analyses || []);
            updatePaginationInfo();
        } catch (err) {
            console.error('Error fetching analyses:', err);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ml-danger);">Failed to load ML analysis records.</td></tr>`;
        }
    }

    function renderAnalysesTable(items) {
        const tbody = document.getElementById('analysesTableBody');
        if (!tbody) return;

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:48px; color:var(--text-secondary);">
                        <p style="font-weight:600; margin-bottom:4px;">No code analyses matched your search criteria.</p>
                        <span style="font-size:12px;">Try clearing filters or search terms.</span>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        items.forEach(a => {
            const conf = a.algorithm_confidence || 0;
            const dotCls = conf >= 90 ? 'high' : (conf >= 75 ? 'med' : 'low');

            html += `
                <tr>
                    <td>
                        <a href="/admin/code-analysis?id=${encodeURIComponent(a.analysis_id)}" style="font-family:'JetBrains Mono', monospace; font-weight:700; color:var(--ml-primary); text-decoration:none;">
                            ${a.analysis_id}
                        </a>
                        ${a.has_corrections ? '<span class="badge-corrected" style="margin-left:6px;">CORRECTED</span>' : ''}
                    </td>
                    <td>
                        <div style="font-weight:600; color:var(--text-primary);">${a.candidate_name}</div>
                        <div style="font-size:11px; color:var(--text-secondary);">${a.candidate_email}</div>
                    </td>
                    <td>
                        <div style="font-weight:600;">${a.question_title}</div>
                        <div style="font-size:11px; color:var(--text-secondary);">${a.assessment_title}</div>
                    </td>
                    <td>
                        <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:700; text-transform:uppercase;">
                            ${a.language}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight:600; color:var(--text-primary);">${a.detected_algorithm || '<span style="opacity:0.5;">Pending</span>'}</div>
                        <div style="font-size:11px; color:var(--text-secondary);">${a.solution_approach || 'N/A'}</div>
                    </td>
                    <td>
                        <div class="confidence-meter">
                            <span class="confidence-dot ${dotCls}"></span>
                            <span>${conf > 0 ? `${conf}%` : 'N/A'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:700;">
                            <span style="color:#ff6b35;">${a.time_complexity}</span>
                            <span style="opacity:0.4; margin:0 2px;">/</span>
                            <span style="color:#10b981;">${a.space_complexity}</span>
                        </div>
                    </td>
                    <td>
                        <a href="/admin/code-analysis?id=${encodeURIComponent(a.analysis_id)}" class="btn-export-trigger" style="padding:4px 10px; font-size:11px;" title="Deep Code Logic & AST Inspection">
                            Inspect Logic &rarr;
                        </a>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function updatePaginationInfo() {
        const infoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('btnPrevPage');
        const nextBtn = document.getElementById('btnNextPage');

        if (infoEl) {
            const start = state.totalAnalyses === 0 ? 0 : (state.page - 1) * state.limit + 1;
            const end = Math.min(state.page * state.limit, state.totalAnalyses);
            infoEl.textContent = `Showing ${start}-${end} of ${state.totalAnalyses} analyses`;
        }

        if (prevBtn) prevBtn.disabled = state.page <= 1;
        if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
    }

    function bindEvents() {
        const searchInput = document.getElementById('analysesSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(state.searchDebounceTimer);
                state.searchDebounceTimer = setTimeout(() => {
                    state.filters.search = e.target.value.trim();
                    state.page = 1;
                    fetchAnalyses();
                }, 350);
            });
        }

        const langFilter = document.getElementById('filterLanguage');
        if (langFilter) {
            langFilter.addEventListener('change', (e) => {
                state.filters.language = e.target.value;
                state.page = 1;
                fetchAnalyses();
            });
        }

        const statusFilter = document.getElementById('filterStatus');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                state.filters.status = e.target.value;
                state.page = 1;
                fetchAnalyses();
            });
        }

        const prevBtn = document.getElementById('btnPrevPage');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (state.page > 1) {
                    state.page--;
                    fetchAnalyses();
                }
            });
        }

        const nextBtn = document.getElementById('btnNextPage');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (state.page < state.totalPages) {
                    state.page++;
                    fetchAnalyses();
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        bindEvents();
        fetchStatistics();
        fetchPipelineStatus();
        fetchAnalyses();
    });

})();
