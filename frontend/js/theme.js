/**
 * BugBash Theme Manager
 * Supports Light & Dark themes with localStorage persistence and system preference detection.
 */
(function () {
    const THEME_STORAGE_KEY = 'bugbash-theme';
    const THEME_DARK = 'dark';
    const THEME_LIGHT = 'light';

    // Get current theme from storage or system preference
    function getPreferredTheme() {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === THEME_DARK || stored === THEME_LIGHT) {
            return stored;
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
            ? THEME_LIGHT
            : THEME_DARK;
    }

    // Apply theme to document root
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeToggleUI(theme);
    }

    // Update toggle buttons across desktop and mobile
    function updateThemeToggleUI(theme) {
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            const isDark = theme === THEME_DARK;
            toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            toggle.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            
            const sunIcon = toggle.querySelector('.icon-sun');
            const moonIcon = toggle.querySelector('.icon-moon');
            const themeText = toggle.querySelector('.theme-text');
            
            if (sunIcon && moonIcon) {
                if (isDark) {
                    sunIcon.style.display = 'block';
                    moonIcon.style.display = 'none';
                } else {
                    sunIcon.style.display = 'none';
                    moonIcon.style.display = 'block';
                }
            }
            if (themeText) {
                themeText.textContent = isDark ? 'Light' : 'Dark';
            }
        });
    }

    // Toggle between light and dark
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || THEME_DARK;
        const nextTheme = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
    }

    // Initialize immediately to prevent flash of wrong theme
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    // Attach event listeners after DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        updateThemeToggleUI(document.documentElement.getAttribute('data-theme') || initialTheme);

        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                toggleTheme();
            });
        });

        // Listen for OS theme changes if user hasn't set an explicit preference
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                    applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
                }
            });
        }
    });

    // Expose toggle globally for direct usage if needed
    window.BugBashTheme = {
        toggle: toggleTheme,
        getTheme: () => document.documentElement.getAttribute('data-theme'),
        setTheme: (t) => {
            localStorage.setItem(THEME_STORAGE_KEY, t);
            applyTheme(t);
        }
    };
})();

