/**
 * BugBash - Enterprise Admin Notification Templates Controller
 * Manages reusable templates, safe interpolation previews,
 * template authoring and category filtering.
 */

(function () {
    'use strict';

    let allTemplates = [];
    let selectedCategory = 'all';
    let currentSearchTerm = '';
    let editingTemplateId = null;

    function getAuthToken() {
        return localStorage.getItem('bugbash_admin_token') || localStorage.getItem('access_token') || '';
    }

    function checkAuth() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getAuthToken()
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!checkAuth()) return;

        initEventListeners();
        loadTemplates();
    });

    function initEventListeners() {
        // Search
        const searchInput = document.getElementById('templateSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                currentSearchTerm = this.value.trim().toLowerCase();
                renderTemplates();
            });
        }

        // Category tabs
        const catTabs = document.querySelectorAll('.category-tab-btn');
        catTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                catTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                selectedCategory = this.getAttribute('data-category');
                renderTemplates();
            });
        });

        // Open Create Modal
        const btnNew = document.getElementById('btnOpenCreateTemplate');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                openTemplateModal(null);
            });
        }

        // Modal Close Buttons
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            });
        });

        // Template Form Submit
        const form = document.getElementById('templateForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                saveTemplate();
            });
        }
    }

    async function loadTemplates() {
        const grid = document.getElementById('templatesGrid');
        if (!grid) return;

        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Loading templates...</div>`;

        try {
            const res = await fetch('/api/v1/admin/notification-templates', {
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                allTemplates = await res.json();
                renderTemplates();
            } else {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Failed to load templates.</div>`;
            }
        } catch (e) {
            console.error('Error fetching templates:', e);
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Network error loading templates.</div>`;
        }
    }

    function renderTemplates() {
        const grid = document.getElementById('templatesGrid');
        if (!grid) return;

        let filtered = allTemplates;

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(t => (t.category || '').toLowerCase().includes(selectedCategory.toLowerCase()));
        }

        if (currentSearchTerm) {
            filtered = filtered.filter(t =>
                (t.name || '').toLowerCase().includes(currentSearchTerm) ||
                (t.subject || '').toLowerCase().includes(currentSearchTerm) ||
                (t.description || '').toLowerCase().includes(currentSearchTerm)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <div style="font-size: 36px; margin-bottom: 12px; color: var(--notif-primary);">&#128196;</div>
                    <h3 style="margin-bottom: 6px;">No notification templates found</h3>
                    <p style="color: var(--text-secondary); font-size: 13px;">Try adjusting your search terms or category selection.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(t => {
            const isSystem = t.is_system === true;
            const varsList = (t.variables || []).map(v => `<span class="var-chip" style="cursor:default;">{{${escapeHtml(v)}}}</span>`).join('');

            return `
                <div class="template-card">
                    <div>
                        <div class="template-card-header">
                            <div>
                                <h4 class="template-name">${escapeHtml(t.name)}</h4>
                                <p class="template-desc">${escapeHtml(t.description)}</p>
                            </div>
                            <span class="${isSystem ? 'template-system-tag' : 'notif-pill category'}">${isSystem ? 'System Default' : escapeHtml(t.category)}</span>
                        </div>

                        <div style="margin: 12px 0 8px 0; font-size: 12px; color: var(--text-secondary);">
                            <strong>Subject:</strong> <span style="color: var(--text-primary);">${escapeHtml(t.subject)}</span>
                        </div>

                        <div style="margin-top: 10px;">
                            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Dynamic Variables:</span>
                            <div class="template-variables-list">
                                ${varsList || '<span style="font-size: 11px; color: var(--text-secondary);">No dynamic variables</span>'}
                            </div>
                        </div>
                    </div>

                    <div class="template-actions">
                        <a href="/admin/create-notification?template_id=${t.template_id}" class="btn-use-template" title="Compose notification using this template">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Use Template
                        </a>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" class="action-btn" onclick="window.previewTemplateModal('${t.template_id}')" title="Preview Interpolated Output">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            ${!isSystem ? `
                                <button type="button" class="action-btn" onclick="window.editTemplateModal('${t.template_id}')" title="Edit Template">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button type="button" class="action-btn danger" onclick="window.deleteTemplateModal('${t.template_id}')" title="Delete Template">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openTemplateModal(tmpl) {
        editingTemplateId = tmpl ? tmpl.template_id : null;
        const modal = document.getElementById('templateEditorModal');
        const modalTitle = document.getElementById('templateModalTitle');

        if (tmpl) {
            modalTitle.textContent = 'Edit Notification Template';
            document.getElementById('tmplName').value = tmpl.name;
            document.getElementById('tmplCategory').value = tmpl.category;
            document.getElementById('tmplDescription').value = tmpl.description;
            document.getElementById('tmplSubject').value = tmpl.subject;
            document.getElementById('tmplBody').value = tmpl.body;
            document.getElementById('tmplVariables').value = (tmpl.variables || []).join(', ');
        } else {
            modalTitle.textContent = 'Create Notification Template';
            document.getElementById('templateForm').reset();
        }

        if (modal) modal.classList.add('active');
    }

    async function saveTemplate() {
        const name = document.getElementById('tmplName').value.trim();
        const category = document.getElementById('tmplCategory').value;
        const description = document.getElementById('tmplDescription').value.trim();
        const subject = document.getElementById('tmplSubject').value.trim();
        const body = document.getElementById('tmplBody').value.trim();
        const varsVal = document.getElementById('tmplVariables').value.trim();
        const variables = varsVal ? varsVal.split(',').map(s => s.trim()).filter(Boolean) : [];

        if (!name || !subject || !body) {
            alert('Please fill out all required fields (Name, Subject, Body).');
            return;
        }

        const payload = {
            name,
            category,
            description,
            subject,
            body,
            variables
        };

        try {
            let url = '/api/v1/admin/notification-templates';
            let method = 'POST';

            if (editingTemplateId) {
                url = `/api/v1/admin/notification-templates/${editingTemplateId}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                document.getElementById('templateEditorModal').classList.remove('active');
                loadTemplates();
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail || 'Failed to save template'}`);
            }
        } catch (e) {
            console.error('Error saving template:', e);
            alert('Network error while saving template.');
        }
    }

    window.editTemplateModal = function (id) {
        const tmpl = allTemplates.find(t => t.template_id === id);
        if (tmpl) openTemplateModal(tmpl);
    };

    window.deleteTemplateModal = async function (id) {
        if (!confirm('Are you sure you want to delete this template?')) return;
        try {
            const res = await fetch(`/api/v1/admin/notification-templates/${id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                loadTemplates();
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail || 'Could not delete template'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to delete template');
        }
    };

    // Safe Preview Modal with dynamic variable interpolation
    window.previewTemplateModal = async function (id) {
        const tmpl = allTemplates.find(t => t.template_id === id);
        if (!tmpl) return;

        const modal = document.getElementById('templatePreviewModal');
        const previewContainer = document.getElementById('previewModalContent');
        const varsFormContainer = document.getElementById('previewVarsForm');

        document.getElementById('previewModalTemplateName').textContent = tmpl.name;

        // Populate variable test input fields
        const vars = tmpl.variables || [];
        if (vars.length > 0) {
            varsFormContainer.innerHTML = vars.map(v => `
                <div class="form-group" style="margin-bottom: 8px;">
                    <label class="form-label" style="font-size: 11px;">${escapeHtml(v)}:</label>
                    <input type="text" class="form-input var-test-input" data-var="${escapeHtml(v)}" value="Sample ${escapeHtml(v)}" style="padding: 6px 10px; font-size: 12px;">
                </div>
            `).join('');
            varsFormContainer.style.display = 'block';
        } else {
            varsFormContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary);">No dynamic variables required for this template.</p>';
        }

        async function fetchInterpolation() {
            const sampleData = {};
            document.querySelectorAll('.var-test-input').forEach(input => {
                sampleData[input.getAttribute('data-var')] = input.value;
            });

            try {
                const res = await fetch('/api/v1/admin/notification-templates/preview', {
                    method: 'POST',
                    credentials: 'include',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        subject: tmpl.subject,
                        body: tmpl.body,
                        sample_data: sampleData
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    previewContainer.innerHTML = `
                        <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--notif-border); border-radius: 8px; padding: 16px;">
                            <h4 style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 14px;">${escapeHtml(data.interpolated_subject)}</h4>
                            <div style="white-space: pre-line; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">${escapeHtml(data.interpolated_body)}</div>
                        </div>
                    `;
                }
            } catch (e) {
                console.error('Preview error:', e);
            }
        }

        // Attach change listeners to test inputs
        document.querySelectorAll('.var-test-input').forEach(input => {
            input.addEventListener('input', fetchInterpolation);
        });

        await fetchInterpolation();
        if (modal) modal.classList.add('active');
    };

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
