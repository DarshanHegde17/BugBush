/**
 * ==============================================================================
 * BugBash - Candidate Settings Controller
 * ==============================================================================
 * Connects frontend settings interface with FastAPI backend:
 * - POST /api/v1/users/me/change-password
 * - GET  /api/v1/users/me/preferences
 * - PUT  /api/v1/users/me/preferences
 * - GET  /api/v1/users/me/sessions
 * - POST /api/v1/users/me/logout-other-sessions
 * - GET  /api/v1/users/me/download-data
 * - POST /api/v1/users/me/account-deletion-request
 * Handles password entropy meter, active session management, appearance/theme
 * synchronization, notification policies, and account deletion confirmation.
 */

(function () {
    'use strict';

    // Base API URL configuration
    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    /**
     * Retrieves stored auth token from localStorage or sessionStorage
     */
    function getAuthToken() {
        return localStorage.getItem('bugbash_auth_token') ||
               sessionStorage.getItem('bugbash_auth_token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('token');
    }

    /**
     * Shows a feedback toast notification
     */
    function showToast(message, type = 'info', duration = 4000) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        } else {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                ${iconSvg}
                <div class="toast-content" style="font-size:13px; font-weight:600; color:var(--text-primary);">${message}</div>
            </div>
            <button type="button" class="toast-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">&times;</button>
        `;

        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Compute Monogram Initials from full name
     */
    function getInitials(name) {
        if (!name) return 'CA';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Fetch user profile for topbar and header initialization
     */
    async function loadUserProfile() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = '../login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return;
        }

        try {
            const resp = await fetch(`${API_BASE}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (resp.status === 401) {
                localStorage.removeItem('bugbash_auth_token');
                window.location.href = '../login.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }

            if (!resp.ok) return;

            const profile = await resp.json();
            const topbarName = document.getElementById('topbarUserName');
            const topbarAvatar = document.getElementById('topbarUserAvatar');
            if (topbarName) topbarName.textContent = (profile.full_name || 'Candidate').split(' ')[0];
            if (topbarAvatar) {
                if (profile.avatar_url) {
                    topbarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                } else {
                    topbarAvatar.textContent = getInitials(profile.full_name);
                }
            }

            if (profile.account_status === 'Deletion Pending') {
                const banner = document.getElementById('deletionPendingBanner');
                if (banner) banner.style.display = 'block';
            }

        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    }

    /**
     * Setup Tab Navigation
     */
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.settings-tab-btn');
        const panels = document.querySelectorAll('.settings-panel');

        function activateTab(tabId) {
            tabButtons.forEach(btn => {
                if (btn.getAttribute('data-tab') === tabId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            panels.forEach(p => {
                if (p.id === tabId) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });

            window.location.hash = tabId.replace('panel-', '');
        }

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                activateTab(target);
            });
        });

        // Check hash on load
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            const panel = document.getElementById(`panel-${hash}`);
            if (panel) {
                activateTab(`panel-${hash}`);
            }
        }
    }

    /**
     * Setup Show/Hide Password toggles
     */
    function setupPasswordToggles() {
        document.querySelectorAll('.toggle-password-visibility').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;

                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
                } else {
                    input.type = 'password';
                    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                }
            });
        });
    }

    /**
     * Dynamic Password Strength & Criteria Meter
     */
    function setupPasswordStrength() {
        const newPasswordInput = document.getElementById('newPassword');
        const meterBar = document.getElementById('passwordMeterBar');

        const criteriaLength = document.getElementById('critLength');
        const criteriaUpper = document.getElementById('critUpper');
        const criteriaLower = document.getElementById('critLower');
        const criteriaNumber = document.getElementById('critNumber');
        const criteriaSpecial = document.getElementById('critSpecial');

        if (!newPasswordInput || !meterBar) return;

        newPasswordInput.addEventListener('input', () => {
            const val = newPasswordInput.value;
            let score = 0;

            const hasLength = val.length >= 8;
            const hasUpper = /[A-Z]/.test(val);
            const hasLower = /[a-z]/.test(val);
            const hasNumber = /\d/.test(val);
            const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val);

            function updateCriteriaUI(el, isMet) {
                if (!el) return;
                if (isMet) {
                    el.classList.add('met');
                    el.querySelector('svg').innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
                } else {
                    el.classList.remove('met');
                    el.querySelector('svg').innerHTML = `<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>`;
                }
            }

            updateCriteriaUI(criteriaLength, hasLength);
            updateCriteriaUI(criteriaUpper, hasUpper);
            updateCriteriaUI(criteriaLower, hasLower);
            updateCriteriaUI(criteriaNumber, hasNumber);
            updateCriteriaUI(criteriaSpecial, hasSpecial);

            if (hasLength) score++;
            if (hasUpper) score++;
            if (hasLower) score++;
            if (hasNumber) score++;
            if (hasSpecial) score++;

            meterBar.className = 'password-meter-bar';
            if (val.length === 0) {
                meterBar.style.width = '0%';
            } else if (score <= 2) {
                meterBar.classList.add('weak');
            } else if (score === 3) {
                meterBar.classList.add('fair');
            } else if (score === 4) {
                meterBar.classList.add('good');
            } else if (score === 5) {
                meterBar.classList.add('strong');
            }
        });
    }

    /**
     * Change Password Handler
     */
    function setupChangePasswordForm() {
        const form = document.getElementById('changePasswordForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = getAuthToken();
            if (!token) return;

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmPassword) {
                showToast('New password and confirmation do not match.', 'error');
                return;
            }

            if (newPassword.length < 8) {
                showToast('Password must be at least 8 characters.', 'error');
                return;
            }

            const btn = document.getElementById('btnSubmitPasswordChange');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span>Updating Password...</span>`;

            try {
                const resp = await fetch(`${API_BASE}/users/me/change-password`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });

                const data = await resp.json();
                if (!resp.ok) {
                    throw new Error(data.detail || 'Password update failed.');
                }

                showToast('Password changed successfully! Keep your credentials safe.', 'success');
                form.reset();
                const meterBar = document.getElementById('passwordMeterBar');
                if (meterBar) meterBar.className = 'password-meter-bar';

            } catch (err) {
                console.error('Password change error:', err);
                showToast(err.message || 'Unable to update password.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        });
    }

    /**
     * Active Sessions Management
     */
    async function loadSessions() {
        const token = getAuthToken();
        if (!token) return;

        const container = document.getElementById('sessionsListContainer');
        if (!container) return;

        try {
            const resp = await fetch(`${API_BASE}/users/me/sessions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!resp.ok) return;

            const data = await resp.json();
            const sessions = data.sessions || [];

            container.innerHTML = sessions.map(s => `
                <div class="session-item-card">
                    <div class="session-device-info">
                        <div class="session-device-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                            </svg>
                        </div>
                        <div>
                            <div class="session-title">
                                <span>${s.device} &bull; ${s.browser}</span>
                                ${s.is_current ? '<span class="session-badge-current">Current Session</span>' : ''}
                            </div>
                            <div class="session-subtext">
                                IP: ${s.ip_address} &bull; ${s.location} &bull; ${s.last_active}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error fetching sessions:', err);
        }
    }

    function setupLogoutOtherSessions() {
        const btn = document.getElementById('btnLogoutOtherSessions');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const token = getAuthToken();
            if (!token) return;

            if (!confirm('Are you sure you want to sign out all other devices and active browser sessions?')) {
                return;
            }

            try {
                const resp = await fetch(`${API_BASE}/users/me/logout-other-sessions`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (resp.ok) {
                    showToast('Successfully logged out of all other sessions.', 'success');
                    loadSessions();
                } else {
                    const err = await resp.json();
                    showToast(err.detail || 'Failed to logout other sessions.', 'error');
                }
            } catch (err) {
                showToast('Network error while revoking sessions.', 'error');
            }
        });
    }

    /**
     * User Preferences (Appearance, Notifications, Learning)
     */
    async function loadPreferences() {
        const token = getAuthToken();
        if (!token) return;

        try {
            const resp = await fetch(`${API_BASE}/users/me/preferences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!resp.ok) return;

            const prefs = await resp.json();
            populatePreferencesUI(prefs);

        } catch (err) {
            console.error('Error loading preferences:', err);
        }
    }

    function populatePreferencesUI(prefs) {
        // 1. Appearance
        const theme = prefs.appearance?.theme || 'dark';
        document.querySelectorAll('.theme-card-option').forEach(card => {
            if (card.getAttribute('data-theme-val') === theme) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const fontSelect = document.getElementById('prefFontSize');
        if (fontSelect && prefs.appearance?.font_size) {
            fontSelect.value = prefs.appearance.font_size;
        }

        const contrastToggle = document.getElementById('prefHighContrast');
        if (contrastToggle) {
            contrastToggle.checked = !!prefs.appearance?.high_contrast;
        }

        // 2. Notifications
        const n = prefs.notifications || {};
        if (document.getElementById('notifAssessment')) document.getElementById('notifAssessment').checked = n.assessment_notifications !== false;
        if (document.getElementById('notifDeadline')) document.getElementById('notifDeadline').checked = n.deadline_reminders !== false;
        if (document.getElementById('notifResults')) document.getElementById('notifResults').checked = n.result_notifications !== false;
        if (document.getElementById('notifPractice')) document.getElementById('notifPractice').checked = n.practice_recommendations !== false;
        // Security alerts are always ON
        const secAlert = document.getElementById('notifSecurity');
        if (secAlert) {
            secAlert.checked = true;
            secAlert.disabled = true;
        }

        // 3. Learning
        const l = prefs.learning || {};
        const langs = l.preferred_languages || ['Python', 'JavaScript'];
        document.querySelectorAll('.lang-chip').forEach(chip => {
            if (langs.includes(chip.getAttribute('data-lang'))) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        const diffSelect = document.getElementById('prefDifficulty');
        if (diffSelect && l.preferred_difficulty) {
            diffSelect.value = l.preferred_difficulty;
        }
    }

    async function saveCurrentPreferences(showMessage = true) {
        const token = getAuthToken();
        if (!token) return;

        // Gather theme
        const activeThemeCard = document.querySelector('.theme-card-option.active');
        const theme = activeThemeCard ? activeThemeCard.getAttribute('data-theme-val') : 'dark';
        const fontSize = document.getElementById('prefFontSize')?.value || 'medium';
        const highContrast = document.getElementById('prefHighContrast')?.checked || false;

        // Gather Notifications
        const assessmentNotif = document.getElementById('notifAssessment')?.checked ?? true;
        const deadlineReminders = document.getElementById('notifDeadline')?.checked ?? true;
        const resultNotif = document.getElementById('notifResults')?.checked ?? true;
        const practiceNotif = document.getElementById('notifPractice')?.checked ?? true;

        // Gather Learning
        const selectedLangs = Array.from(document.querySelectorAll('.lang-chip.active')).map(c => c.getAttribute('data-lang'));
        const difficulty = document.getElementById('prefDifficulty')?.value || 'Medium';

        const payload = {
            appearance: {
                theme: theme,
                font_size: fontSize,
                high_contrast: highContrast
            },
            notifications: {
                assessment_notifications: assessmentNotif,
                deadline_reminders: deadlineReminders,
                result_notifications: resultNotif,
                practice_recommendations: practiceNotif,
                security_alerts: true
            },
            learning: {
                preferred_languages: selectedLangs,
                preferred_difficulty: difficulty,
                learning_interests: ["Data Structures", "Algorithms", "System Design"],
                practice_topics: ["Dynamic Programming", "Sliding Window", "Graph Algorithms"]
            }
        };

        try {
            const resp = await fetch(`${API_BASE}/users/me/preferences`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                throw new Error('Failed to update preferences.');
            }

            if (showMessage) {
                showToast('Preferences successfully saved!', 'success');
            }
        } catch (err) {
            console.error('Error saving preferences:', err);
            if (showMessage) {
                showToast('Failed to save preferences.', 'error');
            }
        }
    }

    function setupPreferencesListeners() {
        // Theme selection cards
        document.querySelectorAll('.theme-card-option').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.theme-card-option').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                const themeVal = card.getAttribute('data-theme-val');
                
                // Live theme switch
                if (window.BugBashTheme && typeof window.BugBashTheme.setTheme === 'function') {
                    window.BugBashTheme.setTheme(themeVal === 'system' ? 'dark' : themeVal);
                } else {
                    document.documentElement.setAttribute('data-theme', themeVal === 'system' ? 'dark' : themeVal);
                }

                saveCurrentPreferences(false);
                showToast(`Theme updated to ${themeVal.charAt(0).toUpperCase() + themeVal.slice(1)}!`, 'info', 2000);
            });
        });

        // Language chips toggle
        document.querySelectorAll('.lang-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
            });
        });

        // Save buttons for preferences tabs
        const btnSaveNotif = document.getElementById('btnSaveNotifications');
        if (btnSaveNotif) {
            btnSaveNotif.addEventListener('click', () => saveCurrentPreferences(true));
        }

        const btnSaveLearn = document.getElementById('btnSaveLearning');
        if (btnSaveLearn) {
            btnSaveLearn.addEventListener('click', () => saveCurrentPreferences(true));
        }

        const btnSaveAppear = document.getElementById('btnSaveAppearance');
        if (btnSaveAppear) {
            btnSaveAppear.addEventListener('click', () => saveCurrentPreferences(true));
        }
    }

    /**
     * Account Management: Data Export & Account Deletion
     */
    function setupAccountManagement() {
        // Download Personal Data
        const btnDownload = document.getElementById('btnDownloadData');
        if (btnDownload) {
            btnDownload.addEventListener('click', async () => {
                const token = getAuthToken();
                if (!token) return;

                showToast('Preparing your personal data archive...', 'info', 2000);

                try {
                    const resp = await fetch(`${API_BASE}/users/me/download-data`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!resp.ok) throw new Error('Data export failed.');

                    const data = await resp.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bugbash_personal_data_${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);

                    showToast('Personal data downloaded successfully!', 'success');
                } catch (err) {
                    console.error('Data download error:', err);
                    showToast('Failed to export personal data.', 'error');
                }
            });
        }

        // Account Deletion Modal Handling
        const deleteModal = document.getElementById('deleteAccountModal');
        const btnOpenModal = document.getElementById('btnOpenDeleteModal');
        const btnCloseModal = document.getElementById('btnCloseDeleteModal');
        const btnCancelModal = document.getElementById('btnCancelDelete');
        const deleteForm = document.getElementById('deleteAccountForm');

        if (btnOpenModal && deleteModal) {
            btnOpenModal.addEventListener('click', () => {
                deleteModal.classList.add('open');
            });
        }

        function closeModal() {
            if (deleteModal) deleteModal.classList.remove('open');
        }

        if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
        if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

        if (deleteForm) {
            deleteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const token = getAuthToken();
                if (!token) return;

                const phrase = document.getElementById('deleteConfirmPhrase').value.trim();
                const password = document.getElementById('deletePassword').value;
                const reason = document.getElementById('deleteReason').value;

                if (phrase !== 'DELETE MY ACCOUNT') {
                    showToast('Confirmation phrase mismatch. Please type exactly "DELETE MY ACCOUNT".', 'error');
                    return;
                }

                const btnSubmit = document.getElementById('btnSubmitAccountDeletion');
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span>Processing Request...</span>`;

                try {
                    const resp = await fetch(`${API_BASE}/users/me/account-deletion-request`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            confirm_password: password,
                            reason: reason,
                            confirmation_phrase: phrase
                        })
                    });

                    const data = await resp.json();
                    if (!resp.ok) {
                        throw new Error(data.detail || 'Account deletion request failed.');
                    }

                    closeModal();
                    showToast('Account deletion request submitted. Your account is flagged for review.', 'info', 6000);
                    
                    const banner = document.getElementById('deletionPendingBanner');
                    if (banner) banner.style.display = 'block';

                } catch (err) {
                    console.error('Deletion error:', err);
                    showToast(err.message || 'Deletion failed. Please verify your password.', 'error');
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = `<span>Confirm Account Deletion</span>`;
                }
            });
        }
    }

    /**
     * Initialize Settings Controller
     */
    function init() {
        // Sidebar Toggle
        const sidebarToggle = document.getElementById('sidebarToggleBtn');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('bugbash_auth_token');
                sessionStorage.removeItem('bugbash_auth_token');
                window.location.href = '../login.html';
            });
        }

        loadUserProfile();
        setupTabs();
        setupPasswordToggles();
        setupPasswordStrength();
        setupChangePasswordForm();
        loadSessions();
        setupLogoutOtherSessions();
        loadPreferences();
        setupPreferencesListeners();
        setupAccountManagement();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
