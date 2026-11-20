/**
 * BugBash - Enterprise Admin Notification Composer Controller
 * Handles notification creation, template autofill, live recipient estimation,
 * variable helper token insertion, and real-time split-screen rendering.
 */

(function () {
    'use strict';

    let editingNotificationId = null;
    let estimateTimeout = null;
    let availableTemplates = [];

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

    document.addEventListener('DOMContentLoaded', async function () {
        if (!checkAuth()) return;

        initEventListeners();
        await loadTemplatesDropdown();

        // Check for URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const notifId = urlParams.get('id');
        const templateId = urlParams.get('template_id');

        if (notifId) {
            editingNotificationId = notifId;
            document.getElementById('composerPageTitle').textContent = 'Edit Notification';
            await loadNotificationForEdit(notifId);
        } else if (templateId) {
            applyTemplateById(templateId);
        }

        // Initial estimation and preview update
        triggerEstimateRecipients();
        updateLivePreview();
    });

    function initEventListeners() {
        // Text inputs live preview
        ['notifTitle', 'notifMessage', 'notifActionUrl'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    updateLivePreview();
                });
            }
        });

        // Template dropdown change
        const tmplSelect = document.getElementById('notifTemplateSelect');
        if (tmplSelect) {
            tmplSelect.addEventListener('change', function () {
                if (this.value) {
                    applyTemplateById(this.value);
                }
            });
        }

        // Variable chip click to append into textarea
        const chips = document.querySelectorAll('.var-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', function () {
                const varToken = this.getAttribute('data-var');
                insertTokenAtCursor('notifMessage', varToken);
                updateLivePreview();
            });
        });

        // Audience radio buttons
        const audienceRadios = document.querySelectorAll('input[name="targetAudience"]');
        audienceRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                toggleAudienceSubfields(this.value);
                triggerEstimateRecipients();
            });
        });

        // Audience target sub-inputs
        const targetIdsInput = document.getElementById('notifTargetIds');
        if (targetIdsInput) {
            targetIdsInput.addEventListener('input', () => {
                triggerEstimateRecipients();
            });
        }

        // Delivery schedule toggle
        const scheduleRadios = document.querySelectorAll('input[name="deliveryOption"]');
        const scheduleContainer = document.getElementById('scheduleDatetimeGroup');
        const primarySubmitBtn = document.getElementById('btnSubmitNotification');

        scheduleRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                if (this.value === 'schedule_later') {
                    if (scheduleContainer) scheduleContainer.style.display = 'block';
                    if (primarySubmitBtn) primarySubmitBtn.textContent = 'Schedule Notification';
                } else {
                    if (scheduleContainer) scheduleContainer.style.display = 'none';
                    if (primarySubmitBtn) primarySubmitBtn.textContent = 'Send Immediately';
                }
            });
        });

        // Preview tab switches
        const tabBtns = document.querySelectorAll('.preview-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                tabBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const targetView = this.getAttribute('data-tab');

                document.getElementById('inAppPreviewTab').style.display = targetView === 'inapp' ? 'block' : 'none';
                document.getElementById('emailPreviewTab').style.display = targetView === 'email' ? 'block' : 'none';
            });
        });

        // Form Submit Buttons
        const form = document.getElementById('notificationComposerForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                saveNotification(false);
            });
        }

        const draftBtn = document.getElementById('btnSaveDraft');
        if (draftBtn) {
            draftBtn.addEventListener('click', function () {
                saveNotification(true);
            });
        }
    }

    function toggleAudienceSubfields(audience) {
        const subgroup = document.getElementById('audienceTargetIdsGroup');
        const label = document.getElementById('audienceTargetIdsLabel');
        const helper = document.getElementById('audienceTargetIdsHelper');

        if (!subgroup) return;

        if (audience === 'all_candidates') {
            subgroup.style.display = 'none';
        } else {
            subgroup.style.display = 'block';
            if (audience === 'candidate_groups') {
                if (label) label.textContent = 'Target Candidate Group IDs (comma separated):';
                if (helper) helper.textContent = 'Example: grp_batch_2026, grp_interview_tier1';
            } else if (audience === 'specific_assessment') {
                if (label) label.textContent = 'Target Assessment IDs (comma separated):';
                if (helper) helper.textContent = 'Example: asm_py_eval_2026, asm_dsa_01';
            } else if (audience === 'individual_candidates') {
                if (label) label.textContent = 'Candidate Emails or User IDs:';
                if (helper) helper.textContent = 'Enter emails separated by commas: candidate1@test.com, candidate2@test.com';
            }
        }
    }

    function insertTokenAtCursor(textareaId, token) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + token + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
        textarea.focus();
    }

    async function loadTemplatesDropdown() {
        try {
            const res = await fetch('/api/v1/admin/notification-templates', {
                credentials: 'include',
                headers: getHeaders()
            });
            if (!res.ok) return;
            availableTemplates = await res.json();

            const select = document.getElementById('notifTemplateSelect');
            if (!select) return;

            select.innerHTML = '<option value="">-- Choose a predefined template (optional) --</option>';
            availableTemplates.forEach(tmpl => {
                const opt = document.createElement('option');
                opt.value = tmpl.template_id;
                opt.textContent = `${tmpl.name} [${tmpl.category}]`;
                select.appendChild(opt);
            });
        } catch (e) {
            console.error('Error loading notification templates:', e);
        }
    }

    function applyTemplateById(templateId) {
        const tmpl = availableTemplates.find(t => t.template_id === templateId);
        if (!tmpl) return;

        const titleInput = document.getElementById('notifTitle');
        const msgTextarea = document.getElementById('notifMessage');
        const catSelect = document.getElementById('notifCategory');

        if (titleInput) titleInput.value = tmpl.subject || tmpl.name;
        if (msgTextarea) msgTextarea.value = tmpl.body;
        if (catSelect) catSelect.value = tmpl.category;

        updateLivePreview();
    }

    async function loadNotificationForEdit(id) {
        try {
            const res = await fetch(`/api/v1/admin/notifications/${id}`, {
                credentials: 'include',
                headers: getHeaders()
            });
            if (!res.ok) {
                alert('Notification not found or access denied');
                window.location.href = '/admin/notifications';
                return;
            }
            const data = await res.json();

            document.getElementById('notifTitle').value = data.title || '';
            document.getElementById('notifMessage').value = data.message || '';
            document.getElementById('notifCategory').value = data.category || 'General Announcement';
            document.getElementById('notifPriority').value = data.priority || 'Normal';
            if (data.action_url) document.getElementById('notifActionUrl').value = data.action_url;

            // Target audience
            const audRadio = document.querySelector(`input[name="targetAudience"][value="${data.target_audience}"]`);
            if (audRadio) {
                audRadio.checked = true;
                toggleAudienceSubfields(data.target_audience);
            }

            if (data.target_ids && data.target_ids.length > 0) {
                const targetInput = document.getElementById('notifTargetIds');
                if (targetInput) targetInput.value = data.target_ids.join(', ');
            }

            // Channel
            const chanRadio = document.querySelector(`input[name="deliveryChannel"][value="${data.channel}"]`);
            if (chanRadio) chanRadio.checked = true;

            // Scheduling
            if (data.scheduled_at) {
                const schedRadio = document.querySelector('input[name="deliveryOption"][value="schedule_later"]');
                if (schedRadio) {
                    schedRadio.checked = true;
                    document.getElementById('scheduleDatetimeGroup').style.display = 'block';
                    document.getElementById('btnSubmitNotification').textContent = 'Update Schedule';
                    // Convert ISO to datetime-local string
                    try {
                        const dt = new Date(data.scheduled_at);
                        const isoStr = dt.toISOString().slice(0, 16);
                        document.getElementById('notifScheduledAt').value = isoStr;
                    } catch (e) {}
                }
            }

            triggerEstimateRecipients();
            updateLivePreview();
        } catch (e) {
            console.error('Error loading notification for edit:', e);
        }
    }

    function triggerEstimateRecipients() {
        clearTimeout(estimateTimeout);
        estimateTimeout = setTimeout(async () => {
            const audienceRadio = document.querySelector('input[name="targetAudience"]:checked');
            const targetAudience = audienceRadio ? audienceRadio.value : 'all_candidates';
            const targetIdsVal = document.getElementById('notifTargetIds')?.value.trim() || '';
            const targetIds = targetIdsVal ? targetIdsVal.split(',').map(s => s.trim()).filter(Boolean) : null;

            try {
                const res = await fetch('/api/v1/admin/notifications/recipients/estimate', {
                    method: 'POST',
                    credentials: 'include',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        target_audience: targetAudience,
                        target_ids: targetIds
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const countEl = document.getElementById('estimatedRecipientsCount');
                    const summaryEl = document.getElementById('audienceSummaryText');
                    if (countEl) countEl.textContent = (data.estimated_count || 0).toLocaleString();
                    if (summaryEl) summaryEl.textContent = data.audience_summary || '';
                }
            } catch (e) {
                console.error('Failed to estimate recipients:', e);
            }
        }, 300);
    }

    function updateLivePreview() {
        const title = document.getElementById('notifTitle')?.value.trim() || 'Notification Title';
        const rawMsg = document.getElementById('notifMessage')?.value || 'Your notification message preview will appear here in real time as you compose.';
        const actionUrl = document.getElementById('notifActionUrl')?.value.trim() || '';

        // Mock variable replacements for preview
        const interpolatedMsg = rawMsg
            .replace(/\{\{\s*candidate_name\s*\}\}/g, 'Alex Morgan')
            .replace(/\{\{\s*assessment_name\s*\}\}/g, 'Data Structures & Algorithms Final')
            .replace(/\{\{\s*assessment_title\s*\}\}/g, 'Data Structures & Algorithms Final')
            .replace(/\{\{\s*due_date\s*\}\}/g, 'Tomorrow, 11:59 PM')
            .replace(/\{\{\s*deadline\s*\}\}/g, 'Tomorrow, 11:59 PM')
            .replace(/\{\{\s*score\s*\}\}/g, '94 / 100')
            .replace(/\{\{\s*result_link\s*\}\}/g, window.location.origin + '/user/assessments')
            .replace(/\{\{\s*assessment_link\s*\}\}/g, window.location.origin + '/user/assessment/exam');

        // Update In-App card preview
        const inAppTitle = document.getElementById('inAppPreviewTitle');
        const inAppMsg = document.getElementById('inAppPreviewMsg');
        const inAppBtn = document.getElementById('inAppPreviewBtn');

        if (inAppTitle) inAppTitle.textContent = title;
        if (inAppMsg) inAppMsg.textContent = interpolatedMsg;
        if (inAppBtn) {
            if (actionUrl) {
                inAppBtn.style.display = 'inline-flex';
                inAppBtn.href = actionUrl;
            } else {
                inAppBtn.style.display = 'none';
            }
        }

        // Update Email view
        const emailSubject = document.getElementById('emailMockSubject');
        const emailBody = document.getElementById('emailMockBody');

        if (emailSubject) emailSubject.textContent = title;
        if (emailBody) emailBody.textContent = interpolatedMsg;
    }

    async function saveNotification(isDraft) {
        const title = document.getElementById('notifTitle')?.value.trim();
        const message = document.getElementById('notifMessage')?.value.trim();
        const category = document.getElementById('notifCategory')?.value;
        const priority = document.getElementById('notifPriority')?.value;
        const actionUrl = document.getElementById('notifActionUrl')?.value.trim() || null;

        const audienceRadio = document.querySelector('input[name="targetAudience"]:checked');
        const targetAudience = audienceRadio ? audienceRadio.value : 'all_candidates';

        const channelRadio = document.querySelector('input[name="deliveryChannel"]:checked');
        const channel = channelRadio ? channelRadio.value : 'in_app';

        const targetIdsVal = document.getElementById('notifTargetIds')?.value.trim();
        const targetIds = targetIdsVal ? targetIdsVal.split(',').map(s => s.trim()).filter(Boolean) : null;

        if (!title || !message) {
            alert('Please provide both a Title and Message body.');
            return;
        }

        const deliveryOption = document.querySelector('input[name="deliveryOption"]:checked')?.value || 'send_now';
        let scheduledAt = null;

        if (deliveryOption === 'schedule_later' && !isDraft) {
            const dtVal = document.getElementById('notifScheduledAt')?.value;
            if (!dtVal) {
                alert('Please select a scheduled date and time.');
                return;
            }
            scheduledAt = new Date(dtVal).toISOString();
        }

        const payload = {
            title: title,
            message: message,
            category: category,
            priority: priority,
            channel: channel,
            target_audience: targetAudience,
            target_ids: targetIds,
            action_url: actionUrl,
            scheduled_at: isDraft ? null : scheduledAt
        };

        try {
            let url = '/api/v1/admin/notifications';
            let method = 'POST';

            if (editingNotificationId) {
                url = `/api/v1/admin/notifications/${editingNotificationId}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(`Error: ${errData.detail || 'Could not save notification'}`);
                return;
            }

            const result = await res.json();
            alert(isDraft ? 'Notification saved as draft.' : (scheduledAt ? 'Notification successfully scheduled!' : 'Notification dispatched successfully!'));
            window.location.href = `/admin/notification-details?id=${result.id || editingNotificationId}`;
        } catch (e) {
            console.error('Error saving notification:', e);
            alert('A network error occurred while saving the notification.');
        }
    }

})();
