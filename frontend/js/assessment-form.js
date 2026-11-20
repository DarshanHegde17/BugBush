/**
 * BugBash - Enterprise Assessment Creation & Edit Wizard Controller
 * Handles multi-step form progression, Question Bank manual selection,
 * exact custom automated question assembly, section timer management,
 * rules configuration, and backend API submission.
 */

(function () {
    'use strict';

    // Application Configuration
    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL) || 
                     (window.location.origin ? window.location.origin + '/api/v1' : 'http://127.0.0.1:8000/api/v1');

    const token = sessionStorage.getItem('bugbash_admin_token') || localStorage.getItem('bugbash_admin_token');
    if (!token) {
        window.location.href = '/admin/login';
        return;
    }

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

    // Wizard State
    const state = {
        isEditMode: false,
        assessmentId: null,
        currentStep: 1,
        maxSteps: 6,
        assessment: {
            title: '',
            description: '',
            assessment_type: 'Coding Examination',
            instructions: 'Read all questions carefully before submitting.',
            difficulty: 'Medium',
            category: 'Computer Science',
            languages: ['Python', 'Java', 'C++', 'JavaScript', 'SQL'],
            tags: [],
            sections: [
                {
                    id: 'sec-1',
                    name: 'Core Coding Challenge',
                    instructions: 'Solve all problems in this section.',
                    duration_minutes: 60,
                    total_marks: 100,
                    question_ids: [],
                    navigation_rule: 'free'
                }
            ],
            questions: [],
            timer_config: {
                mode: 'total',
                total_timer_enabled: true,
                total_duration_minutes: 60,
                section_timers_enabled: false
            },
            rules: {
                total_marks: 100,
                passing_percentage: 60.0,
                negative_marking: false,
                negative_mark_value: 0.0,
                max_attempts: 1,
                question_navigation: 'free',
                random_question_order: false,
                random_option_order: false,
                allow_change_answers: true,
                autosave: true,
                submission_confirmation: true,
                auto_submit_on_timeout: true,
                result_visibility: 'immediate',
                allow_candidate_review: true
            },
            schedule: {
                availability: 'scheduled',
                start_date: '',
                end_date: '',
                timezone: 'UTC'
            },
            assigned_candidates: []
        },
        qbCatalog: []
    };

    // DOM Elements
    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();
        initStepper();
        initQuestionModals();
        initFormBindings();

        // Check for edit mode (?id=asmt-xxx)
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        if (editId) {
            state.isEditMode = true;
            state.assessmentId = editId;
            const heading = document.getElementById('wizardPageTitle');
            if (heading) heading.textContent = 'Edit Assessment Configuration';
            await loadExistingAssessment(editId);
        } else {
            renderSectionsAndQuestions();
        }
    });

    /**
     * Common Admin Topbar and Sidebar layout setup
     */
    async function initCommonLayout() {
        try {
            const meRes = await adminApi('/admin/auth/me');
            if (meRes.ok) {
                const u = await meRes.json();
                const greeting = document.getElementById('adminGreetingName');
                const pill = document.getElementById('userPillName');
                const sName = document.getElementById('sidebarAdminName');
                if (greeting) greeting.textContent = u.full_name || 'Admin';
                if (pill) pill.textContent = u.full_name || 'Admin';
                if (sName) sName.textContent = u.full_name || 'Admin';
            }
        } catch (_) {}

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
                const cur = document.documentElement.getAttribute('data-theme') || 'dark';
                const nxt = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nxt);
                localStorage.setItem('bugbash_theme', nxt);
            });
        }

        document.querySelectorAll('.btn-admin-logout').forEach(b => {
            b.addEventListener('click', async (e) => {
                e.preventDefault();
                try { await adminApi('/admin/auth/logout', { method: 'POST' }); } catch (_) {}
                sessionStorage.removeItem('bugbash_admin_token');
                window.location.href = '/admin/login';
            });
        });
    }

    /**
     * Stepper Navigation & Step validation
     */
    function initStepper() {
        const stepIndicators = document.querySelectorAll('.step-indicator');
        const btnPrev = document.getElementById('btnWizardPrev');
        const btnNext = document.getElementById('btnWizardNext');
        const btnSaveDraft = document.getElementById('btnWizardSaveDraft');
        const btnPublish = document.getElementById('btnWizardPublish');

        function goToStep(stepNum) {
            if (stepNum < 1 || stepNum > state.maxSteps) return;

            // Validate current step before advancing
            if (stepNum > state.currentStep) {
                if (!validateCurrentStep(state.currentStep)) return;
            }

            state.currentStep = stepNum;

            // Update Stepper Badges
            stepIndicators.forEach(ind => {
                const s = parseInt(ind.getAttribute('data-step'), 10);
                ind.classList.remove('active', 'completed');
                if (s === stepNum) ind.classList.add('active');
                else if (s < stepNum) ind.classList.add('completed');
            });

            // Update Step Panes
            document.querySelectorAll('.form-step-pane').forEach(pane => {
                pane.classList.remove('active');
                if (parseInt(pane.getAttribute('data-step'), 10) === stepNum) {
                    pane.classList.add('active');
                }
            });

            // Button states
            if (btnPrev) btnPrev.style.display = stepNum === 1 ? 'none' : 'inline-flex';
            if (btnNext) btnNext.style.display = stepNum === state.maxSteps ? 'none' : 'inline-flex';
            if (btnPublish) btnPublish.style.display = stepNum === state.maxSteps ? 'inline-flex' : 'none';

            // Populate Review pane if at Step 6
            if (stepNum === 6) {
                renderReviewStep();
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        stepIndicators.forEach(ind => {
            ind.addEventListener('click', () => {
                const s = parseInt(ind.getAttribute('data-step'), 10);
                goToStep(s);
            });
        });

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                goToStep(state.currentStep + 1);
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                goToStep(state.currentStep - 1);
            });
        }

        if (btnSaveDraft) {
            btnSaveDraft.addEventListener('click', async () => {
                await saveAssessment('Draft');
            });
        }

        if (btnPublish) {
            btnPublish.addEventListener('click', async () => {
                await saveAssessment('Published');
            });
        }
    }

    function validateCurrentStep(step) {
        hideAlert();
        collectFormData();

        if (step === 1) {
            if (!state.assessment.title || state.assessment.title.length < 3) {
                showAlert('Assessment Title must be at least 3 characters long.');
                document.getElementById('inputAssessmentTitle')?.focus();
                return false;
            }
            if (!state.assessment.description || state.assessment.description.length < 10) {
                showAlert('Please provide a descriptive overview (at least 10 characters).');
                document.getElementById('inputAssessmentDesc')?.focus();
                return false;
            }
            if (!state.assessment.languages || state.assessment.languages.length === 0) {
                showAlert('Please select at least one supported programming language.');
                return false;
            }
        } else if (step === 2) {
            if (!state.assessment.questions || state.assessment.questions.length === 0) {
                showAlert('Please add at least one question to the assessment using Manual Selection or Automatic Generation.');
                return false;
            }
        } else if (step === 3) {
            if (state.assessment.timer_config.total_duration_minutes < 5) {
                showAlert('Total assessment duration must be at least 5 minutes.');
                return false;
            }
        }
        return true;
    }

    /**
     * Form inputs synchronizer
     */
    function collectFormData() {
        // Step 1
        state.assessment.title = (document.getElementById('inputAssessmentTitle')?.value || '').trim();
        state.assessment.description = (document.getElementById('inputAssessmentDesc')?.value || '').trim();
        state.assessment.assessment_type = document.getElementById('inputAssessmentType')?.value || 'Coding Examination';
        state.assessment.instructions = (document.getElementById('inputInstructions')?.value || '').trim();
        state.assessment.difficulty = document.getElementById('inputDifficulty')?.value || 'Medium';

        // Languages
        const selectedLangs = [];
        document.querySelectorAll('.lang-chip-checkbox:checked').forEach(cb => {
            selectedLangs.push(cb.value);
        });
        state.assessment.languages = selectedLangs.length > 0 ? selectedLangs : ['Python'];

        // Tags
        const tagsRaw = (document.getElementById('inputTags')?.value || '').trim();
        state.assessment.tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

        // Step 3 Timers
        const totalDuration = parseInt(document.getElementById('inputTotalDuration')?.value || '60', 10);
        const timerMode = document.querySelector('input[name="timerModeRadio"]:checked')?.value || 'total';
        const sectionTimersEnabled = timerMode === 'section' || timerMode === 'both';

        state.assessment.timer_config = {
            mode: timerMode,
            total_timer_enabled: timerMode === 'total' || timerMode === 'both',
            total_duration_minutes: totalDuration,
            section_timers_enabled: sectionTimersEnabled
        };
        state.assessment.duration_minutes = totalDuration;

        // Step 4 Rules
        state.assessment.rules.passing_percentage = parseFloat(document.getElementById('inputPassingPct')?.value || '60');
        state.assessment.rules.max_attempts = parseInt(document.getElementById('inputMaxAttempts')?.value || '1', 10);
        state.assessment.rules.negative_marking = document.getElementById('toggleNegativeMarking')?.checked || false;
        state.assessment.rules.negative_mark_value = parseFloat(document.getElementById('inputNegativeMarkValue')?.value || '0');
        state.assessment.rules.question_navigation = document.getElementById('selectNavigationRule')?.value || 'free';
        state.assessment.rules.random_question_order = document.getElementById('toggleRandomOrder')?.checked || false;
        state.assessment.rules.random_option_order = document.getElementById('toggleRandomOptions')?.checked || false;
        state.assessment.rules.allow_change_answers = document.getElementById('toggleChangeAnswers')?.checked ?? true;
        state.assessment.rules.result_visibility = document.getElementById('selectResultVisibility')?.value || 'immediate';

        // Step 5 Schedule & Assignment
        state.assessment.schedule.start_date = document.getElementById('inputStartDate')?.value || '';
        state.assessment.schedule.end_date = document.getElementById('inputEndDate')?.value || '';
        state.assessment.schedule.timezone = document.getElementById('selectTimezone')?.value || 'UTC';
        state.assessment.schedule.availability = document.getElementById('selectAvailability')?.value || 'scheduled';

        const candidatesRaw = (document.getElementById('inputAssignedCandidates')?.value || '').trim();
        if (candidatesRaw) {
            state.assessment.assigned_candidates = candidatesRaw
                .split(/[\n,]+/)
                .map(e => e.trim().toLowerCase())
                .filter(e => e && e.includes('@'));
        }
    }

    /**
     * Pre-fills inputs when in Edit Mode
     */
    async function loadExistingAssessment(id) {
        try {
            const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error('Assessment not found');
            const data = await res.json();

            state.assessment = data;

            // Fill Step 1
            if (document.getElementById('inputAssessmentTitle')) document.getElementById('inputAssessmentTitle').value = data.title || '';
            if (document.getElementById('inputAssessmentDesc')) document.getElementById('inputAssessmentDesc').value = data.description || '';
            if (document.getElementById('inputAssessmentType')) document.getElementById('inputAssessmentType').value = data.assessment_type || 'Coding Examination';
            if (document.getElementById('inputInstructions')) document.getElementById('inputInstructions').value = data.instructions || '';
            if (document.getElementById('inputDifficulty')) document.getElementById('inputDifficulty').value = data.difficulty || 'Medium';
            if (document.getElementById('inputTags')) document.getElementById('inputTags').value = (data.tags || []).join(', ');

            // Check language chips
            const langs = data.languages || [];
            document.querySelectorAll('.lang-chip-checkbox').forEach(cb => {
                cb.checked = langs.includes(cb.value);
            });

            // Fill Step 3
            if (document.getElementById('inputTotalDuration')) document.getElementById('inputTotalDuration').value = data.duration_minutes || 60;
            const mode = data.timer_config?.mode || 'total';
            const radio = document.querySelector(`input[name="timerModeRadio"][value="${mode}"]`);
            if (radio) radio.checked = true;

            // Fill Step 4
            if (document.getElementById('inputPassingPct')) document.getElementById('inputPassingPct').value = data.rules?.passing_percentage || 60;
            if (document.getElementById('inputMaxAttempts')) document.getElementById('inputMaxAttempts').value = data.rules?.max_attempts || 1;
            if (document.getElementById('toggleNegativeMarking')) document.getElementById('toggleNegativeMarking').checked = data.rules?.negative_marking || false;
            if (document.getElementById('inputNegativeMarkValue')) document.getElementById('inputNegativeMarkValue').value = data.rules?.negative_mark_value || 0;
            if (document.getElementById('selectNavigationRule')) document.getElementById('selectNavigationRule').value = data.rules?.question_navigation || 'free';
            if (document.getElementById('toggleRandomOrder')) document.getElementById('toggleRandomOrder').checked = data.rules?.random_question_order || false;
            if (document.getElementById('toggleRandomOptions')) document.getElementById('toggleRandomOptions').checked = data.rules?.random_option_order || false;
            if (document.getElementById('selectResultVisibility')) document.getElementById('selectResultVisibility').value = data.rules?.result_visibility || 'immediate';

            // Fill Step 5
            if (document.getElementById('inputStartDate')) document.getElementById('inputStartDate').value = data.schedule?.start_date || '';
            if (document.getElementById('inputEndDate')) document.getElementById('inputEndDate').value = data.schedule?.end_date || '';
            if (document.getElementById('selectTimezone')) document.getElementById('selectTimezone').value = data.schedule?.timezone || 'UTC';
            if (document.getElementById('inputAssignedCandidates')) document.getElementById('inputAssignedCandidates').value = (data.assigned_candidates || []).join(', ');

            renderSectionsAndQuestions();

        } catch (err) {
            console.error('[BugBash] Error loading assessment:', err);
            showAlert('Failed to load assessment details for editing.');
        }
    }

    /**
     * Renders Sections and Questions (Step 2)
     */
    function renderSectionsAndQuestions() {
        const container = document.getElementById('sectionsContainer');
        if (!container) return;

        const sections = state.assessment.sections || [];
        const questions = state.assessment.questions || [];

        // Update top metrics
        let totalMarks = 0;
        questions.forEach(q => {
            totalMarks += parseInt(q.custom_marks || q.points || 20, 10);
        });
        state.assessment.total_marks = totalMarks;

        const countEl = document.getElementById('selectedQuestionCountText');
        const marksEl = document.getElementById('totalCalculatedMarksText');
        if (countEl) countEl.textContent = questions.length;
        if (marksEl) marksEl.textContent = totalMarks;

        container.innerHTML = sections.map((sec, secIdx) => {
            const secQuestions = questions.filter(q => q.section_id === sec.id || (!q.section_id && secIdx === 0));

            return `
                <div class="section-builder-card" data-section-id="${sec.id}">
                    <div class="section-builder-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 11px; font-weight: 700; color: #ff6b35; text-transform: uppercase;">Section ${secIdx + 1}</span>
                            <input type="text" class="section-title-input" value="${escapeHtml(sec.name)}" placeholder="Section Name">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${sections.length > 1 ? `
                                <button type="button" class="btn-remove-q btn-remove-section" data-sec-id="${sec.id}" title="Remove Section">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="section-questions-list" id="secList_${sec.id}">
                        ${secQuestions.length === 0 ? `
                            <div class="empty-questions-dropzone">
                                No questions added to this section yet. Click <strong>"Add Questions from Bank"</strong> or <strong>"Auto-Generate Questions"</strong> above.
                            </div>
                        ` : secQuestions.map((q, qIdx) => `
                            <div class="selected-question-card" data-qid="${escapeHtml(q.question_id || q.id)}">
                                <span class="q-order-badge">${qIdx + 1}</span>
                                <div class="q-info-col">
                                    <span class="q-title-text">${escapeHtml(q.title || 'Coding Challenge')}</span>
                                    <div class="q-meta-tags">
                                        <span style="color: ${getDifficultyColor(q.difficulty)}; font-weight: 700;">${escapeHtml(q.difficulty || 'Medium')}</span>
                                        <span>&bull;</span>
                                        <span>${escapeHtml(q.category || 'General')}</span>
                                        <span>&bull;</span>
                                        <span style="text-transform: uppercase;">${escapeHtml(q.question_type || 'coding')}</span>
                                    </div>
                                </div>
                                <div class="q-marks-input-wrapper">
                                    <span>Marks:</span>
                                    <input type="number" class="q-marks-input" min="1" max="100" value="${q.custom_marks || q.points || 20}" data-qid="${escapeHtml(q.question_id || q.id)}">
                                </div>
                                <button type="button" class="btn-remove-q btn-remove-question" data-qid="${escapeHtml(q.question_id || q.id)}" title="Remove Question">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Wire section title changes
        container.querySelectorAll('.section-title-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const card = input.closest('.section-builder-card');
                const secId = card?.getAttribute('data-section-id');
                const sec = state.assessment.sections.find(s => s.id === secId);
                if (sec) sec.name = input.value.trim() || 'Section';
            });
        });

        // Wire question marks inputs
        container.querySelectorAll('.q-marks-input').forEach(input => {
            input.addEventListener('change', () => {
                const qid = input.getAttribute('data-qid');
                const val = parseInt(input.value || '20', 10);
                const targetQ = state.assessment.questions.find(q => (q.question_id || q.id) === qid);
                if (targetQ) {
                    targetQ.custom_marks = val;
                    targetQ.points = val;
                    renderSectionsAndQuestions();
                }
            });
        });

        // Wire question removal
        container.querySelectorAll('.btn-remove-question').forEach(btn => {
            btn.addEventListener('click', () => {
                const qid = btn.getAttribute('data-qid');
                state.assessment.questions = state.assessment.questions.filter(q => (q.question_id || q.id) !== qid);
                // Also update question_ids in sections
                state.assessment.sections.forEach(s => {
                    s.question_ids = (s.question_ids || []).filter(id => id !== qid);
                });
                renderSectionsAndQuestions();
            });
        });

        // Wire section removal
        container.querySelectorAll('.btn-remove-section').forEach(btn => {
            btn.addEventListener('click', () => {
                const secId = btn.getAttribute('data-sec-id');
                if (state.assessment.sections.length <= 1) return;
                state.assessment.sections = state.assessment.sections.filter(s => s.id !== secId);
                // Move orphaned questions to first section
                state.assessment.questions.forEach(q => {
                    if (q.section_id === secId) q.section_id = state.assessment.sections[0].id;
                });
                renderSectionsAndQuestions();
            });
        });
    }

    function getDifficultyColor(diff) {
        const d = (diff || '').toLowerCase();
        if (d === 'easy') return '#10b981';
        if (d === 'hard') return '#ef4444';
        return '#f59e0b';
    }

    /**
     * Question Modals: Manual Selection & Automatic Generator
     */
    function initQuestionModals() {
        const btnOpenManual = document.getElementById('btnOpenManualSelectModal');
        const btnOpenAuto = document.getElementById('btnOpenAutoGenerateModal');
        const btnAddSection = document.getElementById('btnAddSectionBtn');

        const modalManual = document.getElementById('modalManualSelect');
        const modalAuto = document.getElementById('modalAutoGenerate');
        const modalPreview = document.getElementById('modalQuestionPreview');

        // Add Section
        if (btnAddSection) {
            btnAddSection.addEventListener('click', () => {
                const newSecId = `sec-${state.assessment.sections.length + 1}`;
                state.assessment.sections.push({
                    id: newSecId,
                    name: `Section ${state.assessment.sections.length + 1}`,
                    instructions: '',
                    duration_minutes: 30,
                    total_marks: 0,
                    question_ids: [],
                    navigation_rule: 'free'
                });
                renderSectionsAndQuestions();
            });
        }

        // Close Modals
        document.querySelectorAll('.btn-close-modal, .btn-dismiss-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            });
        });

        // Open Manual Selection Modal
        if (btnOpenManual) {
            btnOpenManual.addEventListener('click', async () => {
                if (modalManual) modalManual.style.display = 'flex';
                await loadQuestionBankCatalog();
            });
        }

        // Open Automatic Generation Modal
        if (btnOpenAuto) {
            btnOpenAuto.addEventListener('click', () => {
                if (modalAuto) modalAuto.style.display = 'flex';
            });
        }

        // Wire Automatic Generation Submit
        const btnSubmitAuto = document.getElementById('btnSubmitAutoGenerate');
        if (btnSubmitAuto) {
            btnSubmitAuto.addEventListener('click', async () => {
                const pyEasy = parseInt(document.getElementById('autoPyEasy')?.value || '0', 10);
                const pyMed = parseInt(document.getElementById('autoPyMed')?.value || '0', 10);
                const pyHard = parseInt(document.getElementById('autoPyHard')?.value || '0', 10);

                const javaEasy = parseInt(document.getElementById('autoJavaEasy')?.value || '0', 10);
                const javaMed = parseInt(document.getElementById('autoJavaMed')?.value || '0', 10);
                const javaHard = parseInt(document.getElementById('autoJavaHard')?.value || '0', 10);

                const sqlEasy = parseInt(document.getElementById('autoSqlEasy')?.value || '0', 10);
                const sqlMed = parseInt(document.getElementById('autoSqlMed')?.value || '0', 10);
                const sqlHard = parseInt(document.getElementById('autoSqlHard')?.value || '0', 10);

                const cEasy = parseInt(document.getElementById('autoCEasy')?.value || '0', 10);
                const cMed = parseInt(document.getElementById('autoCMed')?.value || '0', 10);
                const cHard = parseInt(document.getElementById('autoCHard')?.value || '0', 10);

                const mcqCount = parseInt(document.getElementById('autoMcqCount')?.value || '0', 10);

                const specs = {};
                if (pyEasy > 0 || pyMed > 0 || pyHard > 0) specs["Python"] = { "Easy": pyEasy, "Medium": pyMed, "Hard": pyHard };
                if (javaEasy > 0 || javaMed > 0 || javaHard > 0) specs["Java"] = { "Easy": javaEasy, "Medium": javaMed, "Hard": javaHard };
                if (sqlEasy > 0 || sqlMed > 0 || sqlHard > 0) specs["SQL"] = { "Easy": sqlEasy, "Medium": sqlMed, "Hard": sqlHard };
                if (cEasy > 0 || cMed > 0 || cHard > 0) specs["C++"] = { "Easy": cEasy, "Medium": cMed, "Hard": cHard };

                if (Object.keys(specs).length === 0 && mcqCount === 0) {
                    alert('Please specify at least 1 question count.');
                    return;
                }

                btnSubmitAuto.disabled = true;
                btnSubmitAuto.textContent = 'Generating...';

                try {
                    const tempId = state.assessmentId || 'new';
                    const res = await adminApi(`/admin/assessments/${tempId}/generate-questions`, {
                        method: 'POST',
                        body: JSON.stringify({
                            specifications: specs,
                            mcq_count: mcqCount
                        })
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        alert(data.detail || 'Question generation failed.');
                        return;
                    }

                    const generated = data.selected_questions || [];
                    const existingIds = new Set(state.assessment.questions.map(q => q.question_id || q.id));

                    let addedCount = 0;
                    generated.forEach(g => {
                        const gid = g.question_id || g.id;
                        if (!existingIds.has(gid)) {
                            state.assessment.questions.push({
                                question_id: gid,
                                order: state.assessment.questions.length + 1,
                                section_id: state.assessment.sections[0]?.id || 'sec-1',
                                custom_marks: g.custom_marks || g.points || 20,
                                title: g.title,
                                difficulty: g.difficulty,
                                points: g.points || 20,
                                languages: g.languages || [],
                                category: g.category || '',
                                question_type: g.question_type || 'coding'
                            });
                            existingIds.add(gid);
                            addedCount++;
                        }
                    });

                    if (modalAuto) modalAuto.style.display = 'none';
                    renderSectionsAndQuestions();
                    alert(`Successfully assembled ${addedCount} questions into assessment!`);

                } catch (err) {
                    alert('Error communicating with generation engine.');
                } finally {
                    btnSubmitAuto.disabled = false;
                    btnSubmitAuto.textContent = 'Generate Questions';
                }
            });
        }
    }

    /**
     * Loads Question Bank Catalog inside Manual Selection Modal
     */
    async function loadQuestionBankCatalog() {
        const listContainer = document.getElementById('qbCatalogList');
        if (!listContainer) return;

        listContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted, #64748b);">Loading questions catalog...</div>';

        const search = document.getElementById('qbSearchInput')?.value || '';
        const lang = document.getElementById('qbLangFilter')?.value || 'all';
        const diff = document.getElementById('qbDiffFilter')?.value || 'all';
        const qtype = document.getElementById('qbTypeFilter')?.value || 'all';

        try {
            let url = `/admin/assessments/questions/catalog?limit=100`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (lang !== 'all') url += `&language=${encodeURIComponent(lang)}`;
            if (diff !== 'all') url += `&difficulty=${encodeURIComponent(diff)}`;
            if (qtype !== 'all') url += `&question_type=${encodeURIComponent(qtype)}`;

            const res = await adminApi(url);
            if (!res.ok) throw new Error('Catalog fetch failed');

            const catalog = await res.json();
            state.qbCatalog = catalog;

            const selectedSet = new Set(state.assessment.questions.map(q => q.question_id || q.id));

            if (catalog.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted, #64748b);">No matching questions found in Question Bank.</div>';
                return;
            }

            listContainer.innerHTML = catalog.map(item => {
                const isChecked = selectedSet.has(item.id);
                return `
                    <div class="qb-catalog-item">
                        <input type="checkbox" class="qb-catalog-checkbox" value="${escapeHtml(item.id)}" ${isChecked ? 'checked' : ''}>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <strong style="color: var(--text-primary, #f8fafc); font-size: 13px;">${escapeHtml(item.title)}</strong>
                                <span style="font-size: 10px; font-weight: 700; color: ${getDifficultyColor(item.difficulty)}; text-transform: uppercase;">${escapeHtml(item.difficulty)}</span>
                                <span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255, 107, 53, 0.1); color: #ff6b35; font-weight: 700;">${escapeHtml(item.question_type)}</span>
                            </div>
                            <span style="font-size: 12px; color: var(--text-muted, #64748b);">${escapeHtml(item.description_snippet)}</span>
                        </div>
                        <div style="text-align: right; font-size: 12px; font-weight: 700; color: #ff6b35; margin-right: 12px;">
                            ${item.points} pts
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: #ef4444;">Failed to load Question Bank catalog.</div>';
        }

        // Wire Add Selected Button
        const btnAddSelected = document.getElementById('btnAddSelectedFromCatalog');
        if (btnAddSelected) {
            btnAddSelected.onclick = () => {
                const checkedBoxes = document.querySelectorAll('.qb-catalog-checkbox:checked');
                const checkedIds = new Set(Array.from(checkedBoxes).map(cb => cb.value));

                // Add newly selected questions
                state.qbCatalog.forEach(qItem => {
                    if (checkedIds.has(qItem.id)) {
                        const exists = state.assessment.questions.some(q => (q.question_id || q.id) === qItem.id);
                        if (!exists) {
                            state.assessment.questions.push({
                                question_id: qItem.id,
                                order: state.assessment.questions.length + 1,
                                section_id: state.assessment.sections[0]?.id || 'sec-1',
                                custom_marks: qItem.points || 20,
                                title: qItem.title,
                                difficulty: qItem.difficulty,
                                points: qItem.points || 20,
                                languages: qItem.languages || [],
                                category: qItem.category || '',
                                question_type: qItem.question_type || 'coding'
                            });
                        }
                    }
                });

                document.getElementById('modalManualSelect').style.display = 'none';
                renderSectionsAndQuestions();
            };
        }
    }

    /**
     * Step 6 Review & Summary Pane
     */
    function renderReviewStep() {
        collectFormData();

        setText('revTitle', state.assessment.title || 'Untitled Assessment');
        setText('revType', state.assessment.assessment_type || 'Coding Examination');
        setText('revDifficulty', state.assessment.difficulty || 'Medium');
        setText('revLanguages', (state.assessment.languages || []).join(', '));
        setText('revTotalQuestions', (state.assessment.questions || []).length);
        setText('revTotalMarks', state.assessment.total_marks || 100);
        setText('revDuration', `${state.assessment.timer_config.total_duration_minutes || 60} minutes`);
        setText('revPassingScore', `${state.assessment.rules.passing_percentage}%`);
        setText('revNavigation', state.assessment.rules.question_navigation === 'linear' ? 'Linear (Sequential Only)' : 'Free Navigation');
        setText('revAssignedCount', `${(state.assessment.assigned_candidates || []).length} candidates`);

        const questionsListContainer = document.getElementById('revQuestionsSummaryList');
        if (questionsListContainer) {
            questionsListContainer.innerHTML = (state.assessment.questions || []).map((q, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-input, #0a0e17); border-radius: 6px; margin-bottom: 8px;">
                    <div>
                        <span style="font-weight: 700; color: #ff6b35; margin-right: 8px;">Q${idx + 1}.</span>
                        <span style="color: var(--text-primary, #f8fafc); font-weight: 600;">${escapeHtml(q.title)}</span>
                        <span style="font-size: 11px; color: ${getDifficultyColor(q.difficulty)}; margin-left: 8px;">(${escapeHtml(q.difficulty)})</span>
                    </div>
                    <span style="font-weight: 700; color: var(--text-primary, #f8fafc);">${q.custom_marks || q.points || 20} pts</span>
                </div>
            `).join('');
        }
    }

    /**
     * Persists Assessment (Draft or Published)
     */
    async function saveAssessment(targetStatus = 'Draft') {
        collectFormData();
        if (!validateCurrentStep(1) || !validateCurrentStep(2) || !validateCurrentStep(3)) return;

        state.assessment.status = targetStatus;

        const payload = {
            title: state.assessment.title,
            description: state.assessment.description,
            assessment_type: state.assessment.assessment_type,
            instructions: state.assessment.instructions,
            difficulty: state.assessment.difficulty,
            languages: state.assessment.languages,
            tags: state.assessment.tags,
            sections: state.assessment.sections,
            questions: state.assessment.questions,
            timer_config: state.assessment.timer_config,
            rules: state.assessment.rules,
            schedule: state.assessment.schedule,
            assigned_candidates: state.assessment.assigned_candidates,
            status: targetStatus
        };

        const btnSaveDraft = document.getElementById('btnWizardSaveDraft');
        const btnPublish = document.getElementById('btnWizardPublish');
        if (btnSaveDraft) btnSaveDraft.disabled = true;
        if (btnPublish) btnPublish.disabled = true;

        try {
            let res;
            if (state.isEditMode && state.assessmentId) {
                res = await adminApi(`/admin/assessments/${encodeURIComponent(state.assessmentId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                res = await adminApi('/admin/assessments', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (!res.ok) {
                showAlert(data.detail || 'Failed to save assessment configuration.');
                return;
            }

            // If user clicked publish, invoke publish endpoint explicitly
            if (targetStatus === 'Published') {
                const targetId = data.assessment?.id || state.assessmentId;
                if (targetId) {
                    await adminApi(`/admin/assessments/${encodeURIComponent(targetId)}/publish`, { method: 'POST' });
                }
            }

            alert(`Assessment '${state.assessment.title}' successfully ${targetStatus === 'Published' ? 'published' : 'saved as Draft'}!`);
            window.location.href = '/admin/assessments';

        } catch (err) {
            console.error('[BugBash] Save error:', err);
            showAlert('Network error while saving assessment.');
        } finally {
            if (btnSaveDraft) btnSaveDraft.disabled = false;
            if (btnPublish) btnPublish.disabled = false;
        }
    }

    function initFormBindings() {
        // Negative marking toggle reveals mark deduction input
        const negToggle = document.getElementById('toggleNegativeMarking');
        const negGroup = document.getElementById('negativeMarkValueGroup');
        if (negToggle && negGroup) {
            negToggle.addEventListener('change', () => {
                negGroup.style.display = negToggle.checked ? 'block' : 'none';
            });
        }
    }

    function showAlert(msg) {
        const box = document.getElementById('formAlertBox');
        if (box) {
            box.textContent = msg;
            box.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert(msg);
        }
    }

    function hideAlert() {
        const box = document.getElementById('formAlertBox');
        if (box) box.style.display = 'none';
    }

    function setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
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

})();
