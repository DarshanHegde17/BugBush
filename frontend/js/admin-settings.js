/**
 * BugBash - Admin Preferences & Regional Settings Controller
 * Manages theme selection (Dark/Light/System), language, timezone,
 * date presentation format, default views, and page sizes.
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
        loadPreferences();
    });

    function initEventListeners() {
        // Theme radio cards live preview
        const themeRadios = document.querySelectorAll('input[name="prefTheme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                applyLiveTheme(this.value);
            });
        });

        // Form submit
        const form = document.getElementById('adminSettingsForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                savePreferences();
            });
        }
    }

    function applyLiveTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('bugbash_theme', theme);
    }

    async function loadPreferences() {
        try {
            const res = await fetch('/api/v1/admin/preferences', {
                credentials: 'include',
                headers: getHeaders()
            });

            if (!res.ok) return;
            const data = await res.json();

            // Set Theme radio
            const themeRadio = document.querySelector(`input[name="prefTheme"][value="${data.theme || 'dark'}"]`);
            if (themeRadio) {
                themeRadio.checked = true;
                applyLiveTheme(data.theme);
            }

            // Set Dropdowns
            setVal('prefLanguage', data.language || 'en');
            setVal('prefTimezone', data.timezone || 'UTC');
            setVal('prefDateFormat', data.date_format || 'MMM DD, YYYY');
            setVal('prefDefaultView', data.default_view || 'overview');
            setVal('prefPageSize', data.table_page_size || 20);
        } catch (e) {
            console.error('Error fetching admin preferences:', e);
        }
    }

    async function savePreferences() {
        const themeRadio = document.querySelector('input[name="prefTheme"]:checked');
        const theme = themeRadio ? themeRadio.value : 'dark';
        const language = document.getElementById('prefLanguage')?.value || 'en';
        const timezone = document.getElementById('prefTimezone')?.value || 'UTC';
        const dateFormat = document.getElementById('prefDateFormat')?.value || 'MMM DD, YYYY';
        const defaultView = document.getElementById('prefDefaultView')?.value || 'overview';
        const pageSize = parseInt(document.getElementById('prefPageSize')?.value || '20', 10);

        const payload = {
            theme: theme,
            language: language,
            timezone: timezone,
            date_format: dateFormat,
            default_view: defaultView,
            table_page_size: pageSize
        };

        try {
            const res = await fetch('/api/v1/admin/preferences', {
                method: 'PUT',
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                showToast('Failed to save preferences.', 'error');
                return;
            }

            applyLiveTheme(theme);
            showToast('Preferences saved successfully!', 'success');
        } catch (e) {
            console.error('Error saving admin preferences:', e);
            showToast('Network error while saving preferences.', 'error');
        }
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    function showToast(msg, type = 'success') {
        let toast = document.getElementById('settingsToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'settingsToast';
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
