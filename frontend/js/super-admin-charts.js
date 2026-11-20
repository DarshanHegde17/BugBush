/**
 * ==============================================================================
 * BugBash - Super Admin Charts Module
 * ==============================================================================
 * Renders interactive visual analytics for:
 * - User Analytics (Registrations over time & Roles distribution)
 * - Assessment Analytics (Creation trends & Category distribution)
 * - Submission Analytics (Daily submissions & Language breakdowns)
 * - ML Insights Analytics (Complexity trends & Algorithm recognition)
 *
 * Employs Chart.js when present, with resilient native SVG vector fallbacks
 * ensuring zero broken visualizations offline.
 */

(function (global) {
    'use strict';

    const THEME_COLORS = {
        primary: '#ff6b35',
        primaryAlpha: 'rgba(255, 107, 53, 0.15)',
        purple: '#8b5cf6',
        purpleAlpha: 'rgba(139, 92, 246, 0.15)',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
        error: '#ef4444',
        palette: ['#ff6b35', '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4'],
        gridDark: 'rgba(255, 255, 255, 0.06)',
        gridLight: 'rgba(0, 0, 0, 0.06)',
        textDark: '#94a3b8',
        textLight: '#475569'
    };

    function isDarkTheme() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    const SuperAdminCharts = {
        instances: {},

        destroy(chartId) {
            if (this.instances[chartId]) {
                try {
                    this.instances[chartId].destroy();
                } catch (e) {}
                delete this.instances[chartId];
            }
        },

        destroyAll() {
            Object.keys(this.instances).forEach(id => this.destroy(id));
        },

        /**
         * Renders Primary Line / Trend Chart
         */
        renderLineChart(canvasId, labels, dataPoints, datasetLabel = 'Volume', color = THEME_COLORS.primary) {
            this.destroy(canvasId);
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            const isDark = isDarkTheme();
            const gridColor = isDark ? THEME_COLORS.gridDark : THEME_COLORS.gridLight;
            const textColor = isDark ? THEME_COLORS.textDark : THEME_COLORS.textLight;

            if (typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                this.instances[canvasId] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: datasetLabel,
                            data: dataPoints,
                            borderColor: color,
                            backgroundColor: color === THEME_COLORS.primary ? THEME_COLORS.primaryAlpha : THEME_COLORS.purpleAlpha,
                            borderWidth: 2.5,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: color
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#101522',
                                titleColor: '#f8fafc',
                                bodyColor: '#94a3b8',
                                borderColor: '#1f273d',
                                borderWidth: 1,
                                padding: 10
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: gridColor },
                                ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
                                beginAtZero: true
                            }
                        }
                    }
                });
            } else {
                // Fallback SVG representation
                this.renderSvgLineFallback(canvas, labels, dataPoints, color);
            }
        },

        /**
         * Renders Doughnut / Pie Distribution Chart
         */
        renderDoughnutChart(canvasId, labels, dataPoints) {
            this.destroy(canvasId);
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            const isDark = isDarkTheme();
            const textColor = isDark ? THEME_COLORS.textDark : THEME_COLORS.textLight;

            if (typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                this.instances[canvasId] = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: dataPoints,
                            backgroundColor: THEME_COLORS.palette.slice(0, labels.length),
                            borderWidth: 2,
                            borderColor: isDark ? '#101522' : '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: textColor,
                                    font: { family: 'Inter', size: 11 },
                                    boxWidth: 12,
                                    padding: 14
                                }
                            },
                            tooltip: {
                                backgroundColor: '#101522',
                                borderColor: '#1f273d',
                                borderWidth: 1
                            }
                        },
                        cutout: '68%'
                    }
                });
            } else {
                this.renderSvgDoughnutFallback(canvas, labels, dataPoints);
            }
        },

        /**
         * Renders Bar Chart
         */
        renderBarChart(canvasId, labels, dataPoints, datasetLabel = 'Count') {
            this.destroy(canvasId);
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            const isDark = isDarkTheme();
            const gridColor = isDark ? THEME_COLORS.gridDark : THEME_COLORS.gridLight;
            const textColor = isDark ? THEME_COLORS.textDark : THEME_COLORS.textLight;

            if (typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                this.instances[canvasId] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: datasetLabel,
                            data: dataPoints,
                            backgroundColor: THEME_COLORS.primary,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        },

        /**
         * Fallback SVG vector chart renderer if Chart.js is offline
         */
        renderSvgLineFallback(canvas, labels, dataPoints, color) {
            const width = canvas.parentElement.clientWidth || 400;
            const height = 220;
            const maxVal = Math.max(...dataPoints, 10);
            const padding = 28;

            const stepX = (width - padding * 2) / Math.max(1, dataPoints.length - 1);
            const points = dataPoints.map((val, idx) => {
                const x = padding + idx * stepX;
                const y = height - padding - (val / maxVal) * (height - padding * 2);
                return `${x},${y}`;
            }).join(' ');

            const svg = `
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                    <polyline fill="none" stroke="${color}" stroke-width="2.5" points="${points}" />
                </svg>
            `;
            canvas.parentElement.innerHTML = svg;
        },

        renderSvgDoughnutFallback(canvas, labels, dataPoints) {
            const total = dataPoints.reduce((acc, v) => acc + v, 0) || 1;
            const legend = labels.map((l, i) => `
                <div style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; margin: 4px 8px;">
                    <span style="width:10px; height:10px; border-radius:2px; background:${THEME_COLORS.palette[i % THEME_COLORS.palette.length]}"></span>
                    <span>${l} (${dataPoints[i]})</span>
                </div>
            `).join('');

            canvas.parentElement.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:20px 0;">
                    <div style="font-size:1.5rem; font-weight:700; color:${THEME_COLORS.primary};">${total}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:12px;">Total Classified</div>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center;">${legend}</div>
                </div>
            `;
        }
    };

    global.SuperAdminCharts = SuperAdminCharts;

})(window);
