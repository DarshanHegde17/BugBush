/**
 * BugBash Super Admin - Edit Administrator Controller
 * Strictly allows editing profile details (name, phone, organization, description)
 * while keeping email, role, and password immutable.
 */

(function () {
    'use strict';

    let adminId = '';

    const elements = {
        form: document.getElementById('editAdminForm'),
        nameInput: document.getElementById('editAdminName'),
        emailInput: document.getElementById('editAdminEmail'),
        roleInput: document.getElementById('editAdminRole'),
        phoneInput: document.getElementById('editAdminPhone'),
        orgInput: document.getElementById('editAdminOrg'),
        descInput: document.getElementById('editAdminDesc'),
        submitBtn: document.getElementById('editAdminSubmitBtn'),
        alertBox: document.getElementById('editAdminAlert'),
        cancelBtn: document.getElementById('editAdminCancelBtn')
    };

    function init() {
        checkSuperAdminAuth();

        const urlParams = new URLSearchParams(window.location.search);
        adminId = urlParams.get('id');

        if (!adminId) {
            window.location.href = '/super-admin/admins';
            return;
        }

        bindEvents();
        loadAdminData();
    }

    function checkSuperAdminAuth() {
        const token = localStorage.getItem('bugbash_super_admin_token') || sessionStorage.getItem('bugbash_super_admin_token');
        if (!token) {
            window.location.href = '/super-admin/login';
            return;
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
        if (elements.form) {
            elements.form.addEventListener('submit', handleFormSubmit);
        }

        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', () => {
                window.location.href = `/super-admin/admin-details?id=${encodeURIComponent(adminId)}`;
            });
        }
    }

    async function loadAdminData() {
        try {
            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) throw new Error('Failed to load administrator data');

            const admin = await res.json();
            if (elements.nameInput) elements.nameInput.value = admin.name || '';
            if (elements.emailInput) elements.emailInput.value = admin.email || '';
            if (elements.roleInput) elements.roleInput.value = (admin.role || '').replace(/_/g, ' ').toUpperCase();
            if (elements.phoneInput) elements.phoneInput.value = admin.phone || '';
            if (elements.orgInput) elements.orgInput.value = admin.organization_name || '';
            if (elements.descInput) elements.descInput.value = admin.description || '';
        } catch (err) {
            console.error('Error loading admin:', err);
            showAlert('Unable to load administrator profile for editing.');
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        hideAlert();

        const name = elements.nameInput.value.trim();
        const phone = elements.phoneInput.value.trim();
        const organization_name = elements.orgInput.value.trim();
        const description = elements.descInput.value.trim();

        if (!name || name.length < 2) {
            showAlert('Please specify a valid administrator name (at least 2 characters).');
            return;
        }

        try {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Saving Changes...';

            const payload = {
                name,
                phone: phone || null,
                organization_name: organization_name || null,
                description: description || null
            };

            const apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || '/api/v1';
            const res = await fetch(`${apiBase}/super-admin/admins/${encodeURIComponent(adminId)}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to update administrator profile');

            window.location.href = `/super-admin/admin-details?id=${encodeURIComponent(adminId)}`;
        } catch (err) {
            console.error('Update error:', err);
            showAlert(err.message || 'Error saving changes');
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Save Changes';
        }
    }

    function showAlert(msg) {
        if (!elements.alertBox) return;
        elements.alertBox.textContent = msg;
        elements.alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (!elements.alertBox) return;
        elements.alertBox.style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', init);
})();
