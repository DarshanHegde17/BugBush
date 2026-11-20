/**
 * BugBash - Admin Assessment Analytics Controller
 * Visualizes score distributions, pass/fail ratios, question difficulty telemetry, and leaderboards.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        assessmentId: null
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

    async function loadAssessmentAnalytics() {
        const urlParams = new URLSearchParams(window.location.search);
        state.assessmentId = urlParams.get('assessment_id') || urlParams.get('id');

        if (!state.assessmentId) {
            // Pick default or alert
            state.assessmentId = 'asmt-101';
        }

        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results` : '/api/v1/admin/results';
            const res = await fetch(`${baseUrl}/assessment/${encodeURIComponent(state.assessmentId)}/analytics`, {
                headers: getHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Analytics data unavailable for this assessment');
            const data = await res.json();
            renderAnalytics(data);
            loadLeaderboard(state.assessmentId);
        } catch (err) {
            console.error('Error loading analytics:', err);
            const container = document.getElementById('analyticsMainContent');
            if (container) {
                container.innerHTML = `
                    <div style="padding:48px; text-align:center; color:var(--results-danger);">
                        <h2>Failed to Load Assessment Analytics</h2>
                        <p>${err.message}</p>
                        <a href="/admin/results" class="btn-export-trigger" style="margin-top:16px;">Back to Results</a>
                    </div>
                `;
            }
        }
    }

    function renderAnalytics(data) {
        // Assessment Header
        const titleEl = document.getElementById('assessmentTitle');
        if (titleEl) titleEl.textContent = data.assessment_title || 'Assessment Analytics';

        const idEl = document.getElementById('assessmentIdTag');
        if (idEl) idEl.textContent = `ID: ${data.assessment_id}`;

        const assignedEl = document.getElementById('statAssigned');
        if (assignedEl) assignedEl.textContent = data.total_assigned || 0;

        const startedEl = document.getElementById('statStarted');
        if (startedEl) startedEl.textContent = data.started || 0;

        const completedEl = document.getElementById('statCompleted');
        if (completedEl) completedEl.textContent = data.completed || 0;

        const completionRateEl = document.getElementById('statCompletionRate');
        if (completionRateEl) completionRateEl.textContent = `${data.completion_rate || 0}%`;

        // Metric Cards
        const avgScoreEl = document.getElementById('metricAvgScore');
        if (avgScoreEl) avgScoreEl.textContent = `${data.average_score || 0}%`;

        const highScoreEl = document.getElementById('metricHighScore');
        if (highScoreEl) highScoreEl.textContent = `${data.highest_score || 0}%`;

        const lowScoreEl = document.getElementById('metricLowScore');
        if (lowScoreEl) lowScoreEl.textContent = `${data.lowest_score || 0}%`;

        const passPctEl = document.getElementById('metricPassPct');
        if (passPctEl) passPctEl.textContent = `${data.pass_percentage || 0}%`;

        const failPctEl = document.getElementById('metricFailPct');
        if (failPctEl) failPctEl.textContent = `${data.failure_percentage || 0}%`;

        // 1. Score Distribution Chart
        if (window.ResultCharts) {
            window.ResultCharts.renderScoreDistribution('scoreDistributionChart', data.score_distribution || {});
        }

        // 2. Pass vs Fail Donut Chart
        if (window.ResultCharts) {
            const passDist = data.pass_fail_distribution || {};
            const passCount = passDist['Pass'] || 0;
            const failCount = passDist['Fail'] || 0;
            window.ResultCharts.renderPassFailDonut('passFailDonutChart', passCount, failCount);
        }

        // 3. Question Performance & Health Indicators Table
        const qTbody = document.getElementById('questionsAnalyticsBody');
        if (qTbody) {
            const questions = data.question_averages || [];
            if (questions.length === 0) {
                qTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-secondary);">No question-level telemetry recorded yet.</td></tr>`;
            } else {
                let html = '';
                questions.forEach((q, idx) => {
                    const healthCls = (q.health_indicator || 'healthy').toLowerCase().replace(/\s+/g, '-');
                    html += `
                        <tr>
                            <td style="font-weight:700; color:var(--text-secondary); width:40px;">#${idx + 1}</td>
                            <td>
                                <span style="font-weight:600; color:var(--text-primary);">${q.title}</span>
                                <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">${q.difficulty || 'Medium'}</div>
                            </td>
                            <td>
                                <span style="font-weight:700;">${q.average_score}</span> / ${q.max_points}
                            </td>
                            <td>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,0.08); overflow:hidden;">
                                        <div style="height:100%; width:${q.pass_percentage}%; background:#10b981;"></div>
                                    </div>
                                    <span style="font-size:12px; font-weight:700; color:#10b981;">${q.pass_percentage}%</span>
                                </div>
                            </td>
                            <td>
                                <span class="health-badge ${healthCls}">${q.health_indicator}</span>
                            </td>
                        </tr>
                    `;
                });
                qTbody.innerHTML = html;
            }
        }

        // 4. Difficulty Breakdown
        if (window.ResultCharts && data.difficulty_performance) {
            const diffItems = [];
            const diffMap = data.difficulty_performance;
            if (diffMap['Easy']) diffItems.push({ label: 'Easy Questions', percentage: diffMap['Easy'].avg_score || 0, count: diffMap['Easy'].count, color: '#10b981' });
            if (diffMap['Medium']) diffItems.push({ label: 'Medium Questions', percentage: diffMap['Medium'].avg_score || 0, count: diffMap['Medium'].count, color: '#f59e0b' });
            if (diffMap['Hard']) diffItems.push({ label: 'Hard Questions', percentage: diffMap['Hard'].avg_score || 0, count: diffMap['Hard'].count, color: '#ef4444' });
            window.ResultCharts.renderHorizontalBars('difficultyPerformanceChart', diffItems);
        }

        // 5. Language Breakdown
        if (window.ResultCharts && data.language_performance) {
            const langItems = [];
            for (const [lang, info] of Object.entries(data.language_performance)) {
                langItems.push({
                    label: lang.toUpperCase(),
                    percentage: info.avg_score || 0,
                    count: info.submissions,
                    color: '#ff6b35'
                });
            }
            window.ResultCharts.renderHorizontalBars('languagePerformanceChart', langItems);
        }
    }

    async function loadLeaderboard(assessmentId) {
        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results` : '/api/v1/admin/results';
            const res = await fetch(`${baseUrl}/rankings?assessment_id=${encodeURIComponent(assessmentId)}&limit=10`, {
                headers: getHeaders()
            });

            if (!res.ok) return;
            const rankings = await res.json();
            const tbody = document.getElementById('leaderboardBody');
            if (!tbody) return;

            if (!rankings || rankings.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">No participants ranked yet.</td></tr>`;
                return;
            }

            let html = '';
            rankings.forEach(r => {
                const rankCls = r.rank <= 3 ? `rank-${r.rank}` : 'rank-other';
                html += `
                    <tr>
                        <td>
                            <span class="leaderboard-rank-badge ${rankCls}">${r.rank}</span>
                        </td>
                        <td>
                            <a href="/admin/candidate-performance?candidate_id=${encodeURIComponent(r.candidate_id)}" style="font-weight:600; color:var(--text-primary); text-decoration:none;">
                                ${r.candidate_name}
                            </a>
                            <div style="font-size:11px; color:var(--text-secondary);">${r.candidate_email}</div>
                        </td>
                        <td>
                            <span style="font-weight:700;">${r.score}</span>
                        </td>
                        <td>
                            <span style="font-weight:700; color:#10b981;">${r.percentage}%</span>
                        </td>
                        <td>
                            <span style="font-size:12px; color:var(--text-secondary);">${r.completion_date}</span>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            console.warn('Error loading leaderboard:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        loadAssessmentAnalytics();
    });

})();
