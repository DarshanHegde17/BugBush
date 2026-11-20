/**
 * BugBash - Candidate Details & Telemetry Controller
 * Loads detailed candidate profile, categorized assessments (Assigned, Upcoming, In-Progress,
 * Completed, Missed), performance statistics, chronological audit log, and lifecycle actions.
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

    let candidateId = null;
    let candidateData = null;
    let cachedAssessments = [];

    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();
        initTabs();

        const urlParams = new URLSearchParams(window.location.search);
        candidateId = urlParams.get('id');

        if (!candidateId) {
            alert('No candidate ID provided.');
            window.location.href = '/admin/candidates';
            return;
        }

        await Promise.all([
            loadCandidateDetails(candidateId),
            loadAvailableAssessments()
        ]);

        initActionHandlers();
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

    function initTabs() {
        const tabBtns = document.querySelectorAll('.tab-nav-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel-content').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const activePanel = document.getElementById(`panel-${target}`);
                if (activePanel) activePanel.classList.add('active');
            });
        });
    }

    async function loadCandidateDetails(cid) {
        try {
            const res = await adminApi(`/admin/candidates/${encodeURIComponent(cid)}`);
            if (!res.ok) throw new Error('Candidate not found');
            candidateData = await res.json();

            // Populate Hero
            setText('heroCandidateName', candidateData.full_name);
            setText('heroCandidateEmail', candidateData.email);
            setText('heroCandidatePhone', candidateData.phone_number || 'No phone recorded');
            setText('heroCandidateId', candidateData.id);

            const statusBadge = document.getElementById('heroStatusBadge');
            if (statusBadge) {
                statusBadge.textContent = candidateData.account_status;
                statusBadge.className = `badge-status ${candidateData.is_suspended ? 'badge-suspended' : (candidateData.account_status === 'Active' ? 'badge-active' : 'badge-pending')}`;
            }

            const verBadge = document.getElementById('heroVerBadge');
            if (verBadge) {
                verBadge.textContent = candidateData.is_verified ? 'Verified Email' : 'Unverified Email';
                verBadge.className = `badge-status ${candidateData.is_verified ? 'badge-verified' : 'badge-unverified'}`;
            }

            const avatarEl = document.getElementById('heroAvatar');
            if (avatarEl) {
                if (candidateData.avatar_url) {
                    avatarEl.innerHTML = `<img src="${candidateData.avatar_url}" alt="${escapeHtml(candidateData.full_name)}">`;
                } else {
                    avatarEl.textContent = getInitials(candidateData.full_name);
                }
            }

            // Populate Telemetry
            const p = candidateData.performance || {};
            setText('statTotalAttempts', p.total_attempts || 0);
            setText('statAvgScore', `${p.average_score || 0} pts`);
            setText('statHighestScore', `${p.highest_score || 0} pts`);
            setText('statCompletionRate', `${p.completion_rate || 0}%`);

            // Populate Left Sidebar Personal Specs
            setText('specRegDate', formatDate(candidateData.created_at));
            setText('specCollege', candidateData.college_name || '--');
            setText('specMajor', candidateData.degree_major || '--');
            setText('specGradYear', candidateData.graduation_year || '--');
            setText('specBio', candidateData.bio || 'No candidate bio provided.');

            const groupsContainer = document.getElementById('specGroupsContainer');
            if (groupsContainer) {
                const grps = candidateData.groups || [];
                groupsContainer.innerHTML = grps.length > 0 ? 
                    grps.map(g => `<span class="group-tag-pill">${escapeHtml(g)}</span>`).join('') : 
                    '<span style="color: var(--text-muted); font-size: 12px;">No group assigned</span>';
            }

            // Populate Assessments Tab
            renderAssessmentsTab(candidateData.assessments || {});

            // Populate Results Tab
            renderResultsTab(candidateData.performance?.recent_results || []);

            // Populate Activity Timeline
            renderActivityTab(candidateData.activity || []);

            // Toggle Suspend / Reactivate Hero Button
            const btnSuspend = document.getElementById('btnHeroSuspend');
            const btnReactivate = document.getElementById('btnHeroReactivate');
            if (btnSuspend && btnReactivate) {
                if (candidateData.is_suspended) {
                    btnSuspend.style.display = 'none';
                    btnReactivate.style.display = 'inline-flex';
                } else {
                    btnSuspend.style.display = 'inline-flex';
                    btnReactivate.style.display = 'none';
                }
            }

        } catch (err) {
            console.error('[BugBash] Error loading candidate specifications:', err);
            alert('Failed to load candidate specifications.');
            window.location.href = '/admin/candidates';
        }
    }

    function renderAssessmentsTab(asmts) {
        const categories = [
            { key: 'assigned', label: 'Assigned Assessments', badge: '#ff6b35' },
            { key: 'inprogress', label: 'In Progress Sessions', badge: '#3b82f6' },
            { key: 'completed', label: 'Completed Submissions', badge: '#10b981' },
            { key: 'upcoming', label: 'Upcoming Scheduled Exams', badge: '#f59e0b' },
            { key: 'missed', label: 'Missed / Expired Windows', badge: '#ef4444' }
        ];

        const container = document.getElementById('panel-assessments');
        if (!container) return;

        let totalAssessments = 0;
        let html = '';

        categories.forEach(cat => {
            const list = asmts[cat.key] || [];
            totalAssessments += list.length;
            if (list.length === 0) return;

            html += `
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${cat.badge};"></span>
                        <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary, #f8fafc);">${cat.label} (${list.length})</h4>
                    </div>
                    <table class="candidate-table" style="background: rgba(12,15,23,0.3); border: 1px solid var(--border-color, #212838); border-radius: 8px;">
                        <thead>
                            <tr>
                                <th>Assessment Title</th>
                                <th>Category</th>
                                <th>Difficulty</th>
                                <th>Score / Grade</th>
                                <th>Deadline / Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(a => `
                                <tr>
                                    <td>
                                        <a href="/admin/assessment-details?id=${encodeURIComponent(a.id)}" style="font-weight: 700; color: var(--text-primary); text-decoration: none;">${escapeHtml(a.title)}</a>
                                        <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(a.id)}</div>
                                    </td>
                                    <td>${escapeHtml(a.category || 'General')}</td>
                                    <td><span style="font-weight: 700;">${escapeHtml(a.difficulty || 'Medium')}</span></td>
                                    <td>${a.score !== null && a.score !== undefined ? `<strong>${a.score}</strong> / ${a.max_score}` : '--'}</td>
                                    <td style="font-size: 12px; font-family: monospace;">${a.deadline ? formatDate(a.deadline) : 'Flexible'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        if (totalAssessments === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px; color: var(--text-muted);">
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">No assessments assigned</div>
                    <div>Click "+ Assign Assessment" above to enroll this candidate into an evaluation.</div>
                </div>
            `;
        } else {
            container.innerHTML = html;
        }
    }

    function renderResultsTab(results) {
        const container = document.getElementById('resultsTableBody');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">No finalized results recorded yet.</td></tr>`;
            return;
        }

        container.innerHTML = results.map(r => `
            <tr>
                <td><strong>${escapeHtml(r.assessment_title || r.assessment_id)}</strong></td>
                <td><strong style="color: #ff6b35;">${r.score || 0}</strong> / ${r.max_score || 100}</td>
                <td><strong>${r.percentage || 0}%</strong></td>
                <td>
                    <span class="badge-status ${r.passed ? 'badge-active' : 'badge-suspended'}">
                        ${r.passed ? 'Passed' : 'Failed'}
                    </span>
                </td>
                <td style="font-size: 12px; font-family: monospace;">${formatDate(r.completed_at || r.submitted_at || r.created_at)}</td>
            </tr>
        `).join('');
    }

    function renderActivityTab(activities) {
        const timeline = document.getElementById('candidateActivityTimeline');
        if (!timeline) return;

        if (activities.length === 0) {
            timeline.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No activity logged yet.</div>';
            return;
        }

        timeline.innerHTML = activities.map(act => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-title">${escapeHtml(act.action)}</div>
                <div class="timeline-desc">${escapeHtml(act.description || '')}</div>
                <div class="timeline-time">${formatDate(act.timestamp)}</div>
            </div>
        `).join('');
    }

    function initActionHandlers() {
        // Suspend Action
        const btnSuspend = document.getElementById('btnHeroSuspend');
        if (btnSuspend) {
            btnSuspend.addEventListener('click', () => {
                const reason = prompt(`Enter reason for suspending '${candidateData.email}':`);
                if (!reason || reason.trim().length < 3) {
                    if (reason !== null) alert('Suspension reason must be at least 3 characters.');
                    return;
                }
                executeSuspension(reason.trim());
            });
        }

        // Reactivate Action
        const btnReactivate = document.getElementById('btnHeroReactivate');
        if (btnReactivate) {
            btnReactivate.addEventListener('click', async () => {
                if (confirm(`Reactivate account for '${candidateData.email}'? Candidate will be restored to active assessment access.`)) {
                    try {
                        const res = await adminApi(`/admin/candidates/${encodeURIComponent(candidateId)}/reactivate`, { method: 'POST' });
                        if (res.ok) {
                            alert('Candidate reactivated successfully.');
                            loadCandidateDetails(candidateId);
                        } else {
                            const err = await res.json();
                            alert(err.detail || 'Failed to reactivate candidate.');
                        }
                    } catch (e) {
                        alert('Network error while reactivating candidate.');
                    }
                }
            });
        }

        // Quick Assign Action
        const btnAssign = document.getElementById('btnHeroAssign');
        if (btnAssign) {
            btnAssign.addEventListener('click', () => {
                const sel = document.getElementById('assignAssessmentSelect');
                if (sel) {
                    sel.innerHTML = '<option value="">-- Choose an assessment --</option>' +
                        cachedAssessments.map(a => `<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('');
                }
                openModal('modalAssignCandidate');
            });
        }

        const btnSubmitAssign = document.getElementById('btnSubmitAssignCandidate');
        if (btnSubmitAssign) {
            btnSubmitAssign.addEventListener('click', async () => {
                const asmtId = document.getElementById('assignAssessmentSelect')?.value;
                const deadline = document.getElementById('assignDeadlineInput')?.value || null;
                if (!asmtId) {
                    alert('Please select an assessment.');
                    return;
                }

                btnSubmitAssign.disabled = true;
                btnSubmitAssign.textContent = 'Assigning...';

                try {
                    const res = await adminApi(`/admin/candidates/${encodeURIComponent(candidateId)}/assignments`, {
                        method: 'POST',
                        body: JSON.stringify({
                            assessment_id: asmtId,
                            deadline: deadline
                        })
                    });
                    if (res.ok) {
                        alert('Assessment assigned successfully!');
                        closeModal('modalAssignCandidate');
                        loadCandidateDetails(candidateId);
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to assign assessment.');
                    }
                } catch (e) {
                    alert('Network error while assigning assessment.');
                } finally {
                    btnSubmitAssign.disabled = false;
                    btnSubmitAssign.textContent = 'Confirm Assignment';
                }
            });
        }
    }

    async function executeSuspension(reason) {
        try {
            const res = await adminApi(`/admin/candidates/${encodeURIComponent(candidateId)}/suspend`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason })
            });
            if (res.ok) {
                alert('Candidate suspended.');
                loadCandidateDetails(candidateId);
            } else {
                const err = await res.json();
                alert(err.detail || 'Failed to suspend candidate.');
            }
        } catch (e) {
            alert('Network error while suspending candidate.');
        }
    }

    async function loadAvailableAssessments() {
        try {
            const res = await adminApi('/admin/assessments?limit=100');
            if (res.ok) {
                const d = await res.json();
                cachedAssessments = d.assessments || [];
            }
        } catch (_) {}
    }

    function openModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'flex';
    }

    window.closeModal = function(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    };

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val !== null && val !== undefined ? val : '--';
    }

    function getInitials(name) {
        if (!name) return 'C';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const dt = new Date(dateStr);
            if (isNaN(dt.getTime())) return dateStr;
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (_) {
            return dateStr;
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

})();
