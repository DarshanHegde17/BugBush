/**
 * ==============================================================================
 * BugBash - Practice Problem Solver Controller
 * ==============================================================================
 * Connects frontend coding workspace with FastAPI:
 * - GET  /api/v1/practice/problems/{id}
 * - POST /api/v1/practice/execute
 * - POST /api/v1/practice/submit
 * Handles Monaco Editor / fallback, code execution, submission evaluation,
 * test case output diffing, and ML feedback rendering.
 */

(function () {
    'use strict';

    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    function getAuthToken() {
        return localStorage.getItem('bugbash_auth_token') ||
               sessionStorage.getItem('bugbash_auth_token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('token');
    }

    // Problem State
    let currentProblem = null;
    let currentLanguage = 'Python';
    let codeEditor = null;
    let isMonaco = false;

    // Elements
    const elements = {
        title: document.getElementById('problemTitleLarge'),
        headerTitle: document.getElementById('headerProblemTitle'),
        difficultyBadge: document.getElementById('problemDifficultyBadge'),
        categoryText: document.getElementById('problemCategoryText'),
        acceptanceText: document.getElementById('problemAcceptanceText'),
        descriptionContent: document.getElementById('problemDescriptionContent'),
        inputFormat: document.getElementById('problemInputFormat'),
        outputFormat: document.getElementById('problemOutputFormat'),
        constraints: document.getElementById('problemConstraints'),
        sampleCases: document.getElementById('sampleCasesContainer'),
        
        languageSelect: document.getElementById('languageSelectDropdown'),
        editorContainer: document.getElementById('monacoContainer'),
        textareaFallback: document.getElementById('codeTextareaFallback'),
        
        btnRunCode: document.getElementById('btnRunCode'),
        btnSubmitSolution: document.getElementById('btnSubmitSolution'),
        btnResetCode: document.getElementById('btnResetCode'),
        
        // Output Drawer
        tabResults: document.getElementById('tabTestResults'),
        tabConsole: document.getElementById('tabConsoleOutput'),
        tabInsights: document.getElementById('tabMLInsights'),
        drawerContent: document.getElementById('drawerContentArea')
    };

    /**
     * Get Problem ID from URL
     */
    function getProblemId() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('id')) return urlParams.get('id');

        const parts = window.location.pathname.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== 'practice-problem.html' && lastPart !== 'practice-problem') {
            return lastPart;
        }
        return 'prob-01'; // Default
    }

    /**
     * Load Problem Details from FastAPI
     */
    async function loadProblem() {
        const problemId = getProblemId();
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        try {
            const resp = await fetch(`${API_BASE}/practice/problems/${problemId}`, { headers });
            if (!resp.ok) throw new Error('Problem not found.');

            currentProblem = await resp.json();
            renderProblemDetails(currentProblem);
            initCodeEditor(currentProblem);
        } catch (err) {
            console.error('Error fetching problem details:', err);
            if (elements.descriptionContent) {
                elements.descriptionContent.innerHTML = `<div style="color:#ef4444;">Error loading problem details.</div>`;
            }
        }
    }

    function renderProblemDetails(prob) {
        if (elements.title) elements.title.textContent = prob.title;
        if (elements.headerTitle) elements.headerTitle.textContent = prob.title;
        
        if (elements.difficultyBadge) {
            elements.difficultyBadge.textContent = prob.difficulty;
            elements.difficultyBadge.className = `badge badge-${prob.difficulty.toLowerCase()}`;
        }

        if (elements.categoryText) elements.categoryText.textContent = prob.category;
        if (elements.acceptanceText) elements.acceptanceText.textContent = `Acceptance: ${prob.acceptance_rate}`;

        if (elements.descriptionContent) {
            elements.descriptionContent.innerHTML = prob.description.replace(/\n/g, '<br>');
        }

        if (elements.inputFormat) elements.inputFormat.textContent = prob.input_format || 'Standard input format.';
        if (elements.outputFormat) elements.outputFormat.textContent = prob.output_format || 'Standard output format.';
        if (elements.constraints) elements.constraints.textContent = prob.constraints || 'Standard algorithm constraints.';

        if (elements.sampleCases && prob.test_cases) {
            elements.sampleCases.innerHTML = prob.test_cases.slice(0, 2).map((tc, idx) => `
                <div class="sample-case-box">
                    <div class="sample-label">Example ${idx + 1} Input:</div>
                    <div class="sample-code">${escapeHtml(tc.input_data)}</div>
                    <div class="sample-label">Expected Output:</div>
                    <div class="sample-code">${escapeHtml(tc.expected_output)}</div>
                    ${tc.explanation ? `<div class="sample-label">Explanation:</div><div style="color:var(--text-muted); font-size:12px;">${escapeHtml(tc.explanation)}</div>` : ''}
                </div>
            `).join('');
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Initialize Monaco Editor with Fallback
     */
    function initCodeEditor(prob) {
        const starterCode = prob.starter_templates?.[currentLanguage] ||
            prob.starter_code ||
            '# Write your solution here\n';

        if (window.monaco && elements.editorContainer) {
            try {
                isMonaco = true;
                if (elements.textareaFallback) elements.textareaFallback.style.display = 'none';

                codeEditor = window.monaco.editor.create(elements.editorContainer, {
                    value: starterCode,
                    language: getMonacoLang(currentLanguage),
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    tabSize: 4
                });
                return;
            } catch (e) {
                console.warn('Monaco init error, falling back to textarea', e);
            }
        }

        // Fallback to Textarea
        isMonaco = false;
        if (elements.textareaFallback) {
            elements.textareaFallback.style.display = 'block';
            elements.textareaFallback.value = starterCode;
        }
    }

    function getMonacoLang(lang) {
        const l = (lang || '').toLowerCase();
        if (l === 'python') return 'python';
        if (l === 'javascript') return 'javascript';
        if (l === 'c++' || l === 'c') return 'cpp';
        if (l === 'java') return 'java';
        if (l === 'sql') return 'sql';
        return 'plaintext';
    }

    function getCodeValue() {
        if (isMonaco && codeEditor) {
            return codeEditor.getValue();
        }
        return elements.textareaFallback ? elements.textareaFallback.value : '';
    }

    function setCodeValue(val) {
        if (isMonaco && codeEditor) {
            codeEditor.setValue(val);
        } else if (elements.textareaFallback) {
            elements.textareaFallback.value = val;
        }
    }

    /**
     * Run Code (Execute Sample Test Cases)
     */
    async function runCode() {
        const code = getCodeValue();
        if (!code.trim()) {
            alert('Please write code before running.');
            return;
        }

        const origBtnText = elements.btnRunCode.innerHTML;
        elements.btnRunCode.disabled = true;
        elements.btnRunCode.innerHTML = `<span>Executing...</span>`;

        switchDrawerTab('results');
        elements.drawerContent.innerHTML = `<div style="color:var(--text-muted);">Running test cases against Python / execution sandbox...</div>`;

        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const resp = await fetch(`${API_BASE}/practice/execute`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    problem_id: currentProblem.id,
                    language: currentLanguage,
                    code: code,
                    test_cases: (currentProblem.test_cases || []).slice(0, 2)
                })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || 'Execution failed.');
            }

            const res = await resp.json();
            renderRunResults(res);

        } catch (err) {
            console.error('Run code error:', err);
            elements.drawerContent.innerHTML = `<div style="color:#ef4444;">Execution Error: ${err.message}</div>`;
        } finally {
            elements.btnRunCode.disabled = false;
            elements.btnRunCode.innerHTML = origBtnText;
        }
    }

    function renderRunResults(res) {
        const passedCount = res.passed_sample_cases ?? res.passed_count ?? 0;
        const totalCount = res.total_sample_cases ?? res.total_test_cases ?? 0;
        const isSuccess = res.status === 'Success' && (totalCount === 0 || passedCount === totalCount);
        const color = isSuccess ? '#10b981' : '#ef4444';
        const resultsList = res.sample_results || res.results || [];

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                <div style="font-weight:700; color:${color}; font-size:15px;">
                    ${isSuccess ? '✓ Accepted' : '✗ Test Cases Failed'}
                </div>
                <div style="color:var(--text-muted); font-size:12px;">
                    ${passedCount}/${totalCount} Passed &bull; ${(res.execution_time_ms || 0).toFixed(1)} ms
                </div>
            </div>
        `;

        if (res.stderr) {
            html += `<pre style="color:#ef4444; background:rgba(239,68,68,0.1); padding:8px; border-radius:6px; font-size:12px; margin-bottom:10px;">${escapeHtml(res.stderr)}</pre>`;
        }

        html += resultsList.map((r, i) => {
            const inputVal = r.input_data ?? r.input ?? '';
            const expectedVal = r.expected_output ?? r.expected ?? '';
            const actualVal = r.actual_output ?? r.output ?? '';
            const isCasePassed = r.passed === true;

            return `
                <div style="margin-bottom:10px; background:var(--input-bg); padding:10px; border-radius:6px; border:1px solid ${isCasePassed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
                    <div style="font-size:12px; font-weight:700; color:${isCasePassed ? '#10b981' : '#ef4444'}; margin-bottom:4px;">
                        Case ${i + 1}: ${isCasePassed ? 'Passed' : 'Wrong Answer'}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">Input: <span style="color:#e2e8f0;">${escapeHtml(inputVal)}</span></div>
                    <div style="font-size:11px; color:var(--text-muted);">Expected: <span style="color:#10b981;">${escapeHtml(expectedVal)}</span></div>
                    <div style="font-size:11px; color:var(--text-muted);">Your Output: <span style="color:${isCasePassed ? '#10b981' : '#ef4444'};">${escapeHtml(actualVal)}</span></div>
                </div>
            `;
        }).join('');

        elements.drawerContent.innerHTML = html;
    }

    /**
     * Submit Solution (Full Evaluation & ML Insights)
     */
    async function submitSolution() {
        const code = getCodeValue();
        if (!code.trim()) {
            alert('Please write code before submitting.');
            return;
        }

        const origBtn = elements.btnSubmitSolution.innerHTML;
        elements.btnSubmitSolution.disabled = true;
        elements.btnSubmitSolution.innerHTML = `<span>Evaluating...</span>`;

        switchDrawerTab('insights');
        elements.drawerContent.innerHTML = `<div style="color:var(--text-muted);">Analyzing code syntax, algorithmic complexity, and test verification...</div>`;

        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const resp = await fetch(`${API_BASE}/practice/submit`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    problem_id: currentProblem.id,
                    language: currentLanguage,
                    code: code
                })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || 'Submission failed.');
            }

            const result = await resp.json();
            renderSubmissionResult(result);

        } catch (err) {
            console.error('Submission error:', err);
            elements.drawerContent.innerHTML = `<div style="color:#ef4444;">Submission Error: ${err.message}</div>`;
        } finally {
            elements.btnSubmitSolution.disabled = false;
            elements.btnSubmitSolution.innerHTML = origBtn;
        }
    }

    function renderSubmissionResult(sub) {
        const isSuccess = sub.status === 'Accepted';
        const color = isSuccess ? '#10b981' : '#ef4444';
        const ml = sub.ml_insights || sub.ml_feedback || {};
        const passedTests = sub.passed_test_cases ?? sub.test_cases_passed ?? 0;
        const totalTests = sub.total_test_cases ?? 0;
        const runtimeMs = (sub.execution_time_ms ?? sub.runtime_ms ?? 0).toFixed(1);

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                <div style="font-weight:800; color:${color}; font-size:16px;">
                    ${isSuccess ? '🎉 Accepted (All Tests Passed)' : `✗ ${sub.status}`}
                </div>
                <div style="color:var(--text-muted); font-size:12px;">
                    ${passedTests}/${totalTests} Passed &bull; ${runtimeMs} ms
                </div>
            </div>

            <!-- ML Feedback Insights -->
            <div class="ml-insight-box">
                <div style="font-weight:700; font-size:13px; color:#ff6b35; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path></svg>
                    <span>ML Learning Insights & Complexity Analysis</span>
                </div>
                
                <div class="ml-insight-grid">
                    <div class="ml-metric-item">
                        <div class="ml-metric-label">Time Complexity</div>
                        <div class="ml-metric-val">${ml.time_complexity || 'O(N)'}</div>
                    </div>
                    <div class="ml-metric-item">
                        <div class="ml-metric-label">Space Complexity</div>
                        <div class="ml-metric-val">${ml.space_complexity || 'O(1)'}</div>
                    </div>
                    <div class="ml-metric-item">
                        <div class="ml-metric-label">Quality Score</div>
                        <div class="ml-metric-val">${ml.code_quality_score || 88}/100</div>
                    </div>
                    <div class="ml-metric-item">
                        <div class="ml-metric-label">Detected Pattern</div>
                        <div class="ml-metric-val">${ml.recognized_approach || ml.approach_detected || 'Iterative'}</div>
                    </div>
                </div>

                <div style="font-size:12px; font-weight:600; color:var(--text-primary); margin-top:8px;">Optimization Advice:</div>
                <ul class="ml-tips-list">
                    ${(ml.optimization_tips || ['Clean and optimal execution!']).map(t => `<li>${t}</li>`).join('')}
                </ul>
            </div>
        `;

        elements.drawerContent.innerHTML = html;
    }

    /**
     * Switch Drawer Output Tabs
     */
    function switchDrawerTab(tab) {
        [elements.tabResults, elements.tabConsole, elements.tabInsights].forEach(t => {
            if (t) t.classList.remove('active');
        });

        if (tab === 'results' && elements.tabResults) elements.tabResults.classList.add('active');
        if (tab === 'console' && elements.tabConsole) elements.tabConsole.classList.add('active');
        if (tab === 'insights' && elements.tabInsights) elements.tabInsights.classList.add('active');
    }

    /**
     * Setup Event Listeners
     */
    function setupListeners() {
        if (elements.btnRunCode) elements.btnRunCode.addEventListener('click', runCode);
        if (elements.btnSubmitSolution) elements.btnSubmitSolution.addEventListener('click', submitSolution);

        if (elements.languageSelect) {
            elements.languageSelect.addEventListener('change', () => {
                currentLanguage = elements.languageSelect.value;
                if (currentProblem) {
                    const starter = currentProblem.starter_templates?.[currentLanguage] || '# Write code here';
                    setCodeValue(starter);
                    if (isMonaco && window.monaco && codeEditor) {
                        window.monaco.editor.setModelLanguage(codeEditor.getModel(), getMonacoLang(currentLanguage));
                    }
                }
            });
        }

        if (elements.btnResetCode) {
            elements.btnResetCode.addEventListener('click', () => {
                if (confirm('Reset code to starter template? Your unsaved edits will be discarded.')) {
                    if (currentProblem) {
                        const starter = currentProblem.starter_templates?.[currentLanguage] || '# Write code here';
                        setCodeValue(starter);
                    }
                }
            });
        }

        if (elements.tabResults) elements.tabResults.addEventListener('click', () => switchDrawerTab('results'));
        if (elements.tabConsole) elements.tabConsole.addEventListener('click', () => {
            switchDrawerTab('console');
            elements.drawerContent.innerHTML = `<div style="color:var(--text-muted);">Standard Output Console (stdout): No output yet. Run your code to print values.</div>`;
        });
        if (elements.tabInsights) elements.tabInsights.addEventListener('click', () => switchDrawerTab('insights'));
    }

    function init() {
        loadProblem();
        setupListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
