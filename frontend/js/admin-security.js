/**
 * BugBash - Admin Security Settings Controller
 * Handles password complexity enforcement, real-time strength evaluation,
 * active device session revocation, and security audit telemetry.
 */

(function () {
    'use strict';

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
        loadActiveSessions();
        loadSecurityActivity();
    });

    function initEventListeners() {
        // Password visibility toggles
        document.querySelectorAll('.password-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;

                if (input.type === 'password') {
                    input.type = 'text';
                    this.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
                } else {
                    input.type = 'password';
                    this.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                }
            });
        });

        // Real-time password strength & checklist
        const newPassInput = document.getElementById('newAdminPassword');
        if (newPassInput) {
            newPassInput.addEventListener('input', function () {
                evaluatePasswordStrength(this.value);
            });
        }

        // Change password form submission
        const passForm = document.getElementById('changePasswordForm');
        if (passForm) {
            passForm.addEventListener('submit', function (e) {
                e.preventDefault();
                handleChangePassword();
            });
        }

        // Revoke all other sessions button
        const btnRevokeAll = document.getElementById('btnRevokeOtherSessions');
        if (btnRevokeAll) {
            btnRevokeAll.addEventListener('click', handleRevokeOtherSessions);
        }
    }

    function evaluatePasswordStrength(pass) {
        const rules = {
            length: pass.length >= 8,
            uppercase: /[A-Z]/.test(pass),
            lowercase: /[a-z]/.test(pass),
            number: /[0-9]/.test(pass),
            special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pass)
        };

        // Update visual rule checklist
        updateRuleEl('ruleLength', rules.length);
        updateRuleEl('ruleUpper', rules.uppercase);
        updateRuleEl('ruleLower', rules.lowercase);
        updateRuleEl('ruleNumber', rules.number);
        updateRuleEl('ruleSpecial', rules.special);

        // Calculate score 0-5
        const score = Object.values(rules).filter(Boolean).length;
        const bar = document.getElementById('strengthBarSegment');
        const label = document.getElementById('strengthTextLabel');

        if (!bar || !label) return;

        if (pass.length === 0) {
            bar.style.width = '0%';
            bar.style.backgroundColor = 'transparent';
            label.textContent = 'None';
            return;
        }

        switch (score) {
            case 1:
            case 2:
                bar.style.width = '30%';
                bar.style.backgroundColor = 'var(--prof-danger)';
                label.textContent = 'Weak';
                label.style.color = 'var(--prof-danger)';
                break;
            case 3:
                bar.style.width = '60%';
                bar.style.backgroundColor = 'var(--prof-warning)';
                label.textContent = 'Fair';
                label.style.color = 'var(--prof-warning)';
                break;
            case 4:
                bar.style.width = '80%';
                bar.style.backgroundColor = 'var(--prof-info)';
                label.textContent = 'Good';
                label.style.color = 'var(--prof-info)';
                break;
            case 5:
                bar.style.width = '100%';
                bar.style.backgroundColor = 'var(--prof-success)';
                label.textContent = 'Strong';
                label.style.color = 'var(--prof-success)';
                break;
        }
    }

    function updateRuleEl(id, isValid) {
        const el = document.getElementById(id);
        if (!el) return;
        if (isValid) {
            el.classList.add('valid');
        } else {
            el.classList.remove('valid');
        }
    }

    async function handleChangePassword() {
        const currentPass = document.getElementById('currentAdminPassword')?.value;
        const newPass = document.getElementById('newAdminPassword')?.value;
        const confirmPass = document.getElementById('confirmAdminPassword')?.value;
        const revokeOthers = document.getElementById('revokeOthersCheckbox')?.checked || false;

        if (!currentPass || !newPass || !confirmPass) {
            showToast('Please fill in all password fields.', 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/v1/admin/profile/change-password', {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify({
                    current_password: currentPass,
                    new_password: newPass,
                    confirm_password: confirmPass,
                    revoke_other_sessions: revokeOthers
                })
            });

            if (!res.ok) {
                const err = await res.json();
                showToast(err.detail || 'Failed to change password.', 'error');
                return;
            }

            document.getElementById('changePasswordForm').reset();
            evaluatePasswordStrength('');
            showToast('Password changed successfully!', 'success');
            loadActiveSessions();
            loadSecurityActivity();
        } catch (e) {
            console.error('Password change error:', e);
            showToast('Network error while changing password.', 'error');
        }
    }

    async function loadActiveSessions() {
        const container = document.getElementById('activeSessionsList');
        if (!container) return;

        try {
            const res = await fetch('/api/v1/admin/security/sessions', {
                credentials: 'include',
                headers: getHeaders()
            });

            if (!res.ok) return;
            const data = await res.json();
            renderSessions(data.sessions || []);
        } catch (e) {
            console.error('Error fetching sessions:', e);
        }
    }

    function renderSessions(sessions) {
        const container = document.getElementById('activeSessionsList');
        if (!container) return;

        if (sessions.length === 0) {
            container.innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">No active sessions found.</p>`;
            return;
        }

        container.innerHTML = sessions.map(s => {
            const isCurrent = s.is_current === true;
            return `
                <div class="session-card-item">
                    <div class="session-info-left">
                        <div class="session-device-icon">&#128187;</div>
                        <div>
                            <div class="session-title">
                                ${escapeHtml(s.device)} &bull; ${escapeHtml(s.browser)}
                                ${isCurrent ? '<span class="session-current-tag">Current Session</span>' : ''}
                            </div>
                            <div class="session-meta">
                                IP: ${escapeHtml(s.ip_address)} &bull; Location: ${escapeHtml(s.location)} &bull; Login: ${escapeHtml(s.login_time)}
                            </div>
                        </div>
                    </div>
                    <div>
                        ${!isCurrent ? `
                            <button type="button" class="btn-page" onclick="window.revokeSession('${s.session_id}')" style="color:var(--prof-danger); border-color:var(--prof-border);">
                                Revoke Session
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    window.revokeSession = async function (sessionId) {
        if (!confirm('Are you sure you want to revoke this session?')) return;
        try {
            const res = await fetch(`/api/v1/admin/security/sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                showToast('Session revoked successfully.', 'success');
                loadActiveSessions();
            } else {
                showToast('Failed to revoke session.', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Network error revoking session.', 'error');
        }
    };

    async function handleRevokeOtherSessions() {
        if (!confirm('Log out from all other devices and active sessions?')) return;
        try {
            const res = await fetch('/api/v1/admin/security/logout-other-sessions', {
                method: 'POST',
                credentials: 'include',
                headers: getHeaders()
            });
            if (res.ok) {
                showToast('All other sessions revoked.', 'success');
                loadActiveSessions();
            } else {
                showToast('Failed to revoke other sessions.', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Network error revoking sessions.', 'error');
        }
    }

    async function loadSecurityActivity() {
        const feedContainer = document.getElementById('securityFeedContainer');
        const passChangedEl = document.getElementById('passLastChangedDisplay');

        try {
            const res = await fetch('/api/v1/admin/security/activity', {
                credentials: 'include',
                headers: getHeaders()
            });

            if (!res.ok) return;
            const data = await res.json();

            if (passChangedEl) {
                passChangedEl.textContent = data.password_last_changed || 'Recently';
            }

            if (feedContainer) {
                const logs = data.recent_activity || [];
                if (logs.length === 0) {
                    feedContainer.innerHTML = '<p style="font-size:12px; color:var(--text-secondary);">No recent security activity logged.</p>';
                    return;
                }

                feedContainer.innerHTML = logs.slice(0, 8).map(l => `
                    <div class="feed-item">
                        <div>
                            <strong>${escapeHtml(l.description)}</strong>
                            <div style="font-size:11px; color:var(--text-secondary);">IP: ${escapeHtml(l.ip_address)}</div>
                        </div>
                        <span style="font-size:11px; color:var(--text-secondary);">${escapeHtml(l.timestamp)}</span>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Error fetching security activity:', e);
        }
    }

    function showToast(msg, type = 'success') {
        let toast = document.getElementById('securityToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'securityToast';
            toast.className = 'profile-toast';
            document.body.appendChild(toast);
        }

        toast.className = `profile-toast ${type} active`;
        toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;

        setTimeout(() => {
            toast.classList.remove('active');
        }, 3500);
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
