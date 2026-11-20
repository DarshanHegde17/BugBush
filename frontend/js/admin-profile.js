/**
 * BugBash - Enterprise Admin Profile Controller
 * Manages administrator profile loading, profile updates, avatar photo uploads,
 * read-only permission telemetry, and responsive notifications.
 */

(function () {
    'use strict';

    let originalProfileData = null;

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
        loadAdminProfile();
    });

    function initEventListeners() {
        // Profile update form
        const form = document.getElementById('adminProfileForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                saveProfileChanges();
            });
        }

        // Cancel changes button
        const cancelBtn = document.getElementById('btnCancelProfile');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                if (originalProfileData) {
                    populateProfileFields(originalProfileData);
                    showToast('Changes reverted.', 'info');
                }
            });
        }

        // Avatar file upload trigger
        const avatarBtn = document.getElementById('btnUploadAvatar');
        const fileInput = document.getElementById('avatarFileInput');

        if (avatarBtn && fileInput) {
            avatarBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', handleAvatarUpload);
        }
    }

    async function loadAdminProfile() {
        try {
            const res = await fetch('/api/v1/admin/profile', {
                credentials: 'include',
                headers: getHeaders()
            });

            if (!res.ok) {
                showToast('Failed to load administrator profile.', 'error');
                return;
            }

            originalProfileData = await res.json();
            populateProfileFields(originalProfileData);
        } catch (e) {
            console.error('Error fetching admin profile:', e);
            showToast('Network error loading profile.', 'error');
        }
    }

    function populateProfileFields(data) {
        // Hero section
        const nameEl = document.getElementById('heroAdminName');
        const roleEl = document.getElementById('heroAdminRole');
        const statusEl = document.getElementById('heroAdminStatus');
        const orgEl = document.getElementById('heroAdminOrg');
        const avatarEl = document.getElementById('heroAdminAvatar');

        if (nameEl) nameEl.textContent = data.full_name || 'Administrator';
        if (roleEl) roleEl.textContent = (data.role || 'Admin').toUpperCase();
        if (statusEl) statusEl.textContent = data.account_status || 'Active';
        if (orgEl) orgEl.textContent = data.organization_name || 'BugBash Global Operations';

        // Set Avatar or Initials
        if (avatarEl) {
            if (data.profile_picture) {
                avatarEl.innerHTML = `<img src="${escapeHtml(data.profile_picture)}" alt="Admin Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                const initials = (data.full_name || 'Admin').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                avatarEl.textContent = initials;
            }
        }

        // Form Inputs (Editable)
        const nameInput = document.getElementById('adminFullName');
        const phoneInput = document.getElementById('adminPhoneNumber');
        const bioInput = document.getElementById('adminBio');

        if (nameInput) nameInput.value = data.full_name || '';
        if (phoneInput) phoneInput.value = data.phone_number || '';
        if (bioInput) bioInput.value = data.bio || '';

        // Read-only Details
        setTxt('adminIdDisplay', data.id || 'usr_admin_01');
        setTxt('adminEmailDisplay', data.email || '');
        setTxt('adminCreatedAtDisplay', data.created_at || 'Jan 10, 2026');
        setTxt('adminLastLoginDisplay', data.last_login || 'Just now');
        setTxt('adminLastPasswordChangeDisplay', data.last_password_change || 'Jan 10, 2026');

        // Permissions Chips
        const permContainer = document.getElementById('adminPermissionsContainer');
        if (permContainer) {
            const perms = data.permissions || [];
            permContainer.innerHTML = perms.map(p => `<span class="perm-chip">${escapeHtml(p)}</span>`).join('');
        }
    }

    async function saveProfileChanges() {
        const fullName = document.getElementById('adminFullName')?.value.trim();
        const phoneNumber = document.getElementById('adminPhoneNumber')?.value.trim();
        const bio = document.getElementById('adminBio')?.value.trim();

        if (!fullName) {
            showToast('Full name is required.', 'error');
            return;
        }

        const payload = {
            full_name: fullName,
            phone_number: phoneNumber,
            bio: bio
        };

        try {
            const res = await fetch('/api/v1/admin/profile', {
                method: 'PUT',
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                showToast(err.detail || 'Failed to update profile.', 'error');
                return;
            }

            const updated = await res.json();
            originalProfileData = updated;
            populateProfileFields(updated);
            showToast('Profile updated successfully!', 'success');
        } catch (e) {
            console.error('Error saving profile changes:', e);
            showToast('Network error while saving profile.', 'error');
        }
    }

    async function handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Size check (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image size exceeds the 2MB limit.', 'error');
            return;
        }

        // Type check
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (PNG, JPG, WEBP).', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function (evt) {
            const base64Data = evt.target.result;

            try {
                const res = await fetch('/api/v1/admin/profile/photo', {
                    method: 'POST',
                    credentials: 'include',
                    headers: getHeaders(),
                    body: JSON.stringify({ photo_data: base64Data })
                });

                if (!res.ok) {
                    showToast('Failed to upload profile picture.', 'error');
                    return;
                }

                const data = await res.json();
                const avatarEl = document.getElementById('heroAdminAvatar');
                if (avatarEl) {
                    avatarEl.innerHTML = `<img src="${base64Data}" alt="Admin Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                }
                showToast('Profile photo updated successfully!', 'success');
            } catch (err) {
                console.error('Error uploading avatar:', err);
                showToast('Network error uploading avatar.', 'error');
            }
        };

        reader.readAsDataURL(file);
    }

    function setTxt(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function showToast(msg, type = 'success') {
        let toast = document.getElementById('profileToastNotification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'profileToastNotification';
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
