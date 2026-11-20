/**
 * BugBash - Candidate Groups Management Controller
 * Manages cohorts, batch creation, member assignments, group telemetry,
 * and bulk group assessment scheduling.
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

    let groupsData = [];
    let cachedAssessments = [];
    let activeGroupId = null;

    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();
        initModals();

        await Promise.all([
            loadGroups(),
            loadAvailableAssessments()
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

    async function loadGroups() {
        const grid = document.getElementById('groupsGridLayout');
        if (!grid) return;

        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
                <div style="display: inline-block; width: 24px; height: 24px; border: 2px solid #ff6b35; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <div style="margin-top: 12px; font-size: 13.5px;">Loading candidate groups...</div>
            </div>
        `;

        try {
            const res = await adminApi('/admin/candidate-groups');
            if (!res.ok) throw new Error('Failed to load candidate groups');
            groupsData = await res.json();

            if (groupsData.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px; color: var(--text-primary);">No groups created yet</div>
                        <div style="font-size: 13px; margin-bottom: 16px;">Organize candidates into cohorts like 'Python Batch A' or 'Placement Candidates'.</div>
                        <button type="button" class="btn btn-primary" onclick="openModal('modalCreateGroup')">+ Create First Group</button>
                    </div>
                `;
                return;
            }

            grid.innerHTML = groupsData.map(g => renderGroupCard(g)).join('');
            attachGroupCardListeners();

        } catch (err) {
            console.error('[BugBash] Error loading groups:', err);
            grid.innerHTML = '<div style="grid-column: 1 / -1; color: #ef4444; padding: 24px; text-align: center;">Failed to load candidate groups.</div>';
        }
    }

    function renderGroupCard(g) {
        const tagsHtml = (g.tags || []).map(t => `<span class="group-tag-pill">${escapeHtml(t)}</span>`).join('');

        return `
            <div class="group-card-item" data-id="${g.id}">
                <div>
                    <div class="group-card-header">
                        <div>
                            <h3 class="group-card-title">${escapeHtml(g.name)}</h3>
                            <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(g.id)}</span>
                        </div>
                        <button type="button" class="btn-action-icon btn-edit-group" data-id="${g.id}" title="Edit Group">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                    </div>

                    <p class="group-card-desc">${escapeHtml(g.description || 'No cohort description provided.')}</p>

                    <div class="group-tags-cluster">${tagsHtml}</div>
                </div>

                <div>
                    <div class="group-meta-stats">
                        <div>
                            <div class="group-meta-item-label">Candidates</div>
                            <div class="group-meta-item-val" style="color: #ff6b35;">${g.member_count}</div>
                        </div>
                        <div>
                            <div class="group-meta-item-label">Assessments</div>
                            <div class="group-meta-item-val">${g.assigned_assessments_count}</div>
                        </div>
                        <div>
                            <div class="group-meta-item-label">Avg Score</div>
                            <div class="group-meta-item-val" style="color: #10b981;">${g.average_score > 0 ? g.average_score + ' pts' : '--'}</div>
                        </div>
                    </div>

                    <div class="group-card-actions">
                        <button type="button" class="btn btn-secondary btn-sm btn-manage-members" data-id="${g.id}" data-name="${escapeHtml(g.name)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span>Manage (${g.member_count})</span>
                        </button>
                        <button type="button" class="btn btn-primary btn-sm btn-assign-group-exam" data-id="${g.id}" data-name="${escapeHtml(g.name)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            <span>Assign Exam</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function attachGroupCardListeners() {
        // Edit Group
        document.querySelectorAll('.btn-edit-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-id');
                const grp = groupsData.find(g => g.id === gid);
                if (grp) openEditGroupModal(grp);
            });
        });

        // Manage Members
        document.querySelectorAll('.btn-manage-members').forEach(btn => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openManageMembersModal(gid, name);
            });
        });

        // Assign Exam to Group
        document.querySelectorAll('.btn-assign-group-exam').forEach(btn => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openAssignGroupExamModal(gid, name);
            });
        });
    }

    function initModals() {
        // Create Group Modal
        const btnOpenCreate = document.getElementById('btnOpenCreateGroupModal');
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener('click', () => {
                setInputValue('createGroupName', '');
                setInputValue('createGroupDesc', '');
                setInputValue('createGroupTags', '');
                openModal('modalCreateGroup');
            });
        }

        const btnSubmitCreate = document.getElementById('btnSubmitCreateGroup');
        if (btnSubmitCreate) {
            btnSubmitCreate.addEventListener('click', async () => {
                const name = (document.getElementById('createGroupName')?.value || '').trim();
                const desc = (document.getElementById('createGroupDesc')?.value || '').trim();
                const tagsRaw = (document.getElementById('createGroupTags')?.value || '').trim();
                const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

                if (name.length < 2) {
                    alert('Please enter a group name (at least 2 characters).');
                    return;
                }

                btnSubmitCreate.disabled = true;
                btnSubmitCreate.textContent = 'Creating...';

                try {
                    const res = await adminApi('/admin/candidate-groups', {
                        method: 'POST',
                        body: JSON.stringify({ name: name, description: desc, tags: tags })
                    });
                    if (res.ok) {
                        alert(`Group '${name}' created successfully!`);
                        closeModal('modalCreateGroup');
                        loadGroups();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to create group.');
                    }
                } catch (e) {
                    alert('Network error while creating group.');
                } finally {
                    btnSubmitCreate.disabled = false;
                    btnSubmitCreate.textContent = 'Create Group';
                }
            });
        }

        // Edit Group Modal
        const btnSubmitEdit = document.getElementById('btnSubmitEditGroup');
        if (btnSubmitEdit) {
            btnSubmitEdit.addEventListener('click', async () => {
                if (!activeGroupId) return;
                const name = (document.getElementById('editGroupName')?.value || '').trim();
                const desc = (document.getElementById('editGroupDesc')?.value || '').trim();
                const tagsRaw = (document.getElementById('editGroupTags')?.value || '').trim();
                const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

                btnSubmitEdit.disabled = true;
                btnSubmitEdit.textContent = 'Saving...';

                try {
                    const res = await adminApi(`/admin/candidate-groups/${encodeURIComponent(activeGroupId)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ name: name, description: desc, tags: tags })
                    });
                    if (res.ok) {
                        alert('Group updated successfully.');
                        closeModal('modalEditGroup');
                        loadGroups();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to update group.');
                    }
                } catch (e) {
                    alert('Network error while updating group.');
                } finally {
                    btnSubmitEdit.disabled = false;
                    btnSubmitEdit.textContent = 'Save Changes';
                }
            });
        }

        // Delete Group Button inside Edit Modal
        const btnDeleteGroup = document.getElementById('btnDeleteGroup');
        if (btnDeleteGroup) {
            btnDeleteGroup.addEventListener('click', async () => {
                if (!activeGroupId) return;
                if (!confirm('Are you sure you want to delete this group? Candidates in this group will not be deleted.')) return;

                try {
                    const res = await adminApi(`/admin/candidate-groups/${encodeURIComponent(activeGroupId)}`, { method: 'DELETE' });
                    if (res.ok) {
                        alert('Group deleted successfully.');
                        closeModal('modalEditGroup');
                        loadGroups();
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to delete group.');
                    }
                } catch (e) {
                    alert('Network error while deleting group.');
                }
            });
        }

        // Add Member Button
        const btnAddMember = document.getElementById('btnAddGroupMember');
        if (btnAddMember) {
            btnAddMember.addEventListener('click', async () => {
                const input = document.getElementById('inputAddMemberEmail');
                const val = (input?.value || '').trim();
                if (!val) {
                    alert('Please enter a candidate email or ID.');
                    return;
                }

                try {
                    const res = await adminApi(`/admin/candidate-groups/${encodeURIComponent(activeGroupId)}/members`, {
                        method: 'POST',
                        body: JSON.stringify({ candidate_ids_or_emails: [val] })
                    });
                    if (res.ok) {
                        alert(`Candidate '${val}' added to group!`);
                        input.value = '';
                        loadGroups();
                        closeModal('modalManageMembers');
                    } else {
                        const err = await res.json();
                        alert(err.detail || 'Failed to add member.');
                    }
                } catch (e) {
                    alert('Network error adding member.');
                }
            });
        }

        // Assign Exam to Group Modal
        const btnSubmitGroupAssign = document.getElementById('btnSubmitAssignGroupExam');
        if (btnSubmitGroupAssign) {
            btnSubmitGroupAssign.addEventListener('click', async () => {
                const asmtId = document.getElementById('groupAssignAssessmentSelect')?.value;
                const deadline = document.getElementById('groupAssignDeadlineInput')?.value || null;

                if (!asmtId) {
                    alert('Please choose an assessment to assign.');
                    return;
                }

                btnSubmitGroupAssign.disabled = true;
                btnSubmitGroupAssign.textContent = 'Assigning to Group...';

                try {
                    const res = await adminApi(`/admin/candidate-groups/${encodeURIComponent(activeGroupId)}/assign-assessment`, {
                        method: 'POST',
                        body: JSON.stringify({
                            assessment_id: asmtId,
                            deadline: deadline
                        })
                    });
                    const d = await res.json();
                    if (res.ok) {
                        alert(d.message || 'Assessment successfully assigned to group!');
                        closeModal('modalAssignGroupExam');
                        loadGroups();
                    } else {
                        alert(d.detail || 'Failed to assign assessment to group.');
                    }
                } catch (e) {
                    alert('Network error assigning assessment to group.');
                } finally {
                    btnSubmitGroupAssign.disabled = false;
                    btnSubmitGroupAssign.textContent = 'Assign to All Members';
                }
            });
        }
    }

    function openEditGroupModal(grp) {
        activeGroupId = grp.id;
        setInputValue('editGroupName', grp.name);
        setInputValue('editGroupDesc', grp.description || '');
        setInputValue('editGroupTags', (grp.tags || []).join(', '));
        openModal('modalEditGroup');
    }

    function openManageMembersModal(gid, name) {
        activeGroupId = gid;
        setText('manageMembersGroupName', name);
        openModal('modalManageMembers');
    }

    function openAssignGroupExamModal(gid, name) {
        activeGroupId = gid;
        setText('assignGroupNameLabel', name);

        const sel = document.getElementById('groupAssignAssessmentSelect');
        if (sel) {
            sel.innerHTML = '<option value="">-- Choose an assessment to assign --</option>' +
                cachedAssessments.map(a => `<option value="${a.id}">${escapeHtml(a.title)} (${a.duration_minutes || 60}m)</option>`).join('');
        }

        openModal('modalAssignGroupExam');
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

    function setInputValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
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
