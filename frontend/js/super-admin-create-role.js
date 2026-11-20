/**
 * BugBash Super Admin - Create Custom Role Controller
 * Dynamically loads the granular permission catalog, manages module-level
 * and individual permission selection, and creates the custom role.
 */

(function () {
    'use strict';

    let catalog = [];
    let selectedPermissions = new Set();

    const elements = {
        form: document.getElementById('createRoleForm'),
        nameInput: document.getElementById('roleNameInput'),
        descInput: document.getElementById('roleDescInput'),
        selectedCountText: document.getElementById('selectedPermsCount'),
        totalCountText: document.getElementById('totalPermsCount'),
        modulesContainer: document.getElementById('modulesPermissionsContainer'),
        selectAllGlobalBtn: document.getElementById('selectAllGlobalBtn'),
        clearAllGlobalBtn: document.getElementById('clearAllGlobalBtn'),
        submitBtn: document.getElementById('createRoleSubmitBtn'),
        alertBox: document.getElementById('formAlert')
    };

    function init() {
        checkSuperAdminAuth();
        bindEvents();
        fetchCatalog();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }

        const superAdminUser = JSON.parse(localStorage.getItem('bugbash_super_admin_user') || '{}');
        const navName = document.getElementById('superAdminNavName');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        
        if (superAdminUser.name) {
            if (navName) navName.textContent = superAdminUser.name;
            if (sidebarName) sidebarName.textContent = superAdminUser.name;
            if (sidebarAvatar) {
                const initials = superAdminUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                sidebarAvatar.textContent = initials || 'SA';
            }
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
            elements.form.addEventListener('submit', handleFormSubmit);
        }

        if (elements.selectAllGlobalBtn) {
            elements.selectAllGlobalBtn.addEventListener('click', selectAllPermissions);
        }

        if (elements.clearAllGlobalBtn) {
            elements.clearAllGlobalBtn.addEventListener('click', clearAllPermissions);
        }

        // Logout
        const logoutBtn = document.getElementById('saLogoutBtn');
        const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
        [logoutBtn, sidebarLogoutBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    localStorage.removeItem('bugbash_super_admin_token');
                    sessionStorage.removeItem('bugbash_super_admin_token');
                    localStorage.removeItem('bugbash_super_admin_user');
                    window.location.href = '/super-admin/login';
                });
            }
        });
    }

    async function fetchCatalog() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/permissions`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) throw new Error('Failed to load permissions catalog');

            const data = await res.json();
            catalog = data.categories || [];

            if (elements.totalCountText) {
                elements.totalCountText.textContent = data.total_permissions;
            }

            renderModules();
            updateCounter();
        } catch (err) {
            console.error('Fetch catalog error:', err);
            showAlert('Unable to load permissions catalog.');
        }
    }

    function renderModules() {
        if (!elements.modulesContainer) return;

        elements.modulesContainer.innerHTML = catalog.map(category => {
            const catPerms = category.permissions || [];
            const checksHtml = catPerms.map(p => {
                const isChecked = selectedPermissions.has(p.id);
                return `
                    <div class="sa-perm-check-card ${isChecked ? 'checked' : ''}" onclick="window.CreateRole.togglePermission('${escapeHtml(p.id)}')">
                        <input type="checkbox" class="sa-perm-checkbox" id="chk_${escapeHtml(p.id)}" value="${escapeHtml(p.id)}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.CreateRole.togglePermission('${escapeHtml(p.id)}')">
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

                        <button type="button" class="sa-btn-secondary" style="padding: 6px 12px; font-size: 0.775rem;" onclick="window.CreateRole.toggleCategory('${escapeHtml(category.category_id)}')">
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

        // Re-render check states
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

    async function handleFormSubmit(e) {
        e.preventDefault();
        hideAlert();

        const name = elements.nameInput.value.trim();
        const description = elements.descInput.value.trim();

        if (!name || name.length < 2) {
            showAlert('Please specify a valid role title (at least 2 characters).');
            return;
        }

        if (!description || description.length < 5) {
            showAlert('Please provide a descriptive explanation of the role purpose (at least 5 characters).');
            return;
        }

        if (selectedPermissions.size === 0) {
            showAlert('Please select at least one permission for this role.');
            return;
        }

        try {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Creating Custom Role...';

            const payload = {
                name,
                description,
                permissions: Array.from(selectedPermissions)
            };

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.SUPER_ADMIN_ROLES) || '/super-admin/roles';

            const res = await fetch(apiBase + endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.status === 409) {
                showAlert(data.detail || `A role with name '${name}' already exists.`);
                return;
            }

            if (!res.ok) {
                throw new Error(data.detail || 'Failed to create role');
            }

            window.location.href = '/super-admin/roles';
        } catch (err) {
            console.error('Create role error:', err);
            showAlert(err.message || 'Error creating custom role.');
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Create Role & Save Permissions';
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

    // Export for onclick
    window.CreateRole = {
        togglePermission,
        toggleCategory
    };

    document.addEventListener('DOMContentLoaded', init);
})();
