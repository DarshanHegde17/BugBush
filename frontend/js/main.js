/**
 * BugBash Main Application Script
 * Handles navigation, mobile drawer, smooth scrolling, active states,
 * and code preview interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initSmoothScroll();
    initScrollSpy();
    initCodePreviewTabs();
    initAuthButtons();
});

/**
 * Mobile Navigation Drawer Toggle
 */
function initMobileNav() {
    const hamburger = document.getElementById('hamburger-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('mobile-backdrop');

    if (!hamburger || !mobileMenu) return;

    function openMenu() {
        hamburger.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
        mobileMenu.classList.add('open');
        if (backdrop) backdrop.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('open');
        if (backdrop) backdrop.classList.remove('visible');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileMenu.classList.contains('open');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    if (backdrop) {
        backdrop.addEventListener('click', closeMenu);
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
            closeMenu();
        }
    });

    // Close mobile menu when a nav link is clicked
    const mobileLinks = mobileMenu.querySelectorAll('a[href^="#"]');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeMenu();
        });
    });
}

/**
 * Smooth Scrolling for Anchor Links with Header Offset
 */
function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    const navbar = document.querySelector('.navbar');
    const navHeight = navbar ? navbar.offsetHeight : 70;

    anchorLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - (navHeight + 20);
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL hash cleanly without instant jump
                history.pushState(null, null, targetId);
            }
        });
    });
}

/**
 * ScrollSpy to Highlight Active Navigation Link
 */
function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    if (!sections.length || !navLinks.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentId = `#${entry.target.getAttribute('id')}`;
                navLinks.forEach(link => {
                    if (link.getAttribute('href') === currentId) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}

/**
 * Interactive Code Preview Tabs in Hero / Demo Section
 */
function initCodePreviewTabs() {
    const tabButtons = document.querySelectorAll('.code-tab-btn');
    const tabSnippets = document.querySelectorAll('.code-snippet');

    if (!tabButtons.length || !tabSnippets.length) return;

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetLang = btn.getAttribute('data-lang');

            tabButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabSnippets.forEach(s => s.classList.remove('active'));

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            const activeSnippet = document.getElementById(`code-snippet-${targetLang}`);
            if (activeSnippet) {
                activeSnippet.classList.add('active');
            }
        });
    });
}

/**
 * Navigation button actions for Login and Sign Up
 */
function initAuthButtons() {
    // Links with data-auth or explicitly pointing to login.html / signup.html
    const loginBtns = document.querySelectorAll('[data-action="login"]');
    const signupBtns = document.querySelectorAll('[data-action="signup"]');

    loginBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName.toLowerCase() !== 'a') {
                e.preventDefault();
                window.location.href = 'login.html';
            }
        });
    });

    signupBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName.toLowerCase() !== 'a') {
                e.preventDefault();
                window.location.href = 'signup.html';
            }
        });
    });
}

