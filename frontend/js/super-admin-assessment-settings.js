/**
 * BugBash - Super Admin Assessment Default Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const form = document.getElementById('assessmentSettingsForm');
    const statusMsg = document.getElementById('formStatusMsg');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const languagesContainer = document.getElementById('languagesContainer');

    const ALL_LANGUAGES = ['Python', 'JavaScript', 'C++', 'Java', 'C', 'Go', 'Rust', 'TypeScript', 'SQL'];
    let selectedLanguages = new Set(['Python', 'JavaScript', 'C++', 'Java', 'C']);

    await loadSettings();

    async function loadSettings() {
        try {
            const resp = await fetch('/api/v1/super-admin/configuration', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const data = await resp.json();
            populateForm(data.assessment);
        } catch (err) {
            showStatus('Failed to load assessment settings', 'error');
        }
    }

    function populateForm(asm) {
        if (!asm) return;
        document.getElementById('default_duration_minutes').value = asm.default_duration_minutes || 60;
        document.getElementById('section_timer_behavior').value = asm.section_timer_behavior || 'flexible_total_time';
        document.getElementById('default_difficulty').value = asm.default_difficulty || 'Intermediate';
        document.getElementById('max_questions_per_assessment').value = asm.max_questions_per_assessment || 10;
        document.getElementById('submission_limits').value = asm.submission_limits ?? 5;
        document.getElementById('code_execution_time_limit_seconds').value = asm.code_execution_time_limit_seconds || 3.0;
        document.getElementById('memory_limit_mb').value = asm.memory_limit_mb || 256;
        document.getElementById('autosave_interval_seconds').value = asm.autosave_interval_seconds || 30;
        document.getElementById('result_visibility').value = asm.result_visibility || 'after_assessment_closes';
        document.getElementById('default_instructions').value = asm.default_instructions || '';

        if (Array.isArray(asm.allowed_languages)) {
            selectedLanguages = new Set(asm.allowed_languages);
        }
        renderLanguageChips();
    }

    function renderLanguageChips() {
        if (!languagesContainer) return;
        languagesContainer.innerHTML = ALL_LANGUAGES.map(lang => {
            const isSelected = selectedLanguages.has(lang);
            return `
                <div class="sa-lang-chip ${isSelected ? 'selected' : ''}" data-lang="${lang}">
                    <span>${isSelected ? '✓' : '+'}</span>
                    <span>${lang}</span>
                </div>
            `;
        }).join('');

        languagesContainer.querySelectorAll('.sa-lang-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const lang = chip.dataset.lang;
                if (selectedLanguages.has(lang)) {
                    if (selectedLanguages.size > 1) {
                        selectedLanguages.delete(lang);
                    } else {
                        alert('At least one programming language must remain selected.');
                        return;
                    }
                } else {
                    selectedLanguages.add(lang);
                }
                renderLanguageChips();
            });
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Saving Changes...';

            const payload = {
                default_duration_minutes: parseInt(document.getElementById('default_duration_minutes').value, 10),
                section_timer_behavior: document.getElementById('section_timer_behavior').value,
                allowed_languages: Array.from(selectedLanguages),
                default_difficulty: document.getElementById('default_difficulty').value,
                max_questions_per_assessment: parseInt(document.getElementById('max_questions_per_assessment').value, 10),
                submission_limits: parseInt(document.getElementById('submission_limits').value, 10),
                code_execution_time_limit_seconds: parseFloat(document.getElementById('code_execution_time_limit_seconds').value),
                memory_limit_mb: parseInt(document.getElementById('memory_limit_mb').value, 10),
                autosave_interval_seconds: parseInt(document.getElementById('autosave_interval_seconds').value, 10),
                result_visibility: document.getElementById('result_visibility').value,
                default_instructions: document.getElementById('default_instructions').value.trim()
            };

            try {
                const resp = await fetch('/api/v1/super-admin/configuration/assessment', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await resp.json();
                if (resp.ok) {
                    showStatus('Assessment default configuration saved successfully!', 'success');
                } else {
                    showStatus(resData.detail || 'Failed to save settings.', 'error');
                }
            } catch (err) {
                showStatus('Network error while saving settings.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Assessment Defaults';
            }
        });
    }

    function showStatus(msg, type) {
        if (!statusMsg) return;
        statusMsg.textContent = msg;
        statusMsg.className = type === 'success' ? 'sa-status-badge connected' : 'sa-status-badge disconnected';
        statusMsg.style.display = 'inline-flex';
        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 5000);
    }
});
