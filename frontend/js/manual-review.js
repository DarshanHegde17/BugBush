/**
 * BugBash - Enterprise Admin Manual Review Controller
 * Handles interactive code inspection, score adjustments, reviewer audit notes,
 * and automated re-evaluation requests with strict input validations.
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

    async function loadReviewWorkspace() {
        if (!checkAuth()) return;
        currentSubmissionId = getSubmissionIdFromUrl();

        if (!currentSubmissionId) {
            alert('No submission ID specified for review.');
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
                throw new Error(`Submission '${currentSubmissionId}' not found.`);
            }

            currentSubmissionData = await res.json();
            renderWorkspace(currentSubmissionData);
        } catch (err) {
            console.error('Error loading manual review workspace:', err);
            const container = document.getElementById('manualReviewContainer');
            if (container) {
                container.innerHTML = `
                    <div class="state-container" style="padding: 5rem 2rem;">
                        <div class="empty-title">Error Loading Review Workspace</div>
                        <div class="empty-desc">${escapeHtml(err.message)}</div>
                        <a href="/admin/submissions" class="btn-submit-review" style="width: auto; padding: 0.75rem 1.5rem; text-decoration: none;">Return to Submissions</a>
                    </div>
                `;
            }
        }
    }

    function renderWorkspace(data) {
        // Top breadcrumb / meta
        const subIdElem = document.getElementById('reviewSubIdText');
        if (subIdElem) subIdElem.textContent = data.submission_id;

        const candName = document.getElementById('reviewCandidateName');
        if (candName) candName.textContent = data.candidate_name;

        const candEmail = document.getElementById('reviewCandidateEmail');
        if (candEmail) candEmail.textContent = data.candidate_email;

        const asmtTitle = document.getElementById('reviewAssessmentTitle');
        if (asmtTitle) asmtTitle.textContent = data.assessment_title || 'General Assessment';

        const qTitle = document.getElementById('reviewQuestionTitle');
        if (qTitle) qTitle.textContent = data.question_title;

        // Current score display
        const curScoreVal = document.getElementById('scoreOriginalVal');
        if (curScoreVal) curScoreVal.textContent = data.score;

        const targetScoreVal = document.getElementById('scoreProposedVal');
        if (targetScoreVal) targetScoreVal.textContent = data.score;

        const maxScoreVal = document.getElementById('scoreMaxVal');
        if (maxScoreVal) maxScoreVal.textContent = `/${data.max_score} pts max`;

        // Pre-fill score input with current score
        const scoreInput = document.getElementById('inputAdjustedScore');
        if (scoreInput) {
            scoreInput.value = data.score;
            scoreInput.max = data.max_score;
        }

        // Code viewer
        const codePre = document.getElementById('reviewCodePre');
        const langBadge = document.getElementById('reviewCodeLang');
        if (langBadge) langBadge.textContent = data.language || 'Code';
        if (codePre) {
            codePre.textContent = data.code_preview || '// No code submitted for this question.';
        }

        // Test cases summary
        const testSummaryElem = document.getElementById('reviewTestCasesSummary');
        if (testSummaryElem) {
            const summary = data.execution_summary || {};
            testSummaryElem.textContent = `${summary.passed_test_cases}/${summary.total_test_cases} Test Cases Passed (${data.evaluation_status})`;
        }

        // ML approach
        const mlAlgo = document.getElementById('reviewMlAlgo');
        if (mlAlgo) {
            mlAlgo.textContent = data.ml_analysis?.detected_algorithm || 'Algorithmic analysis unavailable';
        }

        const mlFeedback = document.getElementById('reviewMlFeedback');
        if (mlFeedback) {
            mlFeedback.textContent = data.ml_analysis?.ai_feedback || 'No automated feedback generated.';
        }

        // Previous review box if present
        const prevBox = document.getElementById('prevReviewContainer');
        const mr = data.manual_review || {};
        if (prevBox) {
            if (mr.is_reviewed) {
                prevBox.innerHTML = `
                    <div class="prev-review-box">
                        <div class="prev-review-header">
                            <span>Previously reviewed by: ${escapeHtml(mr.reviewed_by || 'Admin')}</span>
                            <span style="font-family:var(--font-mono); color:var(--primary-orange);">${mr.adjusted_score !== null ? `Score: ${mr.adjusted_score} pts` : 'Score Verified'}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">Reason: ${escapeHtml(mr.review_reason || 'N/A')}</div>
                        <div class="prev-review-notes">${escapeHtml(mr.review_notes || 'No review notes.')}</div>
                    </div>
                `;
            } else {
                prevBox.innerHTML = '';
            }
        }
    }

    function setupEventListeners() {
        const scoreInput = document.getElementById('inputAdjustedScore');
        const targetScoreVal = document.getElementById('scoreProposedVal');

        if (scoreInput && targetScoreVal) {
            scoreInput.addEventListener('input', () => {
                const val = scoreInput.value.trim();
                targetScoreVal.textContent = val !== '' ? val : (currentSubmissionData?.score ?? 0);
            });
        }

        const reasonSelect = document.getElementById('selectReviewReason');
        const reasonCustom = document.getElementById('inputCustomReason');
        if (reasonSelect && reasonCustom) {
            reasonSelect.addEventListener('change', () => {
                if (reasonSelect.value === 'Custom') {
                    reasonCustom.style.display = 'block';
                    reasonCustom.required = true;
                } else {
                    reasonCustom.style.display = 'none';
                    reasonCustom.required = false;
                }
            });
        }

        // Submit Review Form
        const form = document.getElementById('manualReviewForm');
        const btnSubmit = document.getElementById('btnSubmitManualReview');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                let reason = reasonSelect ? reasonSelect.value : '';
                if (reason === 'Custom') {
                    reason = reasonCustom ? reasonCustom.value.trim() : '';
                }

                if (!reason) {
                    alert('Please select or specify a reason for this manual review.');
                    return;
                }

                const notesInput = document.getElementById('textareaReviewNotes');
                const notes = notesInput ? notesInput.value.trim() : '';
                if (notes.length < 3) {
                    alert('Please provide thorough internal review notes (at least 3 characters).');
                    return;
                }

                let adjustedScore = null;
                if (scoreInput && scoreInput.value.trim() !== '') {
                    const parsed = parseFloat(scoreInput.value.trim());
                    if (isNaN(parsed) || parsed < 0) {
                        alert('Adjusted score must be a positive number.');
                        return;
                    }
                    if (currentSubmissionData && parsed > currentSubmissionData.max_score) {
                        alert(`Adjusted score cannot exceed maximum allowed points (${currentSubmissionData.max_score}).`);
                        return;
                    }
                    adjustedScore = parsed;
                }

                const chkMark = document.getElementById('chkMarkReviewed');
                const markReviewed = chkMark ? chkMark.checked : true;

                // Confirm action dialog
                const confirmMsg = adjustedScore !== null && adjustedScore !== currentSubmissionData.score
                    ? `Confirm manual score adjustment from ${currentSubmissionData.score} to ${adjustedScore} points?`
                    : 'Submit this review evaluation?';

                if (!confirm(confirmMsg)) return;

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = 'Saving Review...';
                }

                try {
                    const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(currentSubmissionId)}/review`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            review_notes: notes,
                            review_reason: reason,
                            adjusted_score: adjustedScore,
                            mark_as_reviewed: markReviewed
                        })
                    });

                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.detail || 'Failed to submit manual review.');
                    }

                    alert('Manual review recorded successfully and audit log updated.');
                    window.location.href = `/admin/submission-details?id=${encodeURIComponent(currentSubmissionId)}`;
                } catch (err) {
                    alert(`Error submitting review: ${err.message}`);
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Submit Review & Update Score';
                    }
                }
            });
        }

        // Secondary Re-evaluation Request
        const btnReeval = document.getElementById('btnReviewRequestReeval');
        if (btnReeval) {
            btnReeval.addEventListener('click', async () => {
                const reason = prompt('Please enter the reason for triggering automated re-evaluation:');
                if (!reason || !reason.trim()) return;

                try {
                    const res = await fetch(`/api/v1/admin/submissions/${encodeURIComponent(currentSubmissionId)}/request-reevaluation`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ reason: reason.trim() })
                    });

                    if (!res.ok) throw new Error('Failed to request re-evaluation.');
                    alert('Automated re-evaluation queued.');
                    window.location.href = `/admin/submission-details?id=${encodeURIComponent(currentSubmissionId)}`;
                } catch (err) {
                    alert(`Error: ${err.message}`);
                }
            });
        }

        // Copy code button
        const btnCopy = document.getElementById('btnCopyReviewCode');
        const codePre = document.getElementById('reviewCodePre');
        if (btnCopy && codePre) {
            btnCopy.addEventListener('click', () => {
                navigator.clipboard.writeText(codePre.textContent).then(() => {
                    const orig = btnCopy.innerHTML;
                    btnCopy.innerHTML = '<span>&#10003; Copied!</span>';
                    setTimeout(() => { btnCopy.innerHTML = orig; }, 2000);
                });
            });
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

    document.addEventListener('DOMContentLoaded', () => {
        loadReviewWorkspace();
        setupEventListeners();
    });
})();
