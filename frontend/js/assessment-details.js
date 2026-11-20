/**
 * BugBash - Enterprise Assessment Details & Telemetry Controller
 * Loads complete assessment specifications, live telemetry statistics,
 * section questions breakdown, candidate assignments, and lifecycle actions.
 */

(function () {
    'use strict';

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

    let currentAssessment = null;

    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();

        const urlParams = new URLSearchParams(window.location.search);
        const assessmentId = urlParams.get('id');

        if (!assessmentId) {
            alert('No assessment ID specified.');
            window.location.href = '/admin/assessments';
            return;
        }

        await loadAssessmentDetails(assessmentId);
        await Promise.all([
            loadAssessmentStatistics(assessmentId),
            loadAssignedCandidates(assessmentId)
        ]);

        initActionButtons(assessmentId);
        initAssignCandidateModal(assessmentId);
    });

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

    async function loadAssessmentDetails(id) {
        try {
            const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error('Assessment not found');
            currentAssessment = await res.json();

            // Populate Hero
            setText('heroAssessmentTitle', currentAssessment.title);
            setText('heroAssessmentDesc', currentAssessment.description || 'No description provided.');
            setText('heroAssessmentId', currentAssessment.id);
            setText('heroAssessmentType', currentAssessment.assessment_type || 'Coding Exam');
            setText('heroAssessmentDifficulty', currentAssessment.difficulty || 'Medium');

            const statusBadge = document.getElementById('heroStatusBadge');
            if (statusBadge) {
                const st = currentAssessment.status || 'Draft';
                statusBadge.textContent = st;
                statusBadge.className = `badge-status badge-${st.toLowerCase().replace(/\s+/g, '-')}`;
            }

            // Edit Link
            const btnEdit = document.getElementById('btnHeroEdit');
            if (btnEdit) {
                btnEdit.href = `/admin/edit-assessment?id=${encodeURIComponent(id)}`;
                if (currentAssessment.status === 'Completed' || currentAssessment.status === 'Archived') {
                    btnEdit.style.display = 'none';
                }
            }

            // Publish Link
            const btnPublish = document.getElementById('btnHeroPublish');
            if (btnPublish) {
                btnPublish.style.display = (currentAssessment.status === 'Draft' || currentAssessment.status === 'Scheduled') ? 'inline-flex' : 'none';
            }

            // Populate Sections & Questions
            renderSectionsBreakdown(currentAssessment);

            // Populate Specs & Rules
            setText('ruleDuration', `${currentAssessment.duration_minutes || 60} mins`);
            setText('ruleTotalMarks', `${currentAssessment.total_marks || 100} pts`);
            setText('rulePassing', `${currentAssessment.rules?.passing_percentage || 60}%`);
            setText('ruleMaxAttempts', `${currentAssessment.rules?.max_attempts || 1}`);
            setText('ruleNavigation', currentAssessment.rules?.question_navigation === 'linear' ? 'Linear (Sequential)' : 'Free Navigation');
            setText('ruleNegativeMark', currentAssessment.rules?.negative_marking ? `Yes (-${currentAssessment.rules?.negative_mark_value || 0} pts)` : 'Disabled');
            setText('ruleAutosave', currentAssessment.rules?.autosave ? 'Enabled (Every 15s)' : 'Disabled');
            setText('ruleVisibility', currentAssessment.rules?.result_visibility || 'immediate');

            // Populate Schedule
            setText('schedStart', currentAssessment.schedule?.start_date ? formatDate(currentAssessment.schedule.start_date) : 'Flexible / Always Available');
            setText('schedEnd', currentAssessment.schedule?.end_date ? formatDate(currentAssessment.schedule.end_date) : 'No fixed deadline');
            setText('schedTimezone', currentAssessment.schedule?.timezone || 'UTC');
            setText('schedAvailability', currentAssessment.schedule?.availability || 'scheduled');

        } catch (err) {
            console.error('[BugBash] Error loading assessment details:', err);
            alert('Failed to load assessment specifications.');
        }
    }

    function renderSectionsBreakdown(asmt) {
        const container = document.getElementById('sectionsAccordionContainer');
        if (!container) return;

        const sections = asmt.sections || [];
        const questions = asmt.questions || [];

        container.innerHTML = sections.map((sec, secIdx) => {
            const secQuestions = questions.filter(q => q.section_id === sec.id || (!q.section_id && secIdx === 0));

            return `
                <div class="section-item-block">
                    <div class="section-item-header">
                        <div>
                            <span class="section-item-title">${escapeHtml(sec.name || `Section ${secIdx + 1}`)}</span>
                            <span style="font-size: 11px; color: var(--text-muted, #64748b); margin-left: 8px;">(${secQuestions.length} questions)</span>
                        </div>
                        <div class="section-item-meta">
                            <span>Duration: ${sec.duration_minutes || asmt.duration_minutes || 60} mins</span>
                        </div>
                    </div>
                    <table class="section-questions-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Question Title</th>
                                <th>Difficulty</th>
                                <th>Type</th>
                                <th>Marks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${secQuestions.map((q, qIdx) => `
                                <tr>
                                    <td style="font-weight: 700; color: #ff6b35;">Q${qIdx + 1}</td>
                                    <td><strong style="color: var(--text-primary, #f8fafc);">${escapeHtml(q.title)}</strong></td>
                                    <td><span style="color: ${getDifficultyColor(q.difficulty)}; font-weight: 700;">${escapeHtml(q.difficulty)}</span></td>
                                    <td style="text-transform: uppercase;">${escapeHtml(q.question_type || 'coding')}</td>
                                    <td><strong>${q.custom_marks || q.points || 20}</strong> pts</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');
    }

    async function loadAssessmentStatistics(id) {
        try {
            const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/statistics`);
            if (!res.ok) return;
            const stats = await res.json();

            setText('statAssignedCount', stats.assigned_count || 0);
            setText('statAttemptsStarted', stats.attempts_started || 0);
            setText('statCompletedCount', stats.submissions_completed || 0);
            setText('statCompletionRate', `${stats.completion_rate || 0}%`);
            setText('statAvgScore', `${stats.average_score || 0} pts`);
            setText('statPassPercentage', `${stats.pass_percentage || 0}%`);

        } catch (err) {
            console.warn('[BugBash] Error loading statistics:', err);
        }
    }

    async function loadAssignedCandidates(id) {
        const tableBody = document.getElementById('assignedCandidatesTableBody');
        if (!tableBody) return;

        try {
            const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/candidates`);
            if (!res.ok) return;
            const candidates = await res.json();

            if (candidates.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted, #64748b);">
                            No candidates assigned to this assessment yet. Click <strong>"+ Assign Candidates"</strong> above.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = candidates.map(c => `
                <tr>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary, #f8fafc);">${escapeHtml(c.name)}</div>
                        <div style="font-size: 11px; color: var(--text-muted, #64748b); font-family: monospace;">${escapeHtml(c.email)}</div>
                    </td>
                    <td>
                        <span class="badge-status ${getCandidateStatusClass(c.status)}">${escapeHtml(c.status)}</span>
                    </td>
                    <td>${c.score !== null && c.score !== undefined ? `<strong>${c.score}</strong> / ${c.max_score}` : '--'}</td>
                    <td>${c.started_at ? formatDate(c.started_at) : '--'}</td>
                    <td>${c.submitted_at ? formatDate(c.submitted_at) : '--'}</td>
                </tr>
            `).join('');

        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 18px;">Failed to load candidate assignments.</td></tr>`;
        }
    }

    function initActionButtons(id) {
        // Publish Action
        const btnPublish = document.getElementById('btnHeroPublish');
        if (btnPublish) {
            btnPublish.addEventListener('click', async () => {
                if (!confirm(`Publish '${currentAssessment?.title}'? Candidates will be able to take the exam according to schedule.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/publish`, { method: 'POST' });
                    if (res.ok) {
                        alert('Assessment published successfully!');
                        window.location.reload();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to publish assessment.');
                    }
                } catch (e) {
                    alert('Network error while publishing.');
                }
            });
        }

        // Duplicate Action
        const btnDuplicate = document.getElementById('btnHeroDuplicate');
        if (btnDuplicate) {
            btnDuplicate.addEventListener('click', async () => {
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
                    if (res.ok) {
                        const data = await res.json();
                        alert(`Successfully duplicated as '${data.assessment?.title}'!`);
                        window.location.href = `/admin/assessment-details?id=${encodeURIComponent(data.assessment?.id)}`;
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to duplicate assessment.');
                    }
                } catch (e) {
                    alert('Network error while duplicating.');
                }
            });
        }

        // Archive Action
        const btnArchive = document.getElementById('btnHeroArchive');
        if (btnArchive) {
            btnArchive.addEventListener('click', async () => {
                if (!confirm(`Archive '${currentAssessment?.title}'? This will close all active candidate access.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/archive`, { method: 'POST' });
                    if (res.ok) {
                        alert('Assessment archived.');
                        window.location.reload();
                    }
                } catch (e) {
                    alert('Error archiving assessment.');
                }
            });
        }

        // Delete Action
        const btnDelete = document.getElementById('btnHeroDelete');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                if (!confirm(`Permanently delete assessment '${currentAssessment?.title}'? This cannot be undone.`)) return;
                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    if (res.ok) {
                        alert('Assessment deleted.');
                        window.location.href = '/admin/assessments';
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Cannot delete assessment.');
                    }
                } catch (e) {
                    alert('Error deleting assessment.');
                }
            });
        }
    }

    function initAssignCandidateModal(id) {
        const btnOpen = document.getElementById('btnOpenAssignModal');
        const modal = document.getElementById('modalAssignCandidates');
        const btnSubmit = document.getElementById('btnSubmitCandidateAssignment');

        if (btnOpen && modal) {
            btnOpen.addEventListener('click', () => {
                modal.style.display = 'flex';
            });
        }

        if (btnSubmit) {
            btnSubmit.addEventListener('click', async () => {
                const emailsRaw = (document.getElementById('inputCandidateEmails')?.value || '').trim();
                const emails = emailsRaw.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));

                if (emails.length === 0) {
                    alert('Please enter at least one valid candidate email address.');
                    return;
                }

                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Assigning...';

                try {
                    const res = await adminApi(`/admin/assessments/${encodeURIComponent(id)}/assign`, {
                        method: 'POST',
                        body: JSON.stringify({
                            candidate_emails: emails
                        })
                    });

                    const data = await res.json();
                    if (res.ok) {
                        alert(`Successfully assigned ${emails.length} candidates!`);
                        if (modal) modal.style.display = 'none';
                        document.getElementById('inputCandidateEmails').value = '';
                        await loadAssignedCandidates(id);
                        await loadAssessmentStatistics(id);
                    } else {
                        alert(data.detail || 'Assignment failed.');
                    }
                } catch (e) {
                    alert('Network error while assigning candidates.');
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Confirm Assignment';
                }
            });
        }
    }

    function getCandidateStatusClass(st) {
        if (st === 'Evaluated') return 'badge-completed';
        if (st === 'In Progress') return 'badge-active';
        return 'badge-draft';
    }

    function getDifficultyColor(diff) {
        const d = (diff || '').toLowerCase();
        if (d === 'easy') return '#10b981';
        if (d === 'hard') return '#ef4444';
        return '#f59e0b';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const dt = new Date(dateStr);
            if (isNaN(dt.getTime())) return dateStr;
            return dt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (_) {
            return dateStr;
        }
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val !== null && val !== undefined ? val : '--';
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
