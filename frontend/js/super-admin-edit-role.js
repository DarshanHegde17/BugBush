/**
 * BugBash Super Admin - Edit Role & Permissions Controller
 * Loads existing role data, manages permission modifications, warns about assigned admin impact,
 * and executes updates with immediate session propagation.
 */

(function () {
    'use strict';

    let roleId = '';
    let roleData = null;
    let catalog = [];
    let selectedPermissions = new Set();
    let initialPermissions = new Set();

    const elements = {
        form: document.getElementById('editRoleForm'),
        nameInput: document.getElementById('editRoleName'),
        descInput: document.getElementById('editRoleDesc'),
        assignedBanner: document.getElementById('assignedAdminsBanner'),
        assignedCountText: document.getElementById('assignedAdminsCountText'),
        selectedCountText: document.getElementById('selectedPermsCount'),
        totalCountText: document.getElementById('totalPermsCount'),
        modulesContainer: document.getElementById('modulesPermissionsContainer'),
        selectAllGlobalBtn: document.getElementById('selectAllGlobalBtn'),
        clearAllGlobalBtn: document.getElementById('clearAllGlobalBtn'),
        submitBtn: document.getElementById('editRoleSubmitBtn'),
        alertBox: document.getElementById('formAlert'),
        confirmModal: document.getElementById('roleUpdateConfirmModal'),
        confirmDiffBody: document.getElementById('confirmDiffBody'),
        modalConfirmBtn: document.getElementById('modalConfirmUpdateBtn'),
        modalCancelBtn: document.getElementById('modalCancelUpdateBtn')
    };

    function init() {
        checkSuperAdminAuth();

        const urlParams = new URLSearchParams(window.location.search);
        roleId = urlParams.get('id');

        if (!roleId) {
            window.location.href = '/super-admin/roles';
            return;
        }

        bindEvents();
        loadCatalogAndRole();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function bindEvents() {
        if (elements.form) {
            elements.form.addEventListener('submit', promptConfirmation);
        }

        if (elements.selectAllGlobalBtn) {
            elements.selectAllGlobalBtn.addEventListener('click', selectAllPermissions);
        }

        if (elements.clearAllGlobalBtn) {
            elements.clearAllGlobalBtn.addEventListener('click', clearAllPermissions);
        }

        if (elements.modalConfirmBtn) {
            elements.modalConfirmBtn.addEventListener('click', executeRoleUpdate);
        }

        if (elements.modalCancelBtn) {
            elements.modalCancelBtn.addEventListener('click', closeConfirmModal);
        }
    }

    async function loadCatalogAndRole() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';

            // 1. Load catalog
            const catRes = await fetch(`${apiBase}/super-admin/permissions`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            if (!catRes.ok) throw new Error('Failed to load permissions catalog');
            const catData = await catRes.json();
            catalog = catData.categories || [];

            if (elements.totalCountText) {
                elements.totalCountText.textContent = catData.total_permissions;
            }

            // 2. Load Role
            const roleRes = await fetch(`${apiBase}/super-admin/roles/${encodeURIComponent(roleId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            if (!roleRes.ok) throw new Error('Role not found');
            roleData = await roleRes.json();

            // Populate metadata
            if (elements.nameInput) {
                elements.nameInput.value = roleData.name;
                if (roleData.is_system) {
                    elements.nameInput.disabled = true;
                    elements.nameInput.classList.add('readonly');
                }
            }

            if (elements.descInput) elements.descInput.value = roleData.description;

            // Assigned Admins Banner
            const assignedCount = (roleData.assigned_admins || []).length;
            if (elements.assignedCountText) elements.assignedCountText.textContent = assignedCount;
            if (elements.assignedBanner) {
                elements.assignedBanner.style.display = assignedCount > 0 ? 'flex' : 'none';
            }

            // Populate permissions set
            selectedPermissions.clear();
            initialPermissions.clear();
            (roleData.permissions || []).forEach(p => {
                selectedPermissions.add(p);
                initialPermissions.add(p);
            });

            renderModules();
            updateCounter();
        } catch (err) {
            console.error('Error loading role:', err);
            showAlert('Unable to load role for editing.');
        }
    }

    function renderModules() {
        if (!elements.modulesContainer) return;

        elements.modulesContainer.innerHTML = catalog.map(category => {
            const catPerms = category.permissions || [];
            const checksHtml = catPerms.map(p => {
                const isChecked = selectedPermissions.has(p.id) || selectedPermissions.has('*');
                return `
                    <div class="sa-perm-check-card ${isChecked ? 'checked' : ''}" onclick="window.EditRole.togglePermission('${escapeHtml(p.id)}')">
                        <input type="checkbox" class="sa-perm-checkbox" id="chk_${escapeHtml(p.id)}" value="${escapeHtml(p.id)}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.EditRole.togglePermission('${escapeHtml(p.id)}')">
                        <div class="sa-perm-meta">
                            <div class="sa-perm-name-row">
                                <span class="sa-perm-name">${escapeHtml(p.name)}</span>
                                ${p.is_sensitive ? '<span class="sa-perm-sensitive-pill">Sensitive</span>' : ''}
                            </div>
                            <span class="sa-perm-key">${escapeHtml(p.id)}</span>
                            <span class="sa-perm-desc">${escapeHtml(p.description)}</span>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="sa-module-section" id="module_${escapeHtml(category.category_id)}">
                    <div class="sa-module-header">
                        <div class="sa-module-info">
                            <div class="sa-module-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                            </div>
                            <div>
                                <div class="sa-module-title">${escapeHtml(category.category_name)}</div>
                                <div class="sa-module-desc">${escapeHtml(category.description)}</div>
                            </div>
                        </div>

                        <button type="button" class="sa-btn-secondary" style="padding: 6px 12px; font-size: 0.775rem;" onclick="window.EditRole.toggleCategory('${escapeHtml(category.category_id)}')">
                            Toggle All in Module
                        </button>
                    </div>

                    <div class="sa-perms-checkbox-grid">
                        ${checksHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    function togglePermission(permId) {
        if (selectedPermissions.has(permId)) {
            selectedPermissions.delete(permId);
        } else {
            selectedPermissions.add(permId);
        }

        const chk = document.getElementById(`chk_${permId}`);
        if (chk) {
            chk.checked = selectedPermissions.has(permId);
            const card = chk.closest('.sa-perm-check-card');
            if (card) {
                if (chk.checked) card.classList.add('checked');
                else card.classList.remove('checked');
            }
        }

        updateCounter();
    }

    function toggleCategory(catId) {
        const cat = catalog.find(c => c.category_id === catId);
        if (!cat) return;

        const catPermIds = cat.permissions.map(p => p.id);
        const allSelected = catPermIds.every(id => selectedPermissions.has(id));

        if (allSelected) {
            catPermIds.forEach(id => selectedPermissions.delete(id));
        } else {
            catPermIds.forEach(id => selectedPermissions.add(id));
        }

        catPermIds.forEach(id => {
            const chk = document.getElementById(`chk_${id}`);
            if (chk) {
                chk.checked = selectedPermissions.has(id);
                const card = chk.closest('.sa-perm-check-card');
                if (card) {
                    if (chk.checked) card.classList.add('checked');
                    else card.classList.remove('checked');
                }
            }
        });

        updateCounter();
    }

    function selectAllPermissions() {
        catalog.forEach(cat => {
            cat.permissions.forEach(p => selectedPermissions.add(p.id));
        });

        document.querySelectorAll('.sa-perm-checkbox').forEach(chk => {
            chk.checked = true;
            const card = chk.closest('.sa-perm-check-card');
            if (card) card.classList.add('checked');
        });

        updateCounter();
    }

    function clearAllPermissions() {
        selectedPermissions.clear();

        document.querySelectorAll('.sa-perm-checkbox').forEach(chk => {
            chk.checked = false;
            const card = chk.closest('.sa-perm-check-card');
            if (card) card.classList.remove('checked');
        });

        updateCounter();
    }

    function updateCounter() {
        if (elements.selectedCountText) {
            elements.selectedCountText.textContent = selectedPermissions.size;
        }
    }

    function promptConfirmation(e) {
        e.preventDefault();
        hideAlert();

        const name = elements.nameInput.value.trim();
        const description = elements.descInput.value.trim();

        if (!name || name.length < 2) {
            showAlert('Please specify a valid role name.');
            return;
        }

        if (selectedPermissions.size === 0 && roleData.slug !== 'super_admin') {
            showAlert('Please select at least one permission.');
            return;
        }

        // Calculate diff
        const added = [...selectedPermissions].filter(p => !initialPermissions.has(p));
        const removed = [...initialPermissions].filter(p => !selectedPermissions.has(p));
        const assignedCount = (roleData.assigned_admins || []).length;

        if (elements.confirmDiffBody) {
            elements.confirmDiffBody.innerHTML = `
                <p style="margin-bottom: 12px;">
                    You are updating permissions for role <strong>${escapeHtml(roleData.name)}</strong>.
                    ${assignedCount > 0 ? `<br><span style="color:#f59e0b; font-weight:700;">Impact Warning:</span> This role is assigned to <strong>${assignedCount} administrator(s)</strong>. All active sessions will be refreshed.` : ''}
                </p>
                <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 8px;">
                    <div><strong>Added Permissions (${added.length}):</strong> ${added.length ? added.map(p => `<span class="sa-role-perm-chip" style="color:#10b981;">+${escapeHtml(p)}</span>`).join(' ') : 'None'}</div>
                    <div><strong>Removed Permissions (${removed.length}):</strong> ${removed.length ? removed.map(p => `<span class="sa-role-perm-chip" style="color:#ef4444;">-${escapeHtml(p)}</span>`).join(' ') : 'None'}</div>
                </div>
            `;
        }

        if (elements.confirmModal) elements.confirmModal.classList.add('open');
    }

    function closeConfirmModal() {
        if (elements.confirmModal) elements.confirmModal.classList.remove('open');
    }

    async function executeRoleUpdate() {
        closeConfirmModal();

        try {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Saving Changes...';

            const payload = {
                name: elements.nameInput.value.trim(),
                description: elements.descInput.value.trim(),
                permissions: Array.from(selectedPermissions)
            };

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/roles/${encodeURIComponent(roleId)}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to update role');

            window.location.href = `/super-admin/role-details?id=${encodeURIComponent(roleId)}`;
        } catch (err) {
            console.error('Update role error:', err);
            showAlert(err.message || 'Error updating role');
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Save Changes';
        }
    }

    function showAlert(msg) {
        if (!elements.alertBox) return;
        elements.alertBox.textContent = msg;
        elements.alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (!elements.alertBox) return;
        elements.alertBox.style.display = 'none';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.EditRole = {
        togglePermission,
        toggleCategory
    };

    document.addEventListener('DOMContentLoaded', init);
})();
