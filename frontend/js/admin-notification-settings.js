/**
 * BugBash - Admin Personal Notification Preferences Controller
 * Configures personal notification channels and alert triggers.
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
        loadNotificationPreferences();
    });

    function initEventListeners() {
        const form = document.getElementById('adminNotificationSettingsForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                saveNotificationPreferences();
            });
        }
    }

    async function loadNotificationPreferences() {
        try {
            const res = await fetch('/api/v1/admin/notification-preferences', {
                credentials: 'include',
                headers: getHeaders()
            });

            if (!res.ok) return;
            const data = await res.json();

            setChecked('notifPrefAssessment', data.assessment_updates);
            setChecked('notifPrefCandidate', data.candidate_activity);
            setChecked('notifPrefSubmission', data.submission_updates);
            setChecked('notifPrefResult', data.result_publication);
            setChecked('notifPrefML', data.ml_evaluation_updates);
            setChecked('notifPrefSystem', data.system_announcements);
            setChecked('notifPrefInApp', data.in_app);
            setChecked('notifPrefEmail', data.email);

            // Security alerts always locked to True per platform policy
            const secEl = document.getElementById('notifPrefSecurity');
            if (secEl) {
                secEl.checked = true;
                secEl.disabled = true;
            }
        } catch (e) {
            console.error('Error fetching notification preferences:', e);
        }
    }

    async function saveNotificationPreferences() {
        const payload = {
            assessment_updates: isChecked('notifPrefAssessment'),
            candidate_activity: isChecked('notifPrefCandidate'),
            submission_updates: isChecked('notifPrefSubmission'),
            result_publication: isChecked('notifPrefResult'),
            ml_evaluation_updates: isChecked('notifPrefML'),
            security_alerts: true, // Policy enforced
            system_announcements: isChecked('notifPrefSystem'),
            in_app: isChecked('notifPrefInApp'),
            email: isChecked('notifPrefEmail')
        };

        try {
            const res = await fetch('/api/v1/admin/notification-preferences', {
                method: 'PUT',
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                showToast('Failed to update notification preferences.', 'error');
                return;
            }

            showToast('Notification preferences saved!', 'success');
        } catch (e) {
            console.error('Error saving notification preferences:', e);
            showToast('Network error while saving preferences.', 'error');
        }
    }

    function isChecked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : true;
    }

    function setChecked(id, val) {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    }

    function showToast(msg, type = 'success') {
        let toast = document.getElementById('notifPrefsToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'notifPrefsToast';
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
