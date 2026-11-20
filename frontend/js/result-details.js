/**
 * BugBash - Admin Candidate Result Details & Scorecard Controller
 * Populates individual candidate scorecard, evaluation breakdown, and question performance.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        resultId: null
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

    async function fetchResultDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        state.resultId = urlParams.get('id') || urlParams.get('result_id');

        if (!state.resultId) {
            alert('No result ID specified in URL.');
            window.location.href = '/admin/results';
            return;
        }

        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/results` : '/api/v1/admin/results';
            const res = await fetch(`${baseUrl}/${encodeURIComponent(state.resultId)}`, {
                headers: getHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Result not found or unavailable');
            const data = await res.json();
            renderScorecard(data);
        } catch (err) {
            console.error('Error fetching result details:', err);
            const container = document.getElementById('scorecardContainer');
            if (container) {
                container.innerHTML = `
                    <div style="padding:48px; text-align:center; color:var(--results-danger);">
                        <h2>Failed to Load Scorecard</h2>
                        <p>${err.message}</p>
                        <a href="/admin/results" class="btn-export-trigger" style="margin-top:16px;">Back to Results Directory</a>
                    </div>
                `;
            }
        }
    }

    function renderScorecard(data) {
        // Hero Candidate Info
        const nameEl = document.getElementById('candidateFullName');
        if (nameEl) nameEl.textContent = data.candidate_name || 'Candidate';

        const emailEl = document.getElementById('candidateEmail');
        if (emailEl) emailEl.textContent = data.candidate_email || '';

        const asmtEl = document.getElementById('assessmentTitle');
        if (asmtEl) asmtEl.textContent = data.assessment_title || '';

        const dateEl = document.getElementById('completionDate');
        if (dateEl) dateEl.textContent = data.completion_date || '';

        const attemptEl = document.getElementById('attemptNumber');
        if (attemptEl) attemptEl.textContent = `Attempt #${data.attempt_number || 1}`;

        const avatarEl = document.getElementById('candidateAvatar');
        if (avatarEl) {
            if (data.candidate_avatar) {
                avatarEl.innerHTML = `<img src="${data.candidate_avatar}" alt="${data.candidate_name}">`;
            } else {
                avatarEl.textContent = getInitials(data.candidate_name);
            }
        }

        // Score Pill
        const pointsEl = document.getElementById('scorePoints');
        if (pointsEl) pointsEl.textContent = `${data.obtained_marks} / ${data.total_marks}`;

        const pctEl = document.getElementById('scorePercentage');
        if (pctEl) {
            const isPass = (data.pass_fail_status || 'Pass').toLowerCase() === 'pass';
            pctEl.textContent = `${data.percentage}% • ${isPass ? 'Passed' : 'Failed'}`;
            pctEl.style.color = isPass ? '#10b981' : '#ef4444';
        }

        const gradeEl = document.getElementById('gradeBadge');
        if (gradeEl) {
            gradeEl.textContent = data.grade || 'A';
            const g = (data.grade || '').toUpperCase();
            if (g.startsWith('A')) {
                gradeEl.style.background = 'rgba(16, 185, 129, 0.15)';
                gradeEl.style.color = '#10b981';
            } else if (g.startsWith('B')) {
                gradeEl.style.background = 'rgba(59, 130, 246, 0.15)';
                gradeEl.style.color = '#3b82f6';
            } else if (g.startsWith('C')) {
                gradeEl.style.background = 'rgba(245, 158, 11, 0.15)';
                gradeEl.style.color = '#f59e0b';
            } else {
                gradeEl.style.background = 'rgba(239, 68, 68, 0.15)';
                gradeEl.style.color = '#ef4444';
            }
        }

        // Evaluation Breakdown
        const breakdown = data.evaluation_breakdown || {};
        const tcEl = document.getElementById('metricTestCaseCorrectness');
        if (tcEl) tcEl.textContent = breakdown.test_case_correctness || '100%';

        const compEl = document.getElementById('metricCompilation');
        if (compEl) compEl.textContent = breakdown.compilation_status || 'Success';

        const runEl = document.getElementById('metricRuntime');
        if (runEl) runEl.textContent = breakdown.runtime_status || 'Normal';

        const mlEl = document.getElementById('metricMLAnalysis');
        if (mlEl) mlEl.textContent = breakdown.ml_analysis_status || 'Completed';

        const revEl = document.getElementById('metricManualReview');
        if (revEl) revEl.textContent = breakdown.manual_review_status || 'Not Required';

        // Feedback
        const feedbackBox = document.getElementById('feedbackContent');
        if (feedbackBox) {
            feedbackBox.textContent = data.feedback || 'The evaluation engine evaluated all test scenarios successfully without anomalies.';
        }

        // Question Performance Table
        const qTbody = document.getElementById('questionsTableBody');
        if (qTbody) {
            const questions = data.questions || [];
            if (questions.length === 0) {
                qTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">No individual question telemetry attached to this score record.</td></tr>`;
            } else {
                let qHtml = '';
                questions.forEach((q, idx) => {
                    const diffCls = (q.difficulty || 'medium').toLowerCase();
                    qHtml += `
                        <tr>
                            <td style="font-weight:700; color:var(--text-secondary); width:50px;">#${idx + 1}</td>
                            <td>
                                <span style="font-weight:600; color:var(--text-primary);">${q.title}</span>
                                <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">${q.question_type}</div>
                            </td>
                            <td>
                                <span class="question-row-badge ${diffCls}">${q.difficulty}</span>
                            </td>
                            <td>
                                <span style="font-weight:700;">${q.marks_obtained}</span> / ${q.max_marks}
                            </td>
                            <td>
                                <div class="test-case-ratio">
                                    <span class="passed">${q.test_cases_passed} passed</span>
                                    <span style="opacity:0.4;">/</span>
                                    <span class="failed">${q.test_cases_failed} failed</span>
                                </div>
                            </td>
                            <td>
                                <span class="badge-status ${q.evaluation_status === 'Accepted' ? 'pass' : 'fail'}">
                                    ${q.evaluation_status}
                                </span>
                            </td>
                        </tr>
                    `;
                });
                qTbody.innerHTML = qHtml;
            }
        }

        // Candidate Performance Link
        const candPerfBtn = document.getElementById('btnViewCandidatePerf');
        if (candPerfBtn && data.candidate_id) {
            candPerfBtn.href = `/admin/candidate-performance?candidate_id=${encodeURIComponent(data.candidate_id)}`;
        }

        // Assessment Analytics Link
        const asmtAnalyticsBtn = document.getElementById('btnViewAsmtAnalytics');
        if (asmtAnalyticsBtn && data.assessment_id) {
            asmtAnalyticsBtn.href = `/admin/assessment-analytics?assessment_id=${encodeURIComponent(data.assessment_id)}`;
        }
    }

    function bindEvents() {
        const btnPrint = document.getElementById('btnPrintScorecard');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        bindEvents();
        fetchResultDetails();
    });

})();
