/**
 * ==============================================================================
 * BugBash - Candidate Profile Controller
 * ==============================================================================
 * Connects frontend profile interface with FastAPI backend:
 * - GET  /api/v1/users/me
 * - PUT  /api/v1/users/me/profile
 * - POST /api/v1/users/me/profile-picture
 * Handles avatar image upload (with preview & base64 encoding),
 * form validation, responsive theme integration, and live updates.
 */

(function () {
    'use strict';

    // Base API URL configuration
    const API_BASE = (window.BugBashConfig && window.BugBashConfig.API_BASE_URL)
        || (window.location.origin + '/api/v1');

    // DOM Elements
    const elements = {
        // Identity Summary
        largeAvatar: document.getElementById('profileLargeAvatar'),
        cardFullName: document.getElementById('profileCardFullName'),
        cardRole: document.getElementById('profileCardRole'),
        cardBio: document.getElementById('profileCardBio'),
        cardCollege: document.getElementById('profileCardCollege'),
        infoEmail: document.getElementById('infoEmail'),
        infoPhone: document.getElementById('infoPhone'),
        infoCreatedAt: document.getElementById('infoCreatedAt'),
        infoStatus: document.getElementById('infoStatus'),
        infoVerification: document.getElementById('infoVerification'),
        
        // Avatar Upload
        avatarInput: document.getElementById('avatarFileInput'),
        avatarUploadBtn: document.getElementById('avatarUploadBtn'),

        // Form Fields
        form: document.getElementById('updateProfileForm'),
        inputFullName: document.getElementById('profileFullName'),
        inputEmail: document.getElementById('profileEmail'),
        inputPhone: document.getElementById('profilePhone'),
        inputBio: document.getElementById('profileBio'),
        inputCollege: document.getElementById('profileCollege'),
        inputDegree: document.getElementById('profileDegree'),
        inputGradYear: document.getElementById('profileGradYear'),
        btnSave: document.getElementById('btnSaveProfile'),

        // Topbar
        topbarName: document.getElementById('topbarUserName'),
        topbarAvatar: document.getElementById('topbarUserAvatar'),
        logoutBtn: document.getElementById('sidebarLogoutBtn'),
        sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
        sidebar: document.getElementById('sidebar'),
        toastContainer: document.getElementById('toastContainer')
    };

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
        let container = elements.toastContainer;
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
            elements.toastContainer = container;
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
     * Update avatar display with image URL or fallback monogram
     */
    function renderAvatar(avatarUrl, fullName) {
        const initials = getInitials(fullName);
        if (elements.largeAvatar) {
            if (avatarUrl && avatarUrl.startsWith('data:image') || (avatarUrl && avatarUrl.startsWith('http'))) {
                elements.largeAvatar.innerHTML = `<img src="${avatarUrl}" alt="${fullName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                elements.largeAvatar.textContent = initials;
            }
        }

        if (elements.topbarAvatar) {
            if (avatarUrl && (avatarUrl.startsWith('data:image') || avatarUrl.startsWith('http'))) {
                elements.topbarAvatar.innerHTML = `<img src="${avatarUrl}" alt="${fullName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                elements.topbarAvatar.textContent = initials;
            }
        }
    }

    /**
     * Fetch user profile from FastAPI backend
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

            if (!resp.ok) {
                throw new Error('Failed to retrieve profile data.');
            }

            const profile = await resp.json();
            populateProfileUI(profile);

        } catch (err) {
            console.error('Error fetching profile:', err);
            showToast('Unable to load profile data from server.', 'error');
        }
    }

    /**
     * Populate profile interface with backend data
     */
    function populateProfileUI(data) {
        const fullName = data.full_name || 'Candidate';
        
        // Summary Card
        if (elements.cardFullName) elements.cardFullName.textContent = fullName;
        if (elements.topbarName) elements.topbarName.textContent = fullName.split(' ')[0];
        if (elements.cardRole) elements.cardRole.textContent = data.role ? (data.role.charAt(0).toUpperCase() + data.role.slice(1)) : 'Candidate';
        if (elements.cardBio) elements.cardBio.textContent = data.bio || 'BugBash candidate preparing for coding assessments.';
        if (elements.cardCollege) elements.cardCollege.textContent = data.college_name || 'BugBash Academy';

        if (elements.infoEmail) elements.infoEmail.textContent = data.email || '—';
        if (elements.infoPhone) elements.infoPhone.textContent = data.phone_number || 'Not provided';
        if (elements.infoCreatedAt) elements.infoCreatedAt.textContent = data.created_at || 'Recently';

        // Verification & Account Status
        if (elements.infoStatus) {
            elements.infoStatus.textContent = data.account_status || 'Active';
            elements.infoStatus.className = 'status-indicator-pill active';
            if (data.account_status === 'Deletion Pending') {
                elements.infoStatus.className = 'status-indicator-pill pending';
            }
        }

        if (elements.infoVerification) {
            elements.infoVerification.textContent = data.is_verified ? 'Verified Email' : 'Pending Verification';
            elements.infoVerification.className = data.is_verified ? 'status-indicator-pill verified' : 'status-indicator-pill pending';
        }

        // Render Avatar
        renderAvatar(data.avatar_url, fullName);

        // Populate Form Fields
        if (elements.inputFullName) elements.inputFullName.value = data.full_name || '';
        if (elements.inputEmail) elements.inputEmail.value = data.email || '';
        if (elements.inputPhone) elements.inputPhone.value = data.phone_number || '';
        if (elements.inputBio) elements.inputBio.value = data.bio || '';
        if (elements.inputCollege) elements.inputCollege.value = data.college_name || '';
        if (elements.inputDegree) elements.inputDegree.value = data.degree_major || '';
        if (elements.inputGradYear) elements.inputGradYear.value = data.graduation_year || '2026';
    }

    /**
     * Handle Avatar File Selection & Upload
     */
    async function handleAvatarUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        // Size check (max 2.5 MB)
        if (file.size > 2.5 * 1024 * 1024) {
            showToast('Image size exceeds 2.5MB. Please choose a smaller picture.', 'error');
            return;
        }

        // Type check
        if (!file.type.match(/image\/(png|jpeg|jpg|webp)/i)) {
            showToast('Please select a PNG, JPG, or WebP image.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function (e) {
            const base64Data = e.target.result;
            
            // Immediate optimistic UI preview
            renderAvatar(base64Data, elements.inputFullName ? elements.inputFullName.value : 'User');

            // Send to FastAPI backend
            const token = getAuthToken();
            try {
                showToast('Uploading profile picture...', 'info', 2000);
                const resp = await fetch(`${API_BASE}/users/me/profile-picture`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ avatar_data: base64Data })
                });

                if (!resp.ok) {
                    const err = await resp.json();
                    throw new Error(err.detail || 'Upload failed.');
                }

                showToast('Profile picture updated successfully!', 'success');
            } catch (err) {
                console.error('Error uploading avatar:', err);
                showToast(err.message || 'Failed to save avatar.', 'error');
                loadUserProfile(); // Revert on failure
            }
        };

        reader.readAsDataURL(file);
    }

    /**
     * Handle Profile Information Form Submission
     */
    async function handleProfileSubmit(e) {
        e.preventDefault();
        const token = getAuthToken();
        if (!token) return;

        const fullName = elements.inputFullName.value.trim();
        const phone = elements.inputPhone.value.trim();
        const bio = elements.inputBio ? elements.inputBio.value.trim() : '';
        const college = elements.inputCollege ? elements.inputCollege.value.trim() : '';
        const degree = elements.inputDegree ? elements.inputDegree.value.trim() : '';
        const gradYear = elements.inputGradYear ? elements.inputGradYear.value.trim() : '';

        // Validation
        if (fullName.length < 2) {
            showToast('Full name must be at least 2 characters long.', 'error');
            elements.inputFullName.focus();
            return;
        }

        const phoneRegex = /^[+]?[\d\s\-()]{7,25}$/;
        if (!phoneRegex.test(phone)) {
            showToast('Please enter a valid phone number (min 7 digits).', 'error');
            elements.inputPhone.focus();
            return;
        }

        // Set Loading state
        const originalBtnText = elements.btnSave.innerHTML;
        elements.btnSave.disabled = true;
        elements.btnSave.innerHTML = `
            <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            <span>Saving Changes...</span>
        `;

        try {
            const resp = await fetch(`${API_BASE}/users/me/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    full_name: fullName,
                    phone_number: phone,
                    bio: bio,
                    college_name: college,
                    degree_major: degree,
                    graduation_year: gradYear
                })
            });

            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.detail || 'Unable to update profile.');
            }

            const updatedProfile = await resp.json();
            populateProfileUI(updatedProfile);
            showToast('Profile information successfully saved!', 'success');

        } catch (err) {
            console.error('Error updating profile:', err);
            showToast(err.message || 'Profile update failed. Please try again.', 'error');
        } finally {
            elements.btnSave.disabled = false;
            elements.btnSave.innerHTML = originalBtnText;
        }
    }

    /**
     * Wire Event Listeners & Initialize
     */
    function init() {
        // Form Submit
        if (elements.form) {
            elements.form.addEventListener('submit', handleProfileSubmit);
        }

        // Avatar input trigger
        if (elements.avatarInput) {
            elements.avatarInput.addEventListener('change', handleAvatarUpload);
        }

        // Sidebar Toggle
        if (elements.sidebarToggleBtn && elements.sidebar) {
            elements.sidebarToggleBtn.addEventListener('click', () => {
                elements.sidebar.classList.toggle('collapsed');
            });
        }

        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('bugbash_auth_token');
                sessionStorage.removeItem('bugbash_auth_token');
                window.location.href = '../login.html';
            });
        }

        // Load profile data
        loadUserProfile();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
