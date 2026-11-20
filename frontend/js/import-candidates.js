/**
 * BugBash - Candidate Bulk CSV Import Controller
 * Client-side CSV parsing, validation, template generation, duplicate checks,
 * preview tables, and backend bulk provisioning integration.
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

    const EMAIL_REGEX = /^[\w\.-]+@([\w-]+\.)+[\w-]{2,8}$/;

    let parsedRows = [];
    let cachedAssessments = [];

    document.addEventListener('DOMContentLoaded', async () => {
        initCommonLayout();
        initDropZone();
        initTemplateDownload();
        initImportActions();
        await loadAvailableAssessments();
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

    function initDropZone() {
        const dropzone = document.getElementById('csvDropZone');
        const fileInput = document.getElementById('csvFileInput');

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        ['dragleave', 'dragend'].forEach(type => {
            dropzone.addEventListener(type, () => dropzone.classList.remove('drag-over'));
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });
    }

    function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Please select a valid .csv file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            processCsvText(text, file.name);
        };
        reader.readAsText(file);
    }

    function processCsvText(csvText, fileName) {
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
            alert('CSV file must have a header row and at least one data record.');
            return;
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const nameIdx = header.findIndex(h => h.includes('name'));
        const emailIdx = header.findIndex(h => h.includes('email'));
        const phoneIdx = header.findIndex(h => h.includes('phone') || h.includes('mobile'));
        const groupIdx = header.findIndex(h => h.includes('group') || h.includes('batch') || h.includes('cohort'));

        if (nameIdx === -1 || emailIdx === -1) {
            alert("CSV must contain columns for 'Full Name' and 'Email'. Please check the template.");
            return;
        }

        parsedRows = [];
        const seenEmails = new Set();
        let validCount = 0;
        let dupCount = 0;
        let errCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const rawCells = parseCsvRow(lines[i]);
            const fullName = (rawCells[nameIdx] || '').trim();
            const email = (rawCells[emailIdx] || '').trim().toLowerCase();
            const phone = phoneIdx !== -1 ? (rawCells[phoneIdx] || '').trim() : '';
            const group = groupIdx !== -1 ? (rawCells[groupIdx] || '').trim() : '';

            let status = 'valid';
            let statusText = 'Ready';

            if (!fullName || fullName.length < 2) {
                status = 'error';
                statusText = 'Name too short';
                errCount++;
            } else if (!email || !EMAIL_REGEX.test(email)) {
                status = 'error';
                statusText = 'Invalid email';
                errCount++;
            } else if (seenEmails.has(email)) {
                status = 'duplicate';
                statusText = 'Duplicate in file';
                dupCount++;
            } else {
                seenEmails.add(email);
                validCount++;
            }

            parsedRows.push({
                rowNum: i,
                full_name: fullName,
                email: email,
                phone_number: phone || null,
                group_name: group || null,
                validationStatus: status,
                validationMessage: statusText
            });
        }

        // Show file badge
        const badge = document.getElementById('uploadedFileBadge');
        if (badge) {
            badge.style.display = 'inline-flex';
            badge.textContent = `Loaded: ${fileName} (${parsedRows.length} rows)`;
        }

        // Render preview table
        renderPreviewTable(parsedRows);

        // Update summary badges
        setText('valCountValid', validCount);
        setText('valCountDuplicate', dupCount);
        setText('valCountError', errCount);

        // Show preview card
        const card = document.getElementById('csvPreviewCard');
        if (card) card.style.display = 'block';

        const btnConfirm = document.getElementById('btnConfirmImport');
        if (btnConfirm) btnConfirm.disabled = validCount === 0;
    }

    function parseCsvRow(line) {
        const result = [];
        let insideQuotes = false;
        let current = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function renderPreviewTable(rows) {
        const tbody = document.getElementById('csvPreviewTableBody');
        if (!tbody) return;

        tbody.innerHTML = rows.slice(0, 50).map(r => `
            <tr>
                <td style="font-family: monospace; font-weight: 700; color: var(--text-muted);">${r.rowNum}</td>
                <td><strong>${escapeHtml(r.full_name)}</strong></td>
                <td style="font-family: monospace;">${escapeHtml(r.email)}</td>
                <td>${escapeHtml(r.phone_number || '--')}</td>
                <td>${r.group_name ? `<span class="group-tag-pill">${escapeHtml(r.group_name)}</span>` : '--'}</td>
                <td>
                    <span class="val-badge ${r.validationStatus}">
                        ${escapeHtml(r.validationMessage)}
                    </span>
                </td>
            </tr>
        `).join('');

        const hint = document.getElementById('previewTruncateNotice');
        if (hint) {
            hint.style.display = rows.length > 50 ? 'block' : 'none';
        }
    }

    function initTemplateDownload() {
        const btn = document.getElementById('btnDownloadCsvTemplate');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const csvContent = 
                    "Full Name,Email,Phone Number,Group Name\n" +
                    "Alex Candidate,candidate.alex@bugbash.io,+1 (555) 123-4567,Python Batch A\n" +
                    "Sam Candidate,candidate.sam@bugbash.io,+1 (555) 987-6543,Placement Candidates\n" +
                    "Priya Sharma,candidate.priya@bugbash.io,+91 9876543210,Final Year Students\n";

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', 'bugbash_candidates_template.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }

    function initImportActions() {
        const btnConfirm = document.getElementById('btnConfirmImport');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', async () => {
                const validRows = parsedRows.filter(r => r.validationStatus === 'valid');
                if (validRows.length === 0) {
                    alert('No valid candidate records to import.');
                    return;
                }

                const sendInvites = document.getElementById('chkSendInvitations')?.checked ?? true;
                const asmtId = document.getElementById('importAssignAssessmentSelect')?.value || null;

                btnConfirm.disabled = true;
                btnConfirm.textContent = 'Importing Candidates...';

                try {
                    const payload = {
                        rows: validRows.map(r => ({
                            full_name: r.full_name,
                            email: r.email,
                            phone_number: r.phone_number,
                            group_name: r.group_name
                        })),
                        send_invitations: sendInvites,
                        assessment_id: asmtId
                    };

                    const res = await adminApi('/admin/candidates/import', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (res.ok) {
                        showImportReport(data);
                    } else {
                        alert(data.detail || 'Import failed.');
                    }

                } catch (e) {
                    alert('Network error while processing candidate import.');
                } finally {
                    btnConfirm.disabled = false;
                    btnConfirm.textContent = 'Confirm & Import Records';
                }
            });
        }
    }

    function showImportReport(data) {
        setText('reportTotalRows', data.total_rows);
        setText('reportSuccess', data.successful_count);
        setText('reportDuplicates', data.duplicate_count);
        setText('reportFailed', data.failed_count);

        const errList = document.getElementById('reportErrorsList');
        if (errList) {
            if (data.errors && data.errors.length > 0) {
                errList.innerHTML = data.errors.map(e => `
                    <div style="font-size: 12.5px; padding: 4px 0; border-bottom: 1px solid var(--border-color); color: #fca5a5;">
                        <strong>${escapeHtml(e.email || 'Row')}:</strong> ${escapeHtml(e.error)}
                    </div>
                `).join('');
                errList.style.display = 'block';
            } else {
                errList.style.display = 'none';
            }
        }

        const modal = document.getElementById('modalImportReport');
        if (modal) modal.style.display = 'flex';
    }

    async function loadAvailableAssessments() {
        try {
            const res = await adminApi('/admin/assessments?limit=100');
            if (res.ok) {
                const d = await res.json();
                cachedAssessments = d.assessments || [];
                const sel = document.getElementById('importAssignAssessmentSelect');
                if (sel) {
                    sel.innerHTML = '<option value="">-- None (Do not assign assessment now) --</option>' +
                        cachedAssessments.map(a => `<option value="${a.id}">${escapeHtml(a.title)} (${a.duration_minutes || 60}m)</option>`).join('');
                }
            }
        } catch (_) {}
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
