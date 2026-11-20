/**
 * BugBash - Super Admin External Integrations Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
    if (!token) {
        window.location.href = '/super-admin/login';
        return;
    }

    const grid = document.getElementById('integrationsGrid');
    const refreshBtn = document.getElementById('refreshIntegrationsBtn');
    const testModal = document.getElementById('diagModal');
    const diagModalTitle = document.getElementById('diagModalTitle');
    const diagModalBody = document.getElementById('diagModalBody');
    const closeDiagModalBtn = document.getElementById('closeDiagModalBtn');

    await loadIntegrations();

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = 'Testing Integrations...';
            await loadIntegrations();
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = 'Refresh &amp; Test All';
        });
    }

    async function loadIntegrations() {
        try {
            const resp = await fetch('/api/v1/super-admin/integrations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 401 || resp.status === 403) {
                window.location.href = '/super-admin/login';
                return;
            }
            const items = await resp.json();
            renderGrid(items);
        } catch (err) {
            console.error('Failed to load integrations:', err);
        }
    }

    function renderGrid(items) {
        if (!grid) return;
        grid.innerHTML = items.map(item => {
            const statusClass = (item.status || 'unconfigured').toLowerCase();
            return `
                <div class="sa-integration-card" id="card_${item.id}">
                    <div>
                        <div class="sa-integration-header">
                            <div>
                                <h3 class="sa-integration-name">${escapeHtml(item.name)}</h3>
                                <span class="sa-integration-cat">${escapeHtml(item.category)}</span>
                            </div>
                            <span class="sa-status-badge ${statusClass}" id="badge_${item.id}">
                                ${escapeHtml(item.status)}
                            </span>
                        </div>
                        <p class="sa-integration-details" id="desc_${item.id}">
                            ${escapeHtml(item.details)}
                        </p>
                    </div>
                    <div class="sa-integration-footer">
                        <span class="sa-integration-meta">
                            ${item.latency_ms > 0 ? `Latency: ${item.latency_ms}ms` : 'Internal Subsystem'}
                        </span>
                        <button type="button" class="sa-btn-secondary test-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" style="padding: 6px 12px; font-size: 0.8rem;">
                            Test Connection
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const intId = btn.dataset.id;
                const intName = btn.dataset.name;
                await runTest(intId, intName, btn);
            });
        });
    }

    async function runTest(intId, intName, btn) {
        btn.disabled = true;
        btn.innerHTML = 'Testing...';

        try {
            const resp = await fetch(`/api/v1/super-admin/integrations/${intId}/test`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const res = await resp.json();
            showDiagModal(intName, res);
            // Refresh card status
            await loadIntegrations();
        } catch (err) {
            showDiagModal(intName, { status: 'error', message: 'Network error contacting diagnostic endpoint.' });
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Test Connection';
        }
    }

    function showDiagModal(name, res) {
        if (!testModal) return;
        diagModalTitle.textContent = `${name} - Diagnostic Test Result`;
        const isSuccess = res.status === 'success';
        const isWarning = res.status === 'warning';
        const badgeClass = isSuccess ? 'connected' : (isWarning ? 'degraded' : 'disconnected');

        diagModalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <span class="sa-status-badge ${badgeClass}">${res.status.toUpperCase()}</span>
            </div>
            <p style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 16px;">
                ${escapeHtml(res.message)}
            </p>
            ${res.details ? `
                <div style="background: var(--bg-hover); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 0.8rem; overflow-x: auto;">
                    <pre style="margin: 0;">${escapeHtml(JSON.stringify(res.details, null, 2))}</pre>
                </div>
            ` : ''}
        `;
        testModal.classList.add('open');
    }

    if (closeDiagModalBtn && testModal) {
        closeDiagModalBtn.addEventListener('click', () => {
            testModal.classList.remove('open');
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
