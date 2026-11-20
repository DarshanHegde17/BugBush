/**
 * BugBash - Enterprise Admin Submission Details Controller
 * Renders submission specifications, sanitized test-case execution results,
 * 8-stage ML evaluation pipeline tracking, and evaluation history timeline.
 */

(function () {
    'use strict';

    let currentSubmissionId = null;
    let currentSubmissionData = null;

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

    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAdminToken()}`
        };
    }

    function getSubmissionIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || params.get('submission_id');
    }

    async function loadSubmissionDetails() {
        if (!checkAuth()) return;
        currentSubmissionId = getSubmissionIdFromUrl();

        if (!currentSubmissionId) {
            alert('No submission ID specified.');
            window.location.href = '/admin/submissions';
            return;
        }

        try {
            const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(currentSubmissionId)}`, {
                headers: getAuthHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) {
                throw new Error(`Submission '${currentSubmissionId}' not found or error loading data.`);
            }

            currentSubmissionData = await res.json();
            renderHeader(currentSubmissionData);
            renderTelemetry(currentSubmissionData.execution_summary);
            renderCodeViewer(currentSubmissionData);
            renderTestCases(currentSubmissionData.test_cases);
            renderQuestionSpecs(currentSubmissionData);
            renderMLPipeline(currentSubmissionData.ml_analysis);
            renderAlgorithmicAnalysis(currentSubmissionData.ml_analysis);
            renderManualReviewSummary(currentSubmissionData.manual_review);
            renderEvaluationHistory(currentSubmissionData.evaluation_history);
        } catch (err) {
            console.error('Error loading submission details:', err);
            const container = document.getElementById('submissionDetailsContent');
            if (container) {
                container.innerHTML = `
                    <div class="state-container" style="padding: 5rem 2rem;">
                        <svg class="empty-icon" style="color:var(--danger-red);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <div class="empty-title">Failed to Load Submission</div>
                        <div class="empty-desc">${escapeHtml(err.message)}</div>
                        <a href="/admin/submissions" class="btn-header-action primary">Return to Submissions Directory</a>
                    </div>
                `;
            }
        }
    }

    function renderHeader(data) {
        const idElem = document.getElementById('headerSubId');
        if (idElem) idElem.textContent = data.submission_id;

        const candidateName = document.getElementById('headerCandidateName');
        if (candidateName) candidateName.textContent = data.candidate_name;

        const candidateEmail = document.getElementById('headerCandidateEmail');
        if (candidateEmail) candidateEmail.textContent = data.candidate_email;

        const asmtTitle = document.getElementById('headerAssessmentTitle');
        if (asmtTitle) asmtTitle.textContent = data.assessment_title || 'General Assessment';

        const qTitle = document.getElementById('headerQuestionTitle');
        if (qTitle) qTitle.textContent = data.question_title;

        const scoreElem = document.getElementById('headerScoreValue');
        if (scoreElem) scoreElem.textContent = `${data.score}/${data.max_score}`;

        const statusElem = document.getElementById('headerStatusBadge');
        if (statusElem) {
            statusElem.textContent = data.evaluation_status;
            statusElem.className = `status-pill ${getStatusClass(data.evaluation_status)}`;
        }

        const avatarElem = document.getElementById('headerAvatar');
        if (avatarElem) {
            const initials = data.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarElem.textContent = initials || 'C';
        }

        const btnReview = document.getElementById('btnGoToReview');
        if (btnReview) {
            btnReview.href = `/admin/manual-review?id=${encodeURIComponent(data.submission_id)}`;
        }
    }

    function renderTelemetry(summary) {
        if (!summary) return;
        const totalTests = document.getElementById('telTotalTests');
        if (totalTests) totalTests.textContent = `${summary.passed_test_cases}/${summary.total_test_cases}`;

        const execTime = document.getElementById('telExecTime');
        if (execTime) execTime.textContent = `${summary.execution_time_ms} ms`;

        const memUsage = document.getElementById('telMemory');
        if (memUsage) memUsage.textContent = `${summary.memory_kb > 1024 ? (summary.memory_kb / 1024).toFixed(1) + ' MB' : summary.memory_kb + ' KB'}`;

        const compStatus = document.getElementById('telCompilation');
        if (compStatus) compStatus.textContent = summary.compilation_status || 'Success';
    }

    function renderCodeViewer(data) {
        const codeBlock = document.getElementById('codeViewerPre');
        const langBadge = document.getElementById('codeViewerLang');

        if (langBadge) langBadge.textContent = data.language || 'Code';

        if (codeBlock) {
            if (!data.can_view_code) {
                codeBlock.textContent = '// Source code inspection requires elevated administrator permissions.';
                return;
            }
            codeBlock.textContent = data.code_preview || '// No code submitted for this question (MCQ or empty submission).';
        }
    }

    function renderTestCases(testCases) {
        const tbody = document.getElementById('testCasesTableBody');
        if (!tbody) return;

        if (!testCases || testCases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">No test case executions recorded.</td></tr>';
            return;
        }

        tbody.innerHTML = testCases.map(tc => {
            const isPublic = tc.visibility === 'public';
            const statusClass = getStatusClass(tc.status);

            return `
                <tr>
                    <td style="font-weight:700; font-family:var(--font-mono);">#${tc.case_id}</td>
                    <td>
                        <span class="badge-visibility ${isPublic ? 'public' : 'hidden'}">
                            ${isPublic ? 'Public' : 'Hidden'}
                        </span>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">${escapeHtml(tc.status)}</span>
                    </td>
                    <td style="font-family:var(--font-mono);">${tc.execution_time_ms} ms</td>
                    <td style="font-family:var(--font-mono);">${tc.memory_kb} KB</td>
                    <td>
                        ${tc.error_category ? `<span style="color:var(--danger-red); font-weight:600; font-size:0.8rem;">${escapeHtml(tc.error_category)}</span>` : '<span style="color:var(--text-muted);">-</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderQuestionSpecs(data) {
        const title = document.getElementById('qSpecTitle');
        if (title) title.textContent = data.question_title;

        const diff = document.getElementById('qSpecDifficulty');
        if (diff) diff.textContent = data.difficulty;

        const pts = document.getElementById('qSpecPoints');
        if (pts) pts.textContent = `${data.max_score} pts`;

        const langs = document.getElementById('qSpecLanguages');
        if (langs) {
            const allowed = data.allowed_languages || [];
            langs.textContent = allowed.length > 0 ? allowed.join(', ') : 'All standard languages';
        }
    }

    function renderMLPipeline(mlData) {
        const container = document.getElementById('mlPipelineStepper');
        if (!container) return;

        const stages = (mlData && mlData.pipeline_stages) ? mlData.pipeline_stages : [];
        if (stages.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">ML evaluation pipeline not triggered.</div>';
            return;
        }

        container.innerHTML = stages.map(s => {
            const st = s.status || 'pending';
            const isDone = st === 'completed';
            const icon = isDone ? '&#10003;' : (st === 'failed' ? '&#10005;' : s.stage_number);

            return `
                <div class="ml-step-item ${st}">
                    <div class="ml-step-circle">${icon}</div>
                    <div class="ml-step-content">
                        <div class="ml-step-title">${escapeHtml(s.name)}</div>
                        ${s.details ? `<div class="ml-step-details">${escapeHtml(s.details)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderAlgorithmicAnalysis(mlData) {
        const algoElem = document.getElementById('mlAlgoApproach');
        if (algoElem) algoElem.textContent = (mlData && mlData.detected_algorithm) || 'Analysis Pending';

        const timeElem = document.getElementById('mlTimeComplexity');
        if (timeElem) timeElem.textContent = (mlData && mlData.time_complexity) || 'Pending';

        const spaceElem = document.getElementById('mlSpaceComplexity');
        if (spaceElem) spaceElem.textContent = (mlData && mlData.space_complexity) || 'Pending';

        const confElem = document.getElementById('mlConfidenceScore');
        if (confElem) confElem.textContent = (mlData && mlData.confidence_score !== null && mlData.confidence_score !== undefined) ? `${Math.round(mlData.confidence_score * 100)}%` : 'N/A';

        const chipsWrap = document.getElementById('mlConceptChips');
        if (chipsWrap) {
            const concepts = (mlData && mlData.recognized_concepts) || [];
            chipsWrap.innerHTML = concepts.length > 0 
                ? concepts.map(c => `<span class="concept-chip">${escapeHtml(c)}</span>`).join('')
                : '<span style="color:var(--text-muted); font-size:0.8rem;">No specific concepts mapped</span>';
        }

        const feedbackBox = document.getElementById('mlAiFeedback');
        if (feedbackBox) {
            feedbackBox.textContent = (mlData && mlData.ai_feedback) || 'Automated AI feedback is synthesized following execution completion.';
        }
    }

    function renderManualReviewSummary(mr) {
        const box = document.getElementById('manualReviewSummaryBox');
        if (!box) return;

        if (!mr || !mr.is_reviewed) {
            box.innerHTML = `
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">
                    ${mr && mr.review_required ? 'This submission was flagged for administrator inspection.' : 'No manual review has been performed on this submission yet.'}
                </div>
                <a href="/admin/manual-review?id=${encodeURIComponent(currentSubmissionId)}" class="btn-header-action primary" style="width:100%; justify-content:center;">
                    Open Manual Review Workspace
                </a>
            `;
            return;
        }

        box.innerHTML = `
            <div class="prev-review-box">
                <div class="prev-review-header">
                    <span>Reviewed by ${escapeHtml(mr.reviewed_by || 'Admin')}</span>
                    ${mr.score_adjusted ? `<span style="color:var(--primary-orange); font-family:var(--font-mono);">Adjusted: ${mr.adjusted_score} pts</span>` : '<span style="color:var(--success-green);">Score Verified</span>'}
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.4rem;">Reason: ${escapeHtml(mr.review_reason || 'N/A')}</div>
                <div class="prev-review-notes">${escapeHtml(mr.review_notes || 'No review notes provided.')}</div>
            </div>
            <a href="/admin/manual-review?id=${encodeURIComponent(currentSubmissionId)}" class="btn-header-action secondary" style="width:100%; justify-content:center; margin-top:0.75rem;">
                Re-Open Review Console
            </a>
        `;
    }

    function renderEvaluationHistory(history) {
        const list = document.getElementById('evalHistoryTimelineList');
        if (!list) return;

        if (!history || history.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No evaluation history records logged.</div>';
            return;
        }

        list.innerHTML = history.map(h => `
            <div class="history-item">
                <div class="history-dot"></div>
                <div class="history-header">
                    <span class="history-action-title">${escapeHtml(h.action)}</span>
                    <span class="history-time-stamp">${formatDate(h.timestamp)}</span>
                </div>
                <div class="history-actor-text">Actor: <strong>${escapeHtml(h.actor || 'System')}</strong> | Score: <strong>${h.score} pts</strong></div>
                ${h.notes ? `<div class="history-notes-box">${escapeHtml(h.notes)}</div>` : ''}
            </div>
        `).join('');
    }

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

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Modal Request Re-evaluation
    function setupReevaluationModal() {
        const btnOpen = document.getElementById('btnRequestReeval');
        const modal = document.getElementById('reevalModal');
        const btnCancel = document.getElementById('btnCancelReeval');
        const btnConfirm = document.getElementById('btnConfirmReeval');
        const inputReason = document.getElementById('reevalReasonInput');

        if (!btnOpen || !modal) return;

        btnOpen.addEventListener('click', () => {
            if (inputReason) inputReason.value = '';
            modal.classList.add('active');
        });

        if (btnCancel) {
            btnCancel.addEventListener('click', () => modal.classList.remove('active'));
        }

        if (btnConfirm) {
            btnConfirm.addEventListener('click', async () => {
                const reason = inputReason ? inputReason.value.trim() : '';
                if (!reason) {
                    alert('Please enter a reason for triggering re-evaluation.');
                    return;
                }

                btnConfirm.disabled = true;
                btnConfirm.textContent = 'Queueing...';

                try {
                    const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(currentSubmissionId)}/request-reevaluation`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ reason: reason })
                    });

                    if (!res.ok) throw new Error('Failed to request re-evaluation.');
                    modal.classList.remove('active');
                    alert('Automated re-evaluation successfully queued.');
                    loadSubmissionDetails();
                } catch (err) {
                    alert(`Error: ${err.message}`);
                } finally {
                    btnConfirm.disabled = false;
                    btnConfirm.textContent = 'Trigger Re-Evaluation';
                }
            });
        }
    }

    // Copy Code Button
    function setupCopyCode() {
        const btn = document.getElementById('btnCopySubmissionCode');
        const codePre = document.getElementById('codeViewerPre');
        if (btn && codePre) {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(codePre.textContent).then(() => {
                    const original = btn.innerHTML;
                    btn.innerHTML = '<span>&#10003; Copied!</span>';
                    setTimeout(() => { btn.innerHTML = original; }, 2000);
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadSubmissionDetails();
        setupReevaluationModal();
        setupCopyCode();
    });
})();
