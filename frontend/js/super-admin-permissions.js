/**
 * BugBash Super Admin - Permissions Matrix & Catalog Controller
 * Displays the complete granular permission catalog and the interactive cross-role permission matrix.
 */

(function () {
    'use strict';

    let catalog = [];
    let roles = [];
    let activeCategory = 'all';
    let searchQuery = '';

    const elements = {
        totalPermsCount: document.getElementById('matrixTotalPerms'),
        totalCatsCount: document.getElementById('matrixTotalCats'),
        searchInput: document.getElementById('matrixSearchInput'),
        categorySelect: document.getElementById('matrixCategoryFilter'),
        matrixContainer: document.getElementById('permissionMatrixTableContainer'),
        modulesCatalogView: document.getElementById('modulesCatalogView'),
        toast: document.getElementById('saToast')
    };

    function init() {
        checkSuperAdminAuth();
        bindEvents();
        fetchData();
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
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim().toLowerCase();
                renderMatrix();
            });
        }

        if (elements.categorySelect) {
            elements.categorySelect.addEventListener('change', (e) => {
                activeCategory = e.target.value;
                renderMatrix();
            });
        }
    }

    async function fetchData() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';

            // Parallel fetch: Catalog & Roles
            const [catRes, rolesRes] = await Promise.all([
                fetch(`${apiBase}/super-admin/permissions`, { method: 'GET', headers: getAuthHeaders() }),
                fetch(`${apiBase}/super-admin/roles`, { method: 'GET', headers: getAuthHeaders() })
            ]);

            if (!catRes.ok || !rolesRes.ok) throw new Error('Failed to load permissions telemetry');

            const catData = await catRes.json();
            const rolesData = await rolesRes.json();

            catalog = catData.categories || [];
            roles = rolesData.roles || [];

            if (elements.totalPermsCount) elements.totalPermsCount.textContent = catData.total_permissions;
            if (elements.totalCatsCount) elements.totalCatsCount.textContent = catData.total_categories;

            // Populate category select
            if (elements.categorySelect) {
                elements.categorySelect.innerHTML = `
                    <option value="all">All Modules (${catData.total_categories})</option>
                    ${catalog.map(c => `<option value="${escapeHtml(c.category_id)}">${escapeHtml(c.category_name)}</option>`).join('')}
                `;
            }

            renderMatrix();
        } catch (err) {
            console.error('Fetch permissions error:', err);
        }
    }

    function renderMatrix() {
        if (!elements.matrixContainer) return;

        // Filter permissions based on category & search
        let displayedPerms = [];
        catalog.forEach(cat => {
            if (activeCategory === 'all' || activeCategory === cat.category_id) {
                cat.permissions.forEach(p => {
                    if (!searchQuery || p.name.toLowerCase().includes(searchQuery) || p.id.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery)) {
                        displayedPerms.push({ ...p, module_name: cat.category_name });
                    }
                });
            }
        });

        // Top 8 prominent roles for comparison
        const comparedRoles = roles.slice(0, 8);

        const tableHead = `
            <thead>
                <tr>
                    <th>Permission &amp; Module</th>
                    ${comparedRoles.map(r => `
                        <th>
                            <div>${escapeHtml(r.name)}</div>
                            <span style="font-size: 0.675rem; font-weight: normal; color: var(--text-muted);">${r.is_system ? 'System' : 'Custom'}</span>
                        </th>
                    `).join('')}
                </tr>
            </thead>
        `;

        if (displayedPerms.length === 0) {
            elements.matrixContainer.innerHTML = `
                <div style="padding: 48px; text-align: center; color: var(--text-muted);">
                    No permissions match your filter.
                </div>
            `;
            return;
        }

        const tableBody = `
            <tbody>
                ${displayedPerms.map(p => {
                    const rowChecks = comparedRoles.map(r => {
                        // Check if role has this permission
                        const hasPerm = (r.sample_permissions || []).some(sp => sp.includes('*')) ||
                                        r.slug === 'super_admin' ||
                                        (r.sample_permissions || []).includes(p.id);

                        return `
                            <td>
                                ${hasPerm ? `
                                    <span class="sa-matrix-check" title="Authorized">&#10003;</span>
                                ` : `
                                    <span class="sa-matrix-dash">&mdash;</span>
                                `}
                            </td>
                        `;
                    }).join('');

                    return `
                        <tr>
                            <td>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">
                                    ${escapeHtml(p.name)}
                                    ${p.is_sensitive ? '<span class="sa-perm-sensitive-pill" style="margin-left: 6px;">Sensitive</span>' : ''}
                                </div>
                                <div style="font-size: 0.725rem; font-family: var(--font-mono); color: var(--text-muted); margin-top: 2px;">
                                    ${escapeHtml(p.id)} &bull; <span style="color: var(--primary-color);">${escapeHtml(p.module_name)}</span>
                                </div>
                            </td>
                            ${rowChecks}
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;

        elements.matrixContainer.innerHTML = `
            <table class="sa-matrix-table">
                ${tableHead}
                ${tableBody}
            </table>
        `;
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

    document.addEventListener('DOMContentLoaded', init);
})();
