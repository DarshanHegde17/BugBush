/**
 * BugBash - Admin Candidate Performance Analytics Controller
 * Displays candidate historical scoring trends, language proficiency, topic mastery, and scorecards.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        candidateId: null
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

    function getInitials(name) {
        if (!name) return 'C';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }

    async function loadCandidatePerformance() {
        const urlParams = new URLSearchParams(window.location.search);
        state.candidateId = urlParams.get('candidate_id') || urlParams.get('id') || urlParams.get('candidate');

        if (!state.candidateId) {
            state.candidateId = 'usr_demo_01';
        }

        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results` : '/api/v1/admin/results';
            const res = await fetch(`${baseUrl}/candidate/${encodeURIComponent(state.candidateId)}/performance`, {
                headers: getHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Candidate performance data unavailable');
            const data = await res.json();
            renderCandidateProfile(data);
        } catch (err) {
            console.error('Error loading candidate performance:', err);
            const container = document.getElementById('candidatePerfContainer');
            if (container) {
                container.innerHTML = `
                    <div style="padding:48px; text-align:center; color:var(--results-danger);">
                        <h2>Failed to Load Candidate Analytics</h2>
                        <p>${err.message}</p>
                        <a href="/admin/results" class="btn-export-trigger" style="margin-top:16px;">Back to Results</a>
                    </div>
                `;
            }
        }
    }

    function renderCandidateProfile(data) {
        // Banner
        const nameEl = document.getElementById('candidateFullName');
        if (nameEl) nameEl.textContent = data.candidate_name || 'Candidate';

        const emailEl = document.getElementById('candidateEmail');
        if (emailEl) emailEl.textContent = data.candidate_email || '';

        const avatarEl = document.getElementById('candidateAvatar');
        if (avatarEl) avatarEl.textContent = getInitials(data.candidate_name);

        // Stats
        const attemptedEl = document.getElementById('statAttempted');
        if (attemptedEl) attemptedEl.textContent = data.total_attempted || 0;

        const completedEl = document.getElementById('statCompleted');
        if (completedEl) completedEl.textContent = data.total_completed || 0;

        const avgScoreEl = document.getElementById('statAvgScore');
        if (avgScoreEl) avgScoreEl.textContent = `${data.average_score || 0}%`;

        const highScoreEl = document.getElementById('statHighScore');
        if (highScoreEl) highScoreEl.textContent = `${data.highest_score || 0}%`;

        const lowScoreEl = document.getElementById('statLowestScore');
        if (lowScoreEl) lowScoreEl.textContent = `${data.lowest_score || 0}%`;

        // Historical Trend Line Chart
        if (window.ResultCharts) {
            window.ResultCharts.renderTrendLine('candidateTrendChart', data.performance_trend || []);
        }

        // Strongest & Weakest Languages
        const strongLangEl = document.getElementById('strongestLanguage');
        if (strongLangEl) strongLangEl.textContent = (data.strongest_language || 'Python').toUpperCase();

        const weakLangEl = document.getElementById('weakestLanguage');
        if (weakLangEl) weakLangEl.textContent = (data.weakest_language || 'C++').toUpperCase();

        // Strong Topics
        const strongTopicsEl = document.getElementById('strongTopicsWrap');
        if (strongTopicsEl) {
            const strongTopics = data.strongest_topics || ['Arrays', 'Hash Maps', 'String Manipulation'];
            strongTopicsEl.innerHTML = strongTopics.map(t => `<span class="topic-tag strong">&#10003; ${t}</span>`).join('');
        }

        // Improvement Topics
        const weakTopicsEl = document.getElementById('weakTopicsWrap');
        if (weakTopicsEl) {
            const weakTopics = data.topics_needing_improvement || ['Graph Theory', 'Dynamic Programming'];
            weakTopicsEl.innerHTML = weakTopics.map(t => `<span class="topic-tag weak">&#9888; ${t}</span>`).join('');
        }

        // History Table
        const tbody = document.getElementById('candidateHistoryBody');
        if (tbody) {
            const history = data.history || [];
            if (history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">No assessment attempts on record.</td></tr>`;
            } else {
                let html = '';
                history.forEach(h => {
                    const isPass = (h.pass_fail_status || 'Pass').toLowerCase() === 'pass';
                    html += `
                        <tr>
                            <td>
                                <a href="/admin/assessment-analytics?assessment_id=${encodeURIComponent(h.assessment_id)}" style="font-weight:600; color:var(--text-primary); text-decoration:none;">
                                    ${h.assessment_title}
                                </a>
                            </td>
                            <td>
                                <span style="font-weight:700;">${h.obtained_marks}</span> / ${h.total_marks}
                            </td>
                            <td>
                                <span style="font-weight:700; color:${isPass ? '#10b981' : '#ef4444'};">${h.percentage}%</span>
                            </td>
                            <td>
                                <span class="badge-status ${isPass ? 'pass' : 'fail'}">${isPass ? 'Pass' : 'Fail'}</span>
                            </td>
                            <td>
                                <span style="font-size:12px; color:var(--text-secondary);">${h.completion_date}</span>
                            </td>
                            <td>
                                <a href="/admin/result-details?id=${h.id}" class="btn-icon-action" title="View Full Scorecard">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                </a>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        loadCandidatePerformance();
    });

})();
