/**
 * BugBash Super Admin - Create & Invite Admin Controller
 * Handles administrative form submission, real email validation,
 * single-use cryptographic invitation generation, and success modal presentation.
 */

(function () {
    'use strict';

    const form = document.getElementById('createAdminForm');
    const submitBtn = document.getElementById('createAdminSubmitBtn');
    const successModal = document.getElementById('inviteSuccessModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalDoneBtn = document.getElementById('modalDoneBtn');
    const inviteUrlText = document.getElementById('inviteUrlText');
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    const devOtpVal = document.getElementById('devOtpVal');
    const inviteRecipientText = document.getElementById('inviteRecipientText');
    const alertBox = document.getElementById('formAlert');

    function init() {
        checkSuperAdminAuth();
        bindEvents();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
        }

        const superAdminUser = JSON.parse(localStorage.getItem('bugbash_super_admin_user') || '{}');
        const navName = document.getElementById('superAdminNavName');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        
        if (superAdminUser.name) {
            if (navName) navName.textContent = superAdminUser.name;
            if (sidebarName) sidebarName.textContent = superAdminUser.name;
            if (sidebarAvatar) {
                const initials = superAdminUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                sidebarAvatar.textContent = initials || 'SA';
            }
        }
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function bindEvents() {
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        if (copyUrlBtn && inviteUrlText) {
            copyUrlBtn.addEventListener('click', () => {
                const text = inviteUrlText.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    copyUrlBtn.textContent = 'Copied!';
                    setTimeout(() => { copyUrlBtn.textContent = 'Copy Link'; }, 2000);
                }).catch(err => {
                    console.error('Copy failed:', err);
                });
            });
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }

        if (modalDoneBtn) {
            modalDoneBtn.addEventListener('click', () => {
                window.location.href = '/super-admin/admins';
            });
        }

        // Theme toggle & logout
        const logoutBtn = document.getElementById('saLogoutBtn');
        const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
        [logoutBtn, sidebarLogoutBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    localStorage.removeItem('bugbash_super_admin_token');
                    sessionStorage.removeItem('bugbash_super_admin_token');
                    localStorage.removeItem('bugbash_super_admin_user');
                    window.location.href = '/super-admin/login';
                });
            }
        });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        hideAlert();

        const name = document.getElementById('adminFullName').value.trim();
        const email = document.getElementById('adminEmail').value.trim();
        const phone = document.getElementById('adminPhone').value.trim();
        const role = document.getElementById('adminRole').value;
        const organization_name = document.getElementById('adminOrgName').value.trim();
        const description = document.getElementById('adminDescription').value.trim();

        if (!name || name.length < 2) {
            showAlert('Please provide the administrator\'s full legal name (minimum 2 characters).');
            return;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('Please provide a valid, unique email address for the responsible administrator.');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generating Invitation...';

            const payload = {
                name,
                email,
                phone: phone || null,
                role: role || 'admin',
                organization_name: organization_name || 'BugBash Global Assessment Operations',
                description: description || null
            };

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.SUPER_ADMIN_ADMINS_INVITE) || '/super-admin/admins/invite';

            const res = await fetch(apiBase + endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.status === 409) {
                showAlert(data.detail || `An account with email '${email}' already exists. Duplicate accounts are prohibited.`);
                return;
            }

            if (!res.ok) {
                throw new Error(data.detail || 'Failed to create administrator invitation.');
            }

            // Success: Display Invitation Card
            showSuccessModal(data);
        } catch (err) {
            console.error('Create admin error:', err);
            showAlert(err.message || 'An error occurred while creating the administrator.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create & Send Invitation';
        }
    }

    function showSuccessModal(data) {
        if (!successModal) return;

        const fullUrl = window.location.origin + data.invitation_url;
        if (inviteUrlText) inviteUrlText.textContent = fullUrl;
        if (inviteRecipientText) inviteRecipientText.textContent = `${data.admin.name} (${data.email})`;
        if (devOtpVal) devOtpVal.textContent = data.dev_otp || 'N/A';

        successModal.classList.add('open');
    }

    function closeModal() {
        if (successModal) successModal.classList.remove('open');
    }

    function showAlert(msg) {
        if (!alertBox) return;
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (!alertBox) return;
        alertBox.style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', init);
})();
