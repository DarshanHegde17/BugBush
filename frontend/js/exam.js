/**
 * BugBash Coding Assessment Examination Controller
 * Orchestrates multi-panel workspace, server-authoritative timer,
 * code execution sandbox, official evaluation submissions, and proctoring telemetry.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------------
    // 1. Session & Identity Validation
    // --------------------------------------------------------------------------
    const token = localStorage.getItem('bugbash_auth_token') || sessionStorage.getItem('bugbash_auth_token');
    if (!token) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }

    // Resolve attempt_id from URL: /user/assessment/exam/{attempt_id} or ?attempt_id=...
    const urlParams = new URLSearchParams(window.location.search);
    let attemptId = urlParams.get('attempt_id');
    if (!attemptId) {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const lastSeg = pathSegments[pathSegments.length - 1];
        if (lastSeg && lastSeg !== 'exam' && lastSeg !== 'exam.html') {
            attemptId = lastSeg;
        }
    }

    if (!attemptId) {
        alert('Invalid examination session: Attempt ID is missing.');
        window.location.href = '/user/assessments.html';
        return;
    }

    // --------------------------------------------------------------------------
    // 2. State Management
    // --------------------------------------------------------------------------
    const state = {
        attemptId: attemptId,
        token: token,
        attemptData: null,
        questions: [],
        currentQuestionId: null,
        currentQuestionData: null,
        currentLanguage: 'Python',
        autoSaveTimeout: null,
        isSubmittingFinal: false,
        activeConsoleTab: 'samples',
        proctorViolationCount: 0
    };

    // --------------------------------------------------------------------------
    // 3. DOM Elements
    // --------------------------------------------------------------------------
    const elements = {
        // Header
        assessmentTitle: document.getElementById('examAssessmentTitle'),
        attemptBadge: document.getElementById('examAttemptBadge'),
        timerDisplay: document.getElementById('examTimerDisplay'),
        timerContainer: document.getElementById('examTimerContainer'),
        autoSaveStatus: document.getElementById('autoSaveStatus'),
        networkBadge: document.getElementById('networkStatusBadge'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        btnFinalSubmit: document.getElementById('btnFinalSubmitExam'),

        // Left Navigation
        statAnsweredCount: document.getElementById('statAnsweredCount'),
        statReviewCount: document.getElementById('statReviewCount'),
        statNotAnsweredCount: document.getElementById('statNotAnsweredCount'),
        statNotVisitedCount: document.getElementById('statNotVisitedCount'),
        questionNavList: document.getElementById('questionNavList'),

        // Center Panel (Problem Description)
        problemTitle: document.getElementById('problemTitle'),
        problemDifficulty: document.getElementById('problemDifficulty'),
        problemCategory: document.getElementById('problemCategory'),
        problemPoints: document.getElementById('problemPoints'),
        problemLimits: document.getElementById('problemLimits'),
        problemDescription: document.getElementById('problemDescription'),
        problemInputFormat: document.getElementById('problemInputFormat'),
        problemOutputFormat: document.getElementById('problemOutputFormat'),
        problemConstraintsList: document.getElementById('problemConstraintsList'),
        problemExamplesList: document.getElementById('problemExamplesList'),

        // Problem Nav Actions
        btnPrevQuestion: document.getElementById('btnPrevQuestion'),
        btnNextQuestion: document.getElementById('btnNextQuestion'),
        btnMarkReview: document.getElementById('btnMarkReview'),
        btnClearResponse: document.getElementById('btnClearResponse'),

        // Right Panel (Editor & Console)
        languageSelect: document.getElementById('languageSelect'),
        editorThemeSelect: document.getElementById('editorThemeSelect'),
        btnResetCode: document.getElementById('btnResetCode'),
        btnRunCode: document.getElementById('btnRunCode'),
        btnSubmitCode: document.getElementById('btnSubmitCode'),
        runStatusIndicator: document.getElementById('runStatusIndicator'),

        // Console Drawer Tabs
        tabBtnSamples: document.getElementById('tabBtnSamples'),
        tabBtnCustom: document.getElementById('tabBtnCustom'),
        tabBtnOutput: document.getElementById('tabBtnOutput'),
        sampleSubtabsRow: document.getElementById('sampleSubtabsRow'),
        sampleTestBody: document.getElementById('sampleTestBody'),
        customInputContainer: document.getElementById('customInputContainer'),
        customInputText: document.getElementById('customInputText'),
        consoleOutputContainer: document.getElementById('consoleOutputContainer'),
        consoleLogsContent: document.getElementById('consoleLogsContent'),

        // Modals
        modalFinalSubmit: document.getElementById('modalFinalSubmit'),
        modalSubmitTotal: document.getElementById('modalSubmitTotal'),
        modalSubmitAnswered: document.getElementById('modalSubmitAnswered'),
        modalSubmitReview: document.getElementById('modalSubmitReview'),
        modalSubmitUnanswered: document.getElementById('modalSubmitUnanswered'),
        chkConfirmSubmit: document.getElementById('chkConfirmSubmit'),
        btnCancelModalSubmit: document.getElementById('btnCancelModalSubmit'),
        btnConfirmModalSubmit: document.getElementById('btnConfirmModalSubmit'),

        // Expired & Success Modals
        modalAssessmentExpired: document.getElementById('modalAssessmentExpired'),
        modalSubmitSuccess: document.getElementById('modalSubmitSuccess'),
        modalFinalScore: document.getElementById('modalFinalScore'),
        modalFinalPercentage: document.getElementById('modalFinalPercentage'),
        btnReturnDashboard: document.getElementById('btnReturnDashboard'),

        // Proctor Toast
        proctorAlertToast: document.getElementById('proctorAlertToast'),
        proctorToastMsg: document.getElementById('proctorToastMsg')
    };

    // --------------------------------------------------------------------------
    // 4. API Request Helper
    // --------------------------------------------------------------------------
    async function apiRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`,
            ...(options.headers || {})
        };

        const res = await fetch(endpoint, {
            ...options,
            headers
        });

        if (res.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return null;
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'API request failed.');
        }
        return data;
    }

    // --------------------------------------------------------------------------
    // 5. Initialize Exam Session
    // --------------------------------------------------------------------------
    async function initSession() {
        try {
            // A. Fetch attempt metadata
            const attempt = await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}`);
            if (!attempt) return;
            state.attemptData = attempt;

            // Render Header Information
            if (elements.assessmentTitle) elements.assessmentTitle.textContent = attempt.assessment_title;
            if (elements.attemptBadge) elements.attemptBadge.textContent = `#${attempt.attempt_id.toUpperCase()}`;

            // Initialize Server-Authoritative Timer
            window.examTimer.init({
                startedAt: attempt.started_at,
                expiresAt: attempt.expires_at,
                remainingSeconds: attempt.remaining_seconds,
                warningThreshold: attempt.warning_threshold_seconds || 300,
                onTick: handleTimerTick,
                onWarning: handleTimerWarning,
                onExpire: handleTimerExpire
            });

            // If already completed
            if (attempt.status === 'Completed') {
                showFinalSuccessModal({
                    total_score: '--',
                    percentage: '--',
                    message: 'This examination has already been finalized.'
                });
                return;
            }

            // B. Fetch Questions List for Navigation
            await loadQuestionsNavigation();

            // C. Initialize Editor
            await window.bugbashEditor.init('monacoEditorMount', {
                language: state.currentLanguage,
                initialCode: '# Initializing code workspace...\n'
            });

            // Editor auto-save listener
            window.bugbashEditor.onDidChangeContent(() => {
                triggerAutoSave();
            });

            // D. Load First Question
            if (state.questions.length > 0) {
                await loadQuestion(state.questions[0].id);
            }

        } catch (err) {
            console.error('Failed to initialize exam workspace:', err);
            alert(`Unable to load examination session: ${err.message}`);
        }
    }

    // --------------------------------------------------------------------------
    // 6. Question Navigation Panel
    // --------------------------------------------------------------------------
    async function loadQuestionsNavigation() {
        const questions = await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/questions`);
        if (!questions) return;
        state.questions = questions;
        renderQuestionsNavigation();
    }

    function renderQuestionsNavigation() {
        if (!elements.questionNavList) return;
        elements.questionNavList.innerHTML = '';

        let answered = 0;
        let review = 0;
        let notAnswered = 0;
        let notVisited = 0;

        state.questions.forEach((q) => {
            const st = q.status || 'Not Visited';
            if (st === 'Answered') answered++;
            else if (st === 'Marked for Review' || st === 'Answered and Marked for Review') review++;
            else if (st === 'Not Answered') notAnswered++;
            else notVisited++;

            const card = document.createElement('div');
            card.className = `question-nav-card ${q.id === state.currentQuestionId ? 'active' : ''}`;
            card.dataset.id = q.id;

            let statusClass = 'status-not-visited';
            let statusLabel = 'Not Visited';

            if (st === 'Answered') {
                statusClass = 'status-answered';
                statusLabel = 'Answered';
            } else if (st === 'Marked for Review') {
                statusClass = 'status-review';
                statusLabel = 'Review';
            } else if (st === 'Answered and Marked for Review') {
                statusClass = 'status-answered-review';
                statusLabel = 'Ans & Review';
            } else if (st === 'Not Answered') {
                statusClass = 'status-not-answered';
                statusLabel = 'Not Answered';
            }

            card.innerHTML = `
                <div class="q-card-top">
                    <span class="q-order-badge">QUESTION ${q.order}</span>
                    <span class="q-status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="q-card-title">${escapeHtml(q.title)}</div>
                <div class="q-card-footer">
                    <span>${q.difficulty}</span>
                    <span>${q.points} Marks</span>
                </div>
            `;

            card.addEventListener('click', () => {
                if (q.id !== state.currentQuestionId) {
                    loadQuestion(q.id);
                }
            });

            elements.questionNavList.appendChild(card);
        });

        // Update counters
        if (elements.statAnsweredCount) elements.statAnsweredCount.textContent = answered;
        if (elements.statReviewCount) elements.statReviewCount.textContent = review;
        if (elements.statNotAnsweredCount) elements.statNotAnsweredCount.textContent = notAnswered;
        if (elements.statNotVisitedCount) elements.statNotVisitedCount.textContent = notVisited;
    }

    // --------------------------------------------------------------------------
    // 7. Problem Loading & Center Panel Render
    // --------------------------------------------------------------------------
    async function loadQuestion(questionId) {
        try {
            state.currentQuestionId = questionId;

            // Fetch question detail
            const q = await apiRequest(`/api/v1/questions/${questionId}?attempt_id=${state.attemptId}`);
            if (!q) return;
            state.currentQuestionData = q;

            // Update Header & Meta
            if (elements.problemTitle) elements.problemTitle.textContent = `Q${q.order}. ${q.title}`;
            if (elements.problemDifficulty) {
                elements.problemDifficulty.textContent = q.difficulty;
                elements.problemDifficulty.className = `badge-tag badge-${q.difficulty.toLowerCase()}`;
            }
            if (elements.problemCategory) elements.problemCategory.textContent = q.category || 'General';
            if (elements.problemPoints) elements.problemPoints.textContent = `${q.points} Marks`;

            // Description & Format
            if (elements.problemDescription) elements.problemDescription.innerHTML = formatMarkdown(q.description);
            if (elements.problemInputFormat) elements.problemInputFormat.textContent = q.input_format;
            if (elements.problemOutputFormat) elements.problemOutputFormat.textContent = q.output_format;

            // Constraints
            if (elements.problemConstraintsList) {
                elements.problemConstraintsList.innerHTML = '';
                (q.constraints || []).forEach(c => {
                    const li = document.createElement('li');
                    li.textContent = c;
                    elements.problemConstraintsList.appendChild(li);
                });
            }

            // Examples
            if (elements.problemExamplesList) {
                elements.problemExamplesList.innerHTML = '';
                (q.examples || []).forEach((ex, idx) => {
                    const exCard = document.createElement('div');
                    exCard.className = 'example-card';
                    exCard.innerHTML = `
                        <div class="example-card-header">
                            <span>Example ${idx + 1}</span>
                        </div>
                        <div class="example-card-body">
                            <div class="example-io-block">
                                <span class="example-io-label">Input</span>
                                <div class="example-io-code">${escapeHtml(ex.input)}</div>
                            </div>
                            <div class="example-io-block">
                                <span class="example-io-label">Output</span>
                                <div class="example-io-code">${escapeHtml(ex.output)}</div>
                            </div>
                            ${ex.explanation ? `<div class="example-explanation"><strong>Explanation:</strong> ${escapeHtml(ex.explanation)}</div>` : ''}
                        </div>
                    `;
                    elements.problemExamplesList.appendChild(exCard);
                });
            }

            // Update Prev / Next Buttons
            const currentIndex = state.questions.findIndex(x => x.id === questionId);
            if (elements.btnPrevQuestion) elements.btnPrevQuestion.disabled = currentIndex <= 0;
            if (elements.btnNextQuestion) elements.btnNextQuestion.disabled = currentIndex >= state.questions.length - 1;

            // Update Mark for Review Button state
            const currentStatus = q.current_status || 'Not Answered';
            const isReview = currentStatus.includes('Marked for Review');
            if (elements.btnMarkReview) {
                if (isReview) {
                    elements.btnMarkReview.classList.add('active');
                    elements.btnMarkReview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Marked for Review';
                } else {
                    elements.btnMarkReview.classList.remove('active');
                    elements.btnMarkReview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Mark for Review';
                }
            }

            // Load Code into Editor
            const lang = q.draft_language || state.currentLanguage;
            state.currentLanguage = lang;
            if (elements.languageSelect) elements.languageSelect.value = lang;
            window.bugbashEditor.setLanguage(lang);

            const codeToLoad = q.draft_code || (q.starter_code ? q.starter_code[lang] : '') || '# Write code here\n';
            window.bugbashEditor.setValue(codeToLoad);

            // Render Sample Test Cases Sub-tabs
            renderSampleTestCases(q.sample_test_cases || []);

            // Refresh Navigation Cards
            await loadQuestionsNavigation();

        } catch (err) {
            console.error('Failed to load question:', err);
        }
    }

    // --------------------------------------------------------------------------
    // 8. Console Tabs & Test Cases Rendering
    // --------------------------------------------------------------------------
    function renderSampleTestCases(cases) {
        if (!elements.sampleSubtabsRow || !elements.sampleTestBody) return;
        elements.sampleSubtabsRow.innerHTML = '';

        if (!cases || cases.length === 0) {
            elements.sampleTestBody.innerHTML = '<div style="color: var(--text-muted);">No sample test cases provided.</div>';
            return;
        }

        cases.forEach((tc, idx) => {
            const btn = document.createElement('button');
            btn.className = `sample-subtab-btn ${idx === 0 ? 'active' : ''}`;
            btn.textContent = `Case ${idx + 1}`;
            btn.dataset.index = idx;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sample-subtab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                displaySampleCase(tc);
            });
            elements.sampleSubtabsRow.appendChild(btn);
        });

        displaySampleCase(cases[0]);
    }

    function displaySampleCase(tc, actualOutput = null, isMatch = null) {
        if (!elements.sampleTestBody) return;
        elements.sampleTestBody.innerHTML = `
            <div class="test-io-grid">
                <div>
                    <div class="test-field-label">Input</div>
                    <div class="test-field-box">${escapeHtml(tc.input)}</div>
                </div>
                <div>
                    <div class="test-field-label">Expected Output</div>
                    <div class="test-field-box">${escapeHtml(tc.output)}</div>
                </div>
            </div>
            ${actualOutput !== null ? `
                <div style="margin-top: 10px;">
                    <div class="test-field-label">Actual Output</div>
                    <div class="test-field-box ${isMatch ? 'actual-match' : 'actual-mismatch'}">${escapeHtml(actualOutput)}</div>
                </div>
            ` : ''}
        `;
    }

    function switchConsoleTab(tabName) {
        state.activeConsoleTab = tabName;
        [elements.tabBtnSamples, elements.tabBtnCustom, elements.tabBtnOutput].forEach(b => b.classList.remove('active'));

        elements.sampleTestBody.style.display = 'none';
        elements.sampleSubtabsRow.style.display = 'none';
        elements.customInputContainer.style.display = 'none';
        elements.consoleOutputContainer.style.display = 'none';

        if (tabName === 'samples') {
            elements.tabBtnSamples.classList.add('active');
            elements.sampleTestBody.style.display = 'block';
            elements.sampleSubtabsRow.style.display = 'flex';
        } else if (tabName === 'custom') {
            elements.tabBtnCustom.classList.add('active');
            elements.customInputContainer.style.display = 'block';
        } else if (tabName === 'output') {
            elements.tabBtnOutput.classList.add('active');
            elements.consoleOutputContainer.style.display = 'block';
        }
    }

    // Tab button click listeners
    if (elements.tabBtnSamples) elements.tabBtnSamples.addEventListener('click', () => switchConsoleTab('samples'));
    if (elements.tabBtnCustom) elements.tabBtnCustom.addEventListener('click', () => switchConsoleTab('custom'));
    if (elements.tabBtnOutput) elements.tabBtnOutput.addEventListener('click', () => switchConsoleTab('output'));

    // --------------------------------------------------------------------------
    // 9. Auto-Save Engine (Debounced)
    // --------------------------------------------------------------------------
    function triggerAutoSave() {
        if (!state.currentQuestionId) return;

        if (elements.autoSaveStatus) {
            elements.autoSaveStatus.className = 'autosave-status saving';
            elements.autoSaveStatus.innerHTML = '<span class="pulse-dot" style="background: var(--warning);"></span> Saving...';
        }

        clearTimeout(state.autoSaveTimeout);
        state.autoSaveTimeout = setTimeout(async () => {
            await executeAutoSave();
        }, 1500);
    }

    async function executeAutoSave() {
        try {
            const code = window.bugbashEditor.getValue();
            const res = await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/draft`, {
                method: 'PUT',
                body: JSON.stringify({
                    question_id: state.currentQuestionId,
                    language: state.currentLanguage,
                    code: code
                })
            });

            if (res && res.saved) {
                if (elements.autoSaveStatus) {
                    elements.autoSaveStatus.className = 'autosave-status';
                    elements.autoSaveStatus.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved';
                }
            }
        } catch (err) {
            console.error('Auto-save error:', err);
            if (elements.autoSaveStatus) {
                elements.autoSaveStatus.className = 'autosave-status failed';
                elements.autoSaveStatus.innerHTML = '⚠ Save Failed';
            }
        }
    }

    // --------------------------------------------------------------------------
    // 10. Run Code Action (Sample Test Cases in Sandbox)
    // --------------------------------------------------------------------------
    if (elements.btnRunCode) {
        elements.btnRunCode.addEventListener('click', async () => {
            const code = window.bugbashEditor.getValue();
            if (!code.trim()) {
                alert('Please enter your code solution before running.');
                return;
            }

            elements.btnRunCode.disabled = true;
            elements.runStatusIndicator.className = 'run-status-indicator running';
            elements.runStatusIndicator.innerHTML = '<span class="pulse-dot" style="background: var(--warning);"></span> Running Sandbox...';

            // Check if custom input tab is active
            const customInput = state.activeConsoleTab === 'custom' && elements.customInputText 
                ? elements.customInputText.value 
                : null;

            try {
                const res = await apiRequest('/api/v1/executions/run', {
                    method: 'POST',
                    body: JSON.stringify({
                        attempt_id: state.attemptId,
                        question_id: state.currentQuestionId,
                        language: state.currentLanguage,
                        code: code,
                        custom_input: customInput
                    })
                });

                switchConsoleTab('output');
                elements.consoleLogsContent.innerHTML = '';

                if (res.status === 'success') {
                    elements.runStatusIndicator.className = 'run-status-indicator accepted';
                    elements.runStatusIndicator.innerHTML = `✔ Execution Successful (${res.passed_count}/${res.total_count} Passed)`;

                    let logHtml = `<div class="console-log-entry success"><strong>✔ Code executed without runtime errors.</strong></div>`;
                    if (res.sample_tests && res.sample_tests.length > 0) {
                        res.sample_tests.forEach((st, i) => {
                            logHtml += `
                                <div class="console-log-entry ${st.passed ? 'success' : 'error'}" style="margin-top: 8px;">
                                    <strong>Test Case ${i + 1}: ${st.passed ? 'PASSED' : 'FAILED'}</strong> (${st.execution_time_ms}ms)
                                    <div>Input: ${escapeHtml(st.input)}</div>
                                    <div>Expected: ${escapeHtml(st.expected_output)}</div>
                                    <div>Actual: ${escapeHtml(st.actual_output)}</div>
                                </div>
                            `;
                        });
                    }

                    logHtml += `
                        <div class="execution-stats-bar">
                            <span>Execution Time: ${res.execution_time_ms} ms</span>
                            <span>Memory: ${res.memory_kb ? res.memory_kb.toFixed(1) + ' KB' : 'N/A'}</span>
                        </div>
                    `;
                    elements.consoleLogsContent.innerHTML = logHtml;

                } else if (res.status === 'compilation_error') {
                    elements.runStatusIndicator.className = 'run-status-indicator error';
                    elements.runStatusIndicator.innerHTML = '✖ Compilation Error';
                    elements.consoleLogsContent.innerHTML = `
                        <div class="console-log-entry error"><strong>Compilation Error:</strong></div>
                        <div class="console-log-entry error">${escapeHtml(res.stderr || res.output)}</div>
                    `;
                } else if (res.status === 'time_limit_exceeded') {
                    elements.runStatusIndicator.className = 'run-status-indicator error';
                    elements.runStatusIndicator.innerHTML = '⏱ Time Limit Exceeded (> 3.0s)';
                    elements.consoleLogsContent.innerHTML = `
                        <div class="console-log-entry error"><strong>Time Limit Exceeded:</strong></div>
                        <div class="console-log-entry error">${escapeHtml(res.stderr || 'Execution exceeded the 3.0s deadline.')}</div>
                    `;
                } else {
                    elements.runStatusIndicator.className = 'run-status-indicator error';
                    elements.runStatusIndicator.innerHTML = '✖ Runtime Error';
                    elements.consoleLogsContent.innerHTML = `
                        <div class="console-log-entry error"><strong>Runtime Error:</strong></div>
                        <div class="console-log-entry error">${escapeHtml(res.stderr || res.output || 'Unknown error occurred.')}</div>
                    `;
                }

            } catch (err) {
                console.error('Run code error:', err);
                switchConsoleTab('output');
                elements.runStatusIndicator.className = 'run-status-indicator error';
                elements.runStatusIndicator.innerHTML = '✖ Failed to run code';
                elements.consoleLogsContent.innerHTML = `<div class="console-log-entry error">${escapeHtml(err.message)}</div>`;
            } finally {
                elements.btnRunCode.disabled = false;
            }
        });
    }

    // --------------------------------------------------------------------------
    // 11. Submit Code Action (Official Evaluation Pipeline)
    // --------------------------------------------------------------------------
    if (elements.btnSubmitCode) {
        elements.btnSubmitCode.addEventListener('click', async () => {
            const code = window.bugbashEditor.getValue();
            if (!code.trim()) {
                alert('Please write your solution code before submitting.');
                return;
            }

            if (!confirm('Submit code for official evaluation? Your solution will be validated against all visible and hidden test cases.')) {
                return;
            }

            elements.btnSubmitCode.disabled = true;
            elements.runStatusIndicator.className = 'run-status-indicator running';
            elements.runStatusIndicator.innerHTML = '<span class="pulse-dot" style="background: var(--warning);"></span> Evaluating Official Test Suite...';

            try {
                const res = await apiRequest('/api/v1/submissions', {
                    method: 'POST',
                    body: JSON.stringify({
                        attempt_id: state.attemptId,
                        question_id: state.currentQuestionId,
                        language: state.currentLanguage,
                        code: code
                    })
                });

                switchConsoleTab('output');
                if (res.status === 'Accepted') {
                    elements.runStatusIndicator.className = 'run-status-indicator accepted';
                    elements.runStatusIndicator.innerHTML = `✔ Accepted (${res.passed_test_cases}/${res.total_test_cases} Test Cases) | +${res.score} Marks`;
                } else {
                    elements.runStatusIndicator.className = 'run-status-indicator error';
                    elements.runStatusIndicator.innerHTML = `✖ ${res.status} (${res.passed_test_cases}/${res.total_test_cases} Passed)`;
                }

                elements.consoleLogsContent.innerHTML = `
                    <div class="console-log-entry ${res.status === 'Accepted' ? 'success' : 'error'}">
                        <strong>Official Evaluation Result: ${res.status}</strong>
                        <div>${escapeHtml(res.feedback)}</div>
                        <div style="margin-top: 6px;">Score Awarded: <strong>${res.score} / ${res.max_score} Marks</strong></div>
                        <div>Passed Test Cases: <strong>${res.passed_test_cases} / ${res.total_test_cases}</strong></div>
                    </div>
                    <div class="execution-stats-bar">
                        <span>Total Execution Time: ${res.execution_time_ms} ms</span>
                        <span>Submission ID: ${res.submission_id}</span>
                        <span>Status: ${res.question_status}</span>
                    </div>
                `;

                // Reload question navigation to reflect the new "Answered" status
                await loadQuestionsNavigation();

            } catch (err) {
                console.error('Submission error:', err);
                switchConsoleTab('output');
                elements.runStatusIndicator.className = 'run-status-indicator error';
                elements.runStatusIndicator.innerHTML = '✖ Submission Failed';
                elements.consoleLogsContent.innerHTML = `<div class="console-log-entry error">${escapeHtml(err.message)}</div>`;
            } finally {
                elements.btnSubmitCode.disabled = false;
            }
        });
    }

    // --------------------------------------------------------------------------
    // 12. Question Action Buttons (Prev, Next, Mark for Review, Clear)
    // --------------------------------------------------------------------------
    if (elements.btnPrevQuestion) {
        elements.btnPrevQuestion.addEventListener('click', async () => {
            await executeAutoSave();
            const idx = state.questions.findIndex(x => x.id === state.currentQuestionId);
            if (idx > 0) {
                await loadQuestion(state.questions[idx - 1].id);
            }
        });
    }

    if (elements.btnNextQuestion) {
        elements.btnNextQuestion.addEventListener('click', async () => {
            await executeAutoSave();
            const idx = state.questions.findIndex(x => x.id === state.currentQuestionId);
            if (idx < state.questions.length - 1) {
                await loadQuestion(state.questions[idx + 1].id);
            }
        });
    }

    if (elements.btnMarkReview) {
        elements.btnMarkReview.addEventListener('click', async () => {
            if (!state.currentQuestionId || !state.currentQuestionData) return;

            const currStatus = state.currentQuestionData.current_status || 'Not Answered';
            let newStatus;
            if (currStatus.includes('Marked for Review')) {
                newStatus = currStatus.includes('Answered') ? 'Answered' : 'Not Answered';
            } else {
                newStatus = currStatus.includes('Answered') ? 'Answered and Marked for Review' : 'Marked for Review';
            }

            state.currentQuestionData.current_status = newStatus;

            // Save immediately
            const code = window.bugbashEditor.getValue();
            await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/draft`, {
                method: 'PUT',
                body: JSON.stringify({
                    question_id: state.currentQuestionId,
                    language: state.currentLanguage,
                    code: code,
                    status: newStatus
                })
            });

            // Update button visual
            const isReview = newStatus.includes('Marked for Review');
            if (isReview) {
                elements.btnMarkReview.classList.add('active');
                elements.btnMarkReview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Marked for Review';
            } else {
                elements.btnMarkReview.classList.remove('active');
                elements.btnMarkReview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Mark for Review';
            }

            await loadQuestionsNavigation();
        });
    }

    if (elements.btnClearResponse) {
        elements.btnClearResponse.addEventListener('click', () => {
            if (!confirm('Are you sure you want to clear your current code response?')) return;
            const starter = (state.currentQuestionData && state.currentQuestionData.starter_code)
                ? (state.currentQuestionData.starter_code[state.currentLanguage] || '')
                : '';
            window.bugbashEditor.setValue(starter);
            triggerAutoSave();
        });
    }

    if (elements.btnResetCode) {
        elements.btnResetCode.addEventListener('click', () => {
            if (!confirm('Reset code to default starter template?')) return;
            const starter = (state.currentQuestionData && state.currentQuestionData.starter_code)
                ? (state.currentQuestionData.starter_code[state.currentLanguage] || '')
                : '';
            window.bugbashEditor.setValue(starter);
            triggerAutoSave();
        });
    }

    // Language Selector
    if (elements.languageSelect) {
        elements.languageSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            state.currentLanguage = newLang;
            window.bugbashEditor.setLanguage(newLang);

            // If empty or matches old template, set starter code for new language
            const currCode = window.bugbashEditor.getValue().trim();
            if (!currCode || currCode.startsWith('#') || currCode.startsWith('//') || currCode.startsWith('import')) {
                if (state.currentQuestionData && state.currentQuestionData.starter_code && state.currentQuestionData.starter_code[newLang]) {
                    window.bugbashEditor.setValue(state.currentQuestionData.starter_code[newLang]);
                }
            }
            triggerAutoSave();
        });
    }

    // Editor Theme Selector
    if (elements.editorThemeSelect) {
        elements.editorThemeSelect.addEventListener('change', (e) => {
            const isDark = e.target.value === 'vs-dark';
            window.bugbashEditor.setTheme(isDark);
        });
    }

    // --------------------------------------------------------------------------
    // 13. Server-Authoritative Timer Event Handlers
    // --------------------------------------------------------------------------
    function handleTimerTick({ formatted, remainingSeconds, isWarning, isCritical }) {
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = formatted;
            elements.timerDisplay.className = `timer-countdown ${isCritical ? 'critical' : (isWarning ? 'warning' : '')}`;
        }
    }

    function handleTimerWarning(remainingSeconds) {
        showProctorToast(`Notice: ${Math.floor(remainingSeconds / 60)} minutes remaining in your examination.`);
    }

    async function handleTimerExpire() {
        if (elements.modalAssessmentExpired) {
            elements.modalAssessmentExpired.classList.add('open');
        }
        // Finalize automatically
        try {
            await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/final-submit`, {
                method: 'POST',
                body: JSON.stringify({ feedback: 'Auto-submitted due to timer expiration.' })
            });
        } catch (e) {
            console.warn('Auto-submit expired attempt error:', e);
        }
    }

    // --------------------------------------------------------------------------
    // 14. Final Submission Modal Workflow
    // --------------------------------------------------------------------------
    if (elements.btnFinalSubmit) {
        elements.btnFinalSubmit.addEventListener('click', async () => {
            await executeAutoSave();
            await loadQuestionsNavigation();

            let answered = 0;
            let review = 0;
            let notAnswered = 0;

            state.questions.forEach(q => {
                const st = q.status || 'Not Visited';
                if (st.includes('Answered')) answered++;
                if (st.includes('Marked for Review')) review++;
                if (st === 'Not Answered' || st === 'Not Visited') notAnswered++;
            });

            if (elements.modalSubmitTotal) elements.modalSubmitTotal.textContent = state.questions.length;
            if (elements.modalSubmitAnswered) elements.modalSubmitAnswered.textContent = answered;
            if (elements.modalSubmitReview) elements.modalSubmitReview.textContent = review;
            if (elements.modalSubmitUnanswered) elements.modalSubmitUnanswered.textContent = notAnswered;

            if (elements.chkConfirmSubmit) elements.chkConfirmSubmit.checked = false;
            if (elements.btnConfirmModalSubmit) elements.btnConfirmModalSubmit.disabled = true;

            elements.modalFinalSubmit.classList.add('open');
        });
    }

    if (elements.chkConfirmSubmit) {
        elements.chkConfirmSubmit.addEventListener('change', (e) => {
            if (elements.btnConfirmModalSubmit) {
                elements.btnConfirmModalSubmit.disabled = !e.target.checked;
            }
        });
    }

    if (elements.btnCancelModalSubmit) {
        elements.btnCancelModalSubmit.addEventListener('click', () => {
            elements.modalFinalSubmit.classList.remove('open');
        });
    }

    if (elements.btnConfirmModalSubmit) {
        elements.btnConfirmModalSubmit.addEventListener('click', async () => {
            elements.btnConfirmModalSubmit.disabled = true;
            elements.btnConfirmModalSubmit.textContent = 'Finalizing Submission...';

            try {
                const res = await apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/final-submit`, {
                    method: 'POST',
                    body: JSON.stringify({ feedback: 'Final assessment submission confirmed by candidate.' })
                });

                elements.modalFinalSubmit.classList.remove('open');
                window.examTimer.stop();
                showFinalSuccessModal(res);

            } catch (err) {
                alert(`Submission failed: ${err.message}`);
                elements.btnConfirmModalSubmit.disabled = false;
                elements.btnConfirmModalSubmit.textContent = 'Confirm Final Submission';
            }
        });
    }

    function showFinalSuccessModal(summary) {
        if (!elements.modalSubmitSuccess) return;
        if (elements.modalFinalScore) elements.modalFinalScore.textContent = `${summary.total_score || 0} / ${summary.max_score || 100}`;
        if (elements.modalFinalPercentage) elements.modalFinalPercentage.textContent = `${summary.percentage || 0}%`;
        elements.modalSubmitSuccess.classList.add('open');
    }

    if (elements.btnReturnDashboard) {
        elements.btnReturnDashboard.addEventListener('click', () => {
            window.location.href = '/user/assessments.html';
        });
    }

    // --------------------------------------------------------------------------
    // 15. Proctoring Telemetry & Security Monitoring
    // --------------------------------------------------------------------------
    function logProctorEvent(eventType, details) {
        state.proctorViolationCount++;
        apiRequest(`/api/v1/assessment-attempts/${state.attemptId}/events`, {
            method: 'POST',
            body: JSON.stringify({
                event_type: eventType,
                details: details
            })
        }).catch(err => console.warn('Proctor event log failed:', err));
    }

    function showProctorToast(message) {
        if (!elements.proctorAlertToast) return;
        if (elements.proctorToastMsg) elements.proctorToastMsg.textContent = message;
        elements.proctorAlertToast.classList.add('visible');
        setTimeout(() => {
            elements.proctorAlertToast.classList.remove('visible');
        }, 4500);
    }

    // Browser tab visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            logProctorEvent('tab_switch', 'Candidate navigated away from the active examination tab.');
            showProctorToast('Proctor Alert: Tab switch detected! Event logged to assessment telemetry.');
        }
    });

    // Window focus loss (Alt+Tab, clicking outside)
    window.addEventListener('blur', () => {
        logProctorEvent('focus_lost', 'Application window lost focus.');
        showProctorToast('Proctor Alert: Application focus changed. Please remain inside the exam.');
    });

    // Network connectivity change
    window.addEventListener('offline', () => {
        if (elements.networkBadge) {
            elements.networkBadge.innerHTML = '<span class="dot-online dot-offline"></span> Offline';
        }
        showProctorToast('Network Disconnected! Code will be queued locally until reconnected.');
    });

    window.addEventListener('online', () => {
        if (elements.networkBadge) {
            elements.networkBadge.innerHTML = '<span class="dot-online"></span> Online';
        }
        showProctorToast('Network Reconnected! Cloud synchronization restored.');
        executeAutoSave();
    });

    // Copy / Paste detection according to exam policy
    document.addEventListener('copy', (e) => {
        logProctorEvent('clipboard_copy', 'Copy event triggered.');
    });

    document.addEventListener('paste', (e) => {
        logProctorEvent('clipboard_paste', 'Paste event triggered.');
    });

    // --------------------------------------------------------------------------
    // 16. Theme Toggle Support
    // --------------------------------------------------------------------------
    function initTheme() {
        const savedTheme = localStorage.getItem('bugbash_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        window.bugbashEditor.setTheme(savedTheme === 'dark');

        if (elements.themeToggleBtn) {
            elements.themeToggleBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const nextTheme = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nextTheme);
                localStorage.setItem('bugbash_theme', nextTheme);
                window.bugbashEditor.setTheme(nextTheme === 'dark');
            });
        }
    }

    // --------------------------------------------------------------------------
    // 17. Utilities
    // --------------------------------------------------------------------------
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\n\n/g, '<br><br>');
        return html;
    }

    // Start Everything
    initTheme();
    initSession();
});
