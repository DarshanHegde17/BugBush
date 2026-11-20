/**
 * BugBash - Admin Code Logic Recognition & Deep Analysis Controller
 * Visualizes code structure, AST patterns, alternative approaches, Big-O proofs,
 * AI feedback, and handles human reviewer corrections.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        analysisId: null,
        analysisData: null
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

    async function loadAnalysisDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        state.analysisId = urlParams.get('id') || urlParams.get('analysis_id') || urlParams.get('submission_id');

        if (!state.analysisId) {
            state.analysisId = 'mla-101';
        }

        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights` : '/api/v1/admin/ml-insights';
            const res = await fetch(`${baseUrl}/analyses/${encodeURIComponent(state.analysisId)}`, {
                headers: getHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Analysis record not found');
            const data = await res.json();
            state.analysisData = data;
            renderDetails(data);
        } catch (err) {
            console.error('Error loading code analysis:', err);
            const container = document.getElementById('codeAnalysisMainContent');
            if (container) {
                container.innerHTML = `
                    <div style="padding:48px; text-align:center; color:var(--ml-danger);">
                        <h2>Failed to Load Code Analysis</h2>
                        <p>${err.message}</p>
                        <a href="/admin/ml-insights" class="btn-export-trigger" style="margin-top:16px;">Back to ML Overview</a>
                    </div>
                `;
            }
        }
    }

    function renderDetails(data) {
        // 1. Header Meta
        const qTitleEl = document.getElementById('analysisQuestionTitle');
        if (qTitleEl) qTitleEl.textContent = data.question_title || 'Code Analysis';

        const asmtTitleEl = document.getElementById('analysisAssessmentTitle');
        if (asmtTitleEl) asmtTitleEl.textContent = `${data.assessment_title || ''} • ${data.question_category || 'Algorithms'}`;

        const candNameEl = document.getElementById('analysisCandidateName');
        if (candNameEl) candNameEl.textContent = `${data.candidate_name} (${data.candidate_email})`;

        const langBadge = document.getElementById('codeLangBadge');
        if (langBadge) langBadge.textContent = (data.language || 'python').toUpperCase();

        // 2. Code Snippet
        const codePre = document.getElementById('sourceCodePre');
        if (codePre) codePre.textContent = data.code_snippet || '// No source code recorded';

        // 3. Algorithm Recognition & Confidence
        const algTitleEl = document.getElementById('detectedAlgorithmTitle');
        if (algTitleEl) algTitleEl.textContent = data.detected_algorithm || 'Algorithm Recognition Pending';

        const algConfEl = document.getElementById('algorithmConfidenceBadge');
        if (algConfEl) {
            const confPct = Math.round((data.algorithm_confidence || 0) * 100);
            algConfEl.textContent = `${confPct}% Prediction Confidence`;
            algConfEl.className = `severity-pill ${confPct >= 90 ? 'high' : (confPct >= 75 ? 'medium' : 'low')}`;
            if (confPct >= 90) {
                algConfEl.style.background = 'rgba(16, 185, 129, 0.15)';
                algConfEl.style.color = '#10b981';
            }
        }

        // 4. Detected Concepts Cloud
        const conceptsWrap = document.getElementById('conceptTagsCloud');
        if (conceptsWrap) {
            const concepts = data.detected_concepts || [];
            if (concepts.length === 0) {
                conceptsWrap.innerHTML = '<span style="font-size:12px; opacity:0.5;">No specific concepts flagged</span>';
            } else {
                conceptsWrap.innerHTML = concepts.map(c => `<span class="concept-tag-chip">${c}</span>`).join('');
            }
        }

        // 5. Structural AST Features
        const cfEl = document.getElementById('featureControlFlow');
        if (cfEl) cfEl.textContent = data.control_flow || 'Standard Sequential';

        const dsEl = document.getElementById('featureDataStructures');
        if (dsEl) dsEl.textContent = (data.data_structures_used || []).join(', ') || 'Primitive Variables';

        const loopsEl = document.getElementById('featureLoopStructures');
        if (loopsEl) loopsEl.textContent = (data.loop_structures || []).join('; ') || 'No Loops Detected';

        const recEl = document.getElementById('featureRecursion');
        if (recEl) recEl.textContent = data.recursion_patterns || 'None (Iterative)';

        const fnEl = document.getElementById('featureFunctionCalls');
        if (fnEl) fnEl.textContent = (data.function_calls || []).join(', ') || 'None';

        // 6. Approaches Comparison Table
        const appTbody = document.getElementById('approachesTableBody');
        if (appTbody) {
            const approaches = data.alternative_approaches || [];
            if (approaches.length === 0) {
                appTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; opacity:0.5;">No alternative approaches modeled.</td></tr>`;
            } else {
                let html = '';
                approaches.forEach(ap => {
                    html += `
                        <tr class="${ap.is_detected_approach ? 'detected-row' : ''}">
                            <td>
                                <strong style="color:var(--text-primary);">${ap.approach_name}</strong>
                                ${ap.is_detected_approach ? '<span class="severity-pill medium" style="margin-left:6px; font-size:9px;">DETECTED</span>' : ''}
                                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${ap.description}</div>
                            </td>
                            <td><code style="color:#ff6b35; font-weight:700;">${ap.time_complexity}</code></td>
                            <td><code style="color:#10b981; font-weight:700;">${ap.space_complexity}</code></td>
                            <td style="font-size:11px; color:var(--text-secondary);">${ap.tradeoffs}</td>
                        </tr>
                    `;
                });
                appTbody.innerHTML = html;
            }
        }

        // 7. Time & Space Complexity Big-O Proofs
        const tc = data.time_complexity || {};
        const tcBig = document.getElementById('bigOTimeNotation');
        if (tcBig) tcBig.textContent = tc.notation || 'O(n)';

        const tcExp = document.getElementById('timeExplanation');
        if (tcExp) tcExp.textContent = tc.explanation || '';

        const tcEv = document.getElementById('timeEvidenceList');
        if (tcEv) {
            const ev = tc.code_evidence || [];
            tcEv.innerHTML = ev.map(line => `<li>${line}</li>`).join('');
        }

        const sc = data.space_complexity || {};
        const scBig = document.getElementById('bigOSpaceNotation');
        if (scBig) scBig.textContent = sc.notation || 'O(n)';

        const scExp = document.getElementById('spaceExplanation');
        if (scExp) scExp.textContent = sc.explanation || '';

        const scMem = document.getElementById('spaceMemoryDetail');
        if (scMem) scMem.textContent = `Auxiliary Memory: ${sc.auxiliary_memory || 'None'}`;

        const scEv = document.getElementById('spaceEvidenceList');
        if (scEv) {
            const ev = sc.code_evidence || [];
            scEv.innerHTML = ev.map(line => `<li>${line}</li>`).join('');
        }

        // 8. Quality & Optimization Opportunities
        const qMetrics = data.code_quality || {};
        const qScoreEl = document.getElementById('qualityReadabilityScore');
        if (qScoreEl) qScoreEl.textContent = `${qMetrics.readability_score || 90}/100`;

        const qRatingEl = document.getElementById('qualityMaintainabilityRating');
        if (qRatingEl) qRatingEl.textContent = `Rating: ${qMetrics.maintainability_rating || 'A'}`;

        const optsContainer = document.getElementById('optimizationsContainer');
        if (optsContainer) {
            const opts = data.optimizations || [];
            if (opts.length === 0) {
                optsContainer.innerHTML = '<div style="font-size:12px; color:var(--text-secondary);">No optimization bottlenecks detected. Solution matches optimal benchmarks.</div>';
            } else {
                let optHtml = '';
                opts.forEach(opt => {
                    optHtml += `
                        <div class="opt-item-box">
                            <h4>${opt.suggested_improvement}</h4>
                            <div style="color:var(--text-primary); margin-bottom:4px;"><strong>Reason:</strong> ${opt.reason}</div>
                            <div style="color:var(--text-secondary); margin-bottom:4px;"><strong>Benefit:</strong> ${opt.expected_benefit}</div>
                            ${opt.estimated_complexity_change ? `<div style="font-family:'JetBrains Mono', monospace; font-size:11px; color:#ff6b35;"><strong>Big-O Impact:</strong> ${opt.estimated_complexity_change}</div>` : ''}
                        </div>
                    `;
                });
                optsContainer.innerHTML = optHtml;
            }
        }

        // 9. AI Pedagogical Feedback
        const aiData = data.ai_feedback || {};
        const strengthsList = document.getElementById('aiStrengthsList');
        if (strengthsList) {
            const strengths = aiData.candidate_strengths || [];
            strengthsList.innerHTML = strengths.map(s => `<li>${s}</li>`).join('');
        }

        const mistakesList = document.getElementById('aiMistakesList');
        if (mistakesList) {
            const mistakes = aiData.logical_mistakes || [];
            if (mistakes.length === 0) {
                mistakesList.innerHTML = '<li style="color:#10b981;">No logical mistakes identified.</li>';
            } else {
                mistakesList.innerHTML = mistakes.map(m => `<li style="color:#ef4444;">${m}</li>`).join('');
            }
        }

        const studyTopicsList = document.getElementById('aiStudyTopicsList');
        if (studyTopicsList) {
            const topics = aiData.recommended_study_topics || [];
            studyTopicsList.innerHTML = topics.map(t => `<span class="concept-tag-chip">${t}</span>`).join('');
        }

        // 10. Existing Reviewer Corrections
        const correctionNotice = document.getElementById('existingCorrectionNotice');
        if (correctionNotice) {
            if (data.corrections) {
                correctionNotice.style.display = 'block';
                const cor = data.corrections;
                correctionNotice.innerHTML = `
                    <div style="background:rgba(139, 92, 246, 0.12); border:1px solid rgba(139, 92, 246, 0.3); border-radius:8px; padding:12px; margin-bottom:14px; font-size:12px;">
                        <strong style="color:#8b5cf6;">Reviewer Correction Recorded by ${cor.corrected_by} on ${cor.corrected_at}</strong>
                        <div style="margin-top:4px;">Algorithm: ${cor.corrected_algorithm || 'Unchanged'} • Approach: ${cor.corrected_approach || 'Unchanged'}</div>
                        <div style="font-style:italic; margin-top:2px;">"${cor.notes}"</div>
                    </div>
                `;
            } else {
                correctionNotice.style.display = 'none';
            }
        }
    }

    // Handle Reviewer Correction Form Submission
    async function submitCorrection(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('btnSubmitCorrectionForm');
        if (submitBtn) submitBtn.disabled = true;

        const algInput = document.getElementById('inputCorrectedAlgorithm');
        const apprInput = document.getElementById('inputCorrectedApproach');
        const tcInput = document.getElementById('inputCorrectedTime');
        const scInput = document.getElementById('inputCorrectedSpace');
        const flagBox = document.getElementById('checkMisleadingFeedback');
        const notesInput = document.getElementById('inputCorrectionNotes');
        const datasetBox = document.getElementById('checkSubmitDataset');

        const payload = {
            corrected_algorithm: algInput ? algInput.value.trim() || null : null,
            corrected_approach: apprInput ? apprInput.value.trim() || null : null,
            corrected_time_complexity: tcInput ? tcInput.value.trim() || null : null,
            corrected_space_complexity: scInput ? scInput.value.trim() || null : null,
            misleading_feedback_flag: flagBox ? flagBox.checked : false,
            correction_notes: notesInput ? notesInput.value.trim() : 'Reviewer manual adjustment',
            submit_to_dataset: datasetBox ? datasetBox.checked : true
        };

        try {
            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights` : '/api/v1/admin/ml-insights';
            const res = await fetch(`${baseUrl}/analyses/${encodeURIComponent(state.analysisId)}/corrections`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to record reviewer correction');
            alert('Human reviewer correction recorded successfully and preserved in benchmark evaluation dataset.');
            loadAnalysisDetails();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    function bindEvents() {
        const copyBtn = document.getElementById('btnCopySourceCode');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const codePre = document.getElementById('sourceCodePre');
                if (codePre) {
                    navigator.clipboard.writeText(codePre.textContent);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
                }
            });
        }

        const correctionForm = document.getElementById('correctionForm');
        if (correctionForm) {
            correctionForm.addEventListener('submit', submitCorrection);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        bindEvents();
        loadAnalysisDetails();
    });

})();
