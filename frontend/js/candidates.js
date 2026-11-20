/**
 * BugBash - Enterprise Candidate & Student Management Controller
 * Handles candidate directory listing, live search, multi-condition filtering,
 * pagination, administrative suspension/reactivation, assessment assignment, and invitations.
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

    // State
    let currentPage = 1;
    let currentLimit = 15;
    let currentSearch = '';
    let currentStatus = '';
    let currentGroup = '';
    let currentSortBy = 'created_at';
    let currentSortOrder = 'desc';
    let searchDebounceTimer = null;
    let selectedCandidateForAction = null;
    let cachedAssessmentsList = [];
    let cachedGroupsList = [];

    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();
        initSearchAndFilters();
        initModals();

        await Promise.all([
            loadAvailableAssessments(),
            loadAvailableGroups(),
            loadCandidatesDirectory()
        ]);
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

    function initSearchAndFilters() {
        const searchInput = document.getElementById('candidateSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    currentSearch = e.target.value.trim();
                    currentPage = 1;
                    loadCandidatesDirectory();
                }, 300);
            });
        }

        const statusSelect = document.getElementById('candidateStatusFilter');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                currentStatus = e.target.value;
                currentPage = 1;
                loadCandidatesDirectory();
            });
        }

        const groupSelect = document.getElementById('candidateGroupFilter');
        if (groupSelect) {
            groupSelect.addEventListener('change', (e) => {
                currentGroup = e.target.value;
                currentPage = 1;
                loadCandidatesDirectory();
            });
        }

        const sortSelect = document.getElementById('candidateSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const parts = e.target.value.split(':');
                currentSortBy = parts[0] || 'created_at';
                currentSortOrder = parts[1] || 'desc';
                loadCandidatesDirectory();
            });
        }

        const btnPrev = document.getElementById('btnPagePrev');
        const btnNext = document.getElementById('btnPageNext');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadCandidatesDirectory();
                }
            });
        }
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                currentPage++;
                loadCandidatesDirectory();
            });
        }
    }

    async function loadCandidatesDirectory() {
        const tableBody = document.getElementById('candidatesTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted, #64748b);">
                    <div style="display: inline-block; width: 22px; height: 22px; border: 2px solid #ff6b35; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    <div style="margin-top: 10px; font-size: 13px;">Loading candidate records...</div>
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: currentLimit,
                sort_by: currentSortBy,
                sort_order: currentSortOrder
            });
            if (currentSearch) params.set('search', currentSearch);
            if (currentStatus) params.set('status', currentStatus);
            if (currentGroup) params.set('group', currentGroup);

            const res = await adminApi(`/admin/candidates?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch candidate directory');
            const data = await res.json();

            // Populate Summary Cards
            updateSummaryCards(data.summary || {});

            const candidates = data.candidates || [];
            if (candidates.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 48px; color: var(--text-muted, #64748b);">
                            <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: var(--text-primary, #f8fafc);">No candidates found</div>
                            <div style="font-size: 13px;">Try adjusting your search criteria or invite candidates using the "+ Invite Candidate" button.</div>
                        </td>
                    </tr>
                `;
                updatePaginationControls(0, 1, 1);
                return;
            }

            tableBody.innerHTML = candidates.map(c => renderCandidateRow(c)).join('');
            attachRowActionListeners();
            updatePaginationControls(data.total, data.page, data.pages);

        } catch (err) {
            console.error('[BugBash] Error loading candidates:', err);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load candidate directory.</td></tr>`;
        }
    }

    function updateSummaryCards(s) {
        setText('statTotalCandidates', s.total_candidates || 0);
        setText('statActiveCandidates', s.active_candidates || 0);
        setText('statVerifiedCandidates', s.verified_candidates || 0);
        setText('statParticipants', s.assessment_participants || 0);
        setText('statPendingInvites', s.pending_invitations || 0);
        setText('statSuspended', s.suspended_candidates || 0);
    }

    function renderCandidateRow(c) {
        const initials = getInitials(c.full_name);
        const statusBadgeClass = c.is_suspended ? 'badge-suspended' : (
            c.account_status === 'Active' ? 'badge-active' : 'badge-pending'
        );
        const verBadge = c.is_verified ? 
            `<span class="badge-status badge-verified" title="Email cryptographically verified">Verified</span>` : 
            `<span class="badge-status badge-unverified" title="Pending OTP verification">Unverified</span>`;

        const groupsHtml = (c.groups || []).map(g => `<span class="group-tag-pill">${escapeHtml(g)}</span>`).join('');

        return `
            <tr data-id="${c.id}" data-email="${escapeHtml(c.email)}" data-name="${escapeHtml(c.full_name)}">
                <td>
                    <div class="candidate-cell-flex">
                        <div class="candidate-avatar-circle">
                            ${c.avatar_url ? `<img src="${c.avatar_url}" alt="${escapeHtml(c.full_name)}">` : initials}
                        </div>
                        <div class="candidate-info-block">
                            <a href="/admin/candidate-details?id=${encodeURIComponent(c.id)}" class="candidate-name-link">${escapeHtml(c.full_name)}</a>
                            <span class="candidate-email-text">${escapeHtml(c.email)}</span>
                            <span class="candidate-id-badge">ID: ${escapeHtml(c.id)}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size: 13px; color: var(--text-primary, #f8fafc);">${escapeHtml(c.phone_number || '--')}</div>
                    <div style="font-size: 11px; color: var(--text-muted, #64748b);">${escapeHtml(c.college_name || '')}</div>
                </td>
                <td>
                    <span class="badge-status ${statusBadgeClass}">${escapeHtml(c.account_status)}</span>
                </td>
                <td>${verBadge}</td>
                <td>
                    <div style="font-size: 12.5px; font-weight: 600;">
                        <span style="color: #ff6b35;">${c.assigned_assessments_count}</span> assigned &bull; 
                        <span style="color: #10b981;">${c.completed_assessments_count}</span> done
                    </div>
                    <div>${groupsHtml}</div>
                </td>
                <td>
                    <div class="metric-pill">
                        <span class="metric-score">${c.average_score > 0 ? c.average_score + ' pts' : '--'}</span>
                    </div>
                </td>
                <td style="font-size: 12px; color: var(--text-muted, #64748b); font-family: 'JetBrains Mono', monospace;">
                    ${formatDate(c.created_at)}
                </td>
                <td>
                    <div class="action-buttons-cell">
                        <a href="/admin/candidate-details?id=${encodeURIComponent(c.id)}" class="btn-action-icon" title="View Candidate Profile & Results">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </a>
                        <button type="button" class="btn-action-icon btn-quick-assign" title="Quick Assign Assessment" data-id="${c.id}" data-email="${escapeHtml(c.email)}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        </button>
                        <button type="button" class="btn-action-icon btn-edit-candidate" title="Edit Admin Details" data-id="${c.id}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        ${c.is_suspended ? `
                            <button type="button" class="btn-action-icon success btn-reactivate-candidate" title="Reactivate Account" data-id="${c.id}" data-email="${escapeHtml(c.email)}">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            </button>
                        ` : `
                            <button type="button" class="btn-action-icon danger btn-suspend-candidate" title="Suspend Account" data-id="${c.id}" data-email="${escapeHtml(c.email)}">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }

    function attachRowActionListeners() {
        // Quick Assign Assessment
        document.querySelectorAll('.btn-quick-assign').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.getAttribute('data-id');
                const email = btn.getAttribute('data-email');
                openAssignAssessmentModal(cid, email);
            });
        });

        // Edit Candidate
        document.querySelectorAll('.btn-edit-candidate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cid = btn.getAttribute('data-id');
                await openEditCandidateModal(cid);
            });
        });

        // Suspend Candidate
        document.querySelectorAll('.btn-suspend-candidate').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.getAttribute('data-id');
                const email = btn.getAttribute('data-email');
                openSuspendModal(cid, email);
            });
        });

        // Reactivate Candidate
        document.querySelectorAll('.btn-reactivate-candidate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cid = btn.getAttribute('data-id');
                const email = btn.getAttribute('data-email');
                if (confirm(`Reactivate account for '${email}'? Candidate will be restored to active assessment access.`)) {
                    try {
                        const res = await adminApi(`/admin/candidates/${encodeURIComponent(cid)}/reactivate`, { method: 'POST' });
                        if (res.ok) {
                            alert('Candidate reactivated successfully.');
                            loadCandidatesDirectory();
                        } else {
                            const err = await res.json();
                            alert(err.detail || 'Failed to reactivate candidate.');
                        }
                    } catch (e) {
                        alert('Network error while reactivating candidate.');
                    }
                }
            });
        });
    }

    function updatePaginationControls(total, page, pages) {
        setText('showingCount', total);
        setText('pageIndicator', `Page ${page} of ${pages || 1}`);

        const btnPrev = document.getElementById('btnPagePrev');
        const btnNext = document.getElementById('btnPageNext');
        if (btnPrev) btnPrev.disabled = page <= 1;
        if (btnNext) btnNext.disabled = page >= pages;
    }

    // ==========================================================================
    // Modals Handlers
    // ==========================================================================
    function initModals() {
        // Suspend Modal
        const btnSubmitSuspend = document.getElementById('btnSubmitSuspend');
        if (btnSubmitSuspend) {
            btnSubmitSuspend.addEventListener('click', async () => {
                const reason = (document.getElementById('suspendReasonInput')?.value || '').trim();
                if (reason.length < 3) {
                    alert('Please provide a mandatory suspension reason (at least 3 characters).');
                    return;
                }
                if (!selectedCandidateForAction) return;

                btnSubmitSuspend.disabled = true;
                btnSubmitSuspend.textContent = 'Suspending...';

                try {
                    const res = await adminApi(`/admin/candidates/${encodeURIComponent(selectedCandidateForAction.id)}/suspend`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: reason })
                    });
                    if (res.ok) {
                        alert('Candidate suspended successfully.');
                        closeModal('modalSuspendCandidate');
                        loadCandidatesDirectory();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to suspend candidate.');
                    }
                } catch (e) {
                    alert('Network error while suspending candidate.');
                } finally {
                    btnSubmitSuspend.disabled = false;
                    btnSubmitSuspend.textContent = 'Confirm Suspension';
                }
            });
        }

        // Quick Assign Modal
        const btnSubmitAssign = document.getElementById('btnSubmitQuickAssign');
        if (btnSubmitAssign) {
            btnSubmitAssign.addEventListener('click', async () => {
                const asmtId = document.getElementById('assignAssessmentSelect')?.value;
                const deadline = document.getElementById('assignDeadlineInput')?.value || null;

                if (!asmtId) {
                    alert('Please select an assessment to assign.');
                    return;
                }
                if (!selectedCandidateForAction) return;

                btnSubmitAssign.disabled = true;
                btnSubmitAssign.textContent = 'Assigning...';

                try {
                    const res = await adminApi(`/admin/candidates/${encodeURIComponent(selectedCandidateForAction.id)}/assignments`, {
                        method: 'POST',
                        body: JSON.stringify({
                            assessment_id: asmtId,
                            deadline: deadline
                        })
                    });
                    if (res.ok) {
                        alert('Assessment assigned successfully!');
                        closeModal('modalQuickAssign');
                        loadCandidatesDirectory();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Assignment failed.');
                    }
                } catch (e) {
                    alert('Network error while assigning assessment.');
                } finally {
                    btnSubmitAssign.disabled = false;
                    btnSubmitAssign.textContent = 'Confirm Assignment';
                }
            });
        }

        // Edit Details Modal
        const btnSubmitEdit = document.getElementById('btnSubmitEditCandidate');
        if (btnSubmitEdit) {
            btnSubmitEdit.addEventListener('click', async () => {
                if (!selectedCandidateForAction) return;
                const payload = {
                    full_name: (document.getElementById('editCandidateName')?.value || '').trim(),
                    phone_number: (document.getElementById('editCandidatePhone')?.value || '').trim(),
                    college_name: (document.getElementById('editCandidateCollege')?.value || '').trim(),
                    degree_major: (document.getElementById('editCandidateMajor')?.value || '').trim(),
                    graduation_year: (document.getElementById('editCandidateGradYear')?.value || '').trim()
                };

                btnSubmitEdit.disabled = true;
                btnSubmitEdit.textContent = 'Saving...';

                try {
                    const res = await adminApi(`/admin/candidates/${encodeURIComponent(selectedCandidateForAction.id)}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        alert('Candidate details updated successfully.');
                        closeModal('modalEditCandidate');
                        loadCandidatesDirectory();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to update candidate details.');
                    }
                } catch (e) {
                    alert('Network error while updating candidate.');
                } finally {
                    btnSubmitEdit.disabled = false;
                    btnSubmitEdit.textContent = 'Save Changes';
                }
            });
        }

        // Invite Candidate Modal
        const btnOpenInvite = document.getElementById('btnOpenInviteModal');
        if (btnOpenInvite) {
            btnOpenInvite.addEventListener('click', () => {
                openModal('modalInviteCandidates');
            });
        }

        const btnSubmitInvite = document.getElementById('btnSubmitInviteCandidates');
        if (btnSubmitInvite) {
            btnSubmitInvite.addEventListener('click', async () => {
                const emailsRaw = (document.getElementById('inviteEmailsInput')?.value || '').trim();
                const asmtId = document.getElementById('inviteAssessmentSelect')?.value || null;
                const expiryDays = parseInt(document.getElementById('inviteExpiryDays')?.value || '7', 10);
                const customMsg = (document.getElementById('inviteCustomMsg')?.value || '').trim();

                const emails = emailsRaw.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));
                if (emails.length === 0) {
                    alert('Please enter at least one valid candidate email address.');
                    return;
                }

                btnSubmitInvite.disabled = true;
                btnSubmitInvite.textContent = 'Dispatching Invitations...';

                try {
                    const res = await adminApi('/admin/candidates/invitations', {
                        method: 'POST',
                        body: JSON.stringify({
                            emails: emails,
                            assessment_id: asmtId,
                            expiry_days: expiryDays,
                            custom_message: customMsg || null
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`Successfully created ${emails.length} invitations!`);
                        closeModal('modalInviteCandidates');
                        document.getElementById('inviteEmailsInput').value = '';
                        loadCandidatesDirectory();
                    } else {
                        alert(data.detail || 'Failed to dispatch invitations.');
                    }
                } catch (e) {
                    alert('Network error while sending invitations.');
                } finally {
                    btnSubmitInvite.disabled = false;
                    btnSubmitInvite.textContent = 'Send Invitations';
                }
            });
        }
    }

    function openSuspendModal(cid, email) {
        selectedCandidateForAction = { id: cid, email: email };
        const label = document.getElementById('suspendTargetEmail');
        if (label) label.textContent = email;
        const input = document.getElementById('suspendReasonInput');
        if (input) input.value = '';
        openModal('modalSuspendCandidate');
    }

    function openAssignAssessmentModal(cid, email) {
        selectedCandidateForAction = { id: cid, email: email };
        const label = document.getElementById('assignTargetEmail');
        if (label) label.textContent = email;

        // Populate assessment select
        const sel = document.getElementById('assignAssessmentSelect');
        if (sel) {
            sel.innerHTML = '<option value="">-- Choose an assessment --</option>' +
                cachedAssessmentsList.map(a => `<option value="${a.id}">${escapeHtml(a.title)} (${a.duration_minutes || 60}m &bull; ${a.total_marks || 100} pts)</option>`).join('');
        }

        openModal('modalQuickAssign');
    }

    async function openEditCandidateModal(cid) {
        try {
            const res = await adminApi(`/admin/candidates/${encodeURIComponent(cid)}`);
            if (!res.ok) throw new Error('Failed to fetch candidate');
            const c = await res.json();
            selectedCandidateForAction = { id: cid, email: c.email };

            setInputValue('editCandidateName', c.full_name);
            setInputValue('editCandidateEmail', c.email);
            setInputValue('editCandidatePhone', c.phone_number || '');
            setInputValue('editCandidateCollege', c.college_name || '');
            setInputValue('editCandidateMajor', c.degree_major || '');
            setInputValue('editCandidateGradYear', c.graduation_year || '');

            openModal('modalEditCandidate');
        } catch (e) {
            alert('Could not load candidate information.');
        }
    }

    async function loadAvailableAssessments() {
        try {
            const res = await adminApi('/admin/assessments?limit=100');
            if (res.ok) {
                const data = await res.json();
                cachedAssessmentsList = data.assessments || [];
                const invSel = document.getElementById('inviteAssessmentSelect');
                if (invSel) {
                    invSel.innerHTML = '<option value="">-- Optional: Assign Assessment Upon Activation --</option>' +
                        cachedAssessmentsList.map(a => `<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('');
                }
            }
        } catch (_) {}
    }

    async function loadAvailableGroups() {
        try {
            const res = await adminApi('/admin/candidate-groups');
            if (res.ok) {
                cachedGroupsList = await res.json();
                const filterSel = document.getElementById('candidateGroupFilter');
                if (filterSel) {
                    filterSel.innerHTML = '<option value="">All Groups / Cohorts</option>' +
                        cachedGroupsList.map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${g.member_count})</option>`).join('');
                }
            }
        } catch (_) {}
    }

    // ==========================================================================
    // UI Helpers
    // ==========================================================================
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

    function setInputValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
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
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
