/**
 * BugBash - Admin Algorithm Analytics Controller
 * Handles aggregated algorithm frequencies, language distributions, Big-O metrics,
 * common coding antipatterns, and topic optimization opportunities.
 */

(function () {
    'use strict';

    const state = {
        token: localStorage.getItem('bugbash_admin_token') || '',
        filters: {
            language: '',
            difficulty: '',
            date_range: ''
        }
    };

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
        };
    }

    function checkAuth() {
        if (!state.token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    async function loadAlgorithmAnalytics() {
        try {
            const params = new URLSearchParams();
            if (state.filters.language) params.append('language', state.filters.language);
            if (state.filters.difficulty) params.append('difficulty', state.filters.difficulty);

            const baseUrl = window.BugBashConfig ? `${window.BugBashConfig.API_BASE_URL}/admin/ml-insights` : '/api/v1/admin/ml-insights';
            const res = await fetch(`${baseUrl}/algorithms?${params.toString()}`, {
                headers: getHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }

            if (!res.ok) throw new Error('Failed to load algorithm analytics');
            const data = await res.json();
            renderAnalytics(data);
        } catch (err) {
            console.error('Error loading algorithm analytics:', err);
        }
    }

    function renderAnalytics(data) {
        // 1. Frequent Algorithms Chart
        if (window.MLCharts) {
            window.MLCharts.renderAlgorithmFrequency('algorithmFrequencyChart', data.frequent_algorithms || []);
        }

        // 2. Language Distribution Donut
        if (window.MLCharts) {
            window.MLCharts.renderLanguageDonut('languageDistributionChart', data.language_distribution || {});
        }

        // 3. Time Complexity Distribution
        if (window.MLCharts) {
            window.MLCharts.renderComplexityDistribution('timeComplexityChart', data.time_complexity_distribution || {});
        }

        // 4. Space Complexity Distribution
        if (window.MLCharts) {
            window.MLCharts.renderComplexityDistribution('spaceComplexityChart', data.space_complexity_distribution || {});
        }

        // 5. Common Coding Mistakes Table
        const mistakesTbody = document.getElementById('commonMistakesBody');
        if (mistakesTbody) {
            const mistakes = data.common_coding_mistakes || [];
            if (mistakes.length === 0) {
                mistakesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.5;">No antipatterns recorded</td></tr>`;
            } else {
                let html = '';
                mistakes.forEach(m => {
                    const sev = (m.severity || 'low').toLowerCase();
                    html += `
                        <tr>
                            <td>
                                <strong style="color:var(--text-primary);">${m.mistake_pattern}</strong>
                                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Target: ${m.affected_concept}</div>
                            </td>
                            <td><span class="severity-pill ${sev}">${m.severity}</span></td>
                            <td><strong>${m.frequency}</strong> occurrences</td>
                            <td style="font-size:12px; color:var(--text-secondary);">${m.example_remediation}</td>
                        </tr>
                    `;
                });
                mistakesTbody.innerHTML = html;
            }
        }

        // 6. Topic Optimization Grid
        const topicGrid = document.getElementById('topicOptimizationGrid');
        if (topicGrid) {
            const topics = data.optimization_by_topic || [];
            let html = '';
            topics.forEach(t => {
                html += `
                    <div class="topic-opt-box">
                        <h4>${t.topic}</h4>
                        <div class="opt-count">${t.optimizations_count}</div>
                        <div style="font-size:11px; color:var(--text-secondary);">Prevalent Inefficiency:</div>
                        <div style="font-size:12px; font-weight:600; color:var(--text-primary); margin-top:2px;">${t.prevalent_inefficiency}</div>
                    </div>
                `;
            });
            topicGrid.innerHTML = html;
        }
    }

    function bindEvents() {
        const langFilter = document.getElementById('filterLang');
        if (langFilter) {
            langFilter.addEventListener('change', (e) => {
                state.filters.language = e.target.value;
                loadAlgorithmAnalytics();
            });
        }

        const diffFilter = document.getElementById('filterDiff');
        if (diffFilter) {
            diffFilter.addEventListener('change', (e) => {
                state.filters.difficulty = e.target.value;
                loadAlgorithmAnalytics();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAuth()) return;
        bindEvents();
        loadAlgorithmAnalytics();
    });

})();
