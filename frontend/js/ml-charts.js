/**
 * BugBash - ML Insights Lightweight SVG Charting Engine
 * Zero-dependency, accessible, theme-reactive charts for ML algorithm telemetry,
 * complexity distributions, model benchmarks, and pipeline status.
 */

(function (window) {
    'use strict';

    const MLCharts = {
        /**
         * Renders horizontal bars for Algorithm Frequencies with confidence badges.
         * @param {string|HTMLElement} container - Target container.
         * @param {Array} items - List of { algorithm, count, percentage, average_confidence }
         */
        renderAlgorithmFrequency(container, items = []) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            if (!items || items.length === 0) {
                el.innerHTML = '<div style="padding:24px; text-align:center; opacity:0.6; font-size:12px;">No algorithm data recorded</div>';
                return;
            }

            const maxCount = Math.max(...items.map(i => i.count || 0), 1);

            let html = '<div class="ml-freq-list" style="display:flex; flex-direction:column; gap:12px;">';
            items.forEach(item => {
                const count = item.count || 0;
                const widthPct = Math.max(5, Math.min(100, (count / maxCount) * 100));
                const conf = item.average_confidence || 95.0;

                html += `
                    <div class="ml-freq-row">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:12px;">
                            <span style="font-weight:600; color:var(--text-primary);">${item.algorithm}</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.12); color:#10b981; font-weight:700;">
                                    ${conf}% conf
                                </span>
                                <span style="font-weight:700;">${count}</span>
                                <span style="opacity:0.5; font-size:11px;">(${item.percentage}%)</span>
                            </div>
                        </div>
                        <div style="height:8px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden;">
                            <div style="height:100%; width:${widthPct}%; border-radius:4px; background:linear-gradient(90deg, #ff6b35 0%, #ff8c42 100%); transition:width 0.4s ease-out;"></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            el.innerHTML = html;
        },

        /**
         * Renders Time or Space Complexity distribution bar chart.
         * @param {string|HTMLElement} container - Target container.
         * @param {Object} distribution - Map of {"O(1)": 15, "O(n)": 82, ...}
         * @param {Object} options - Customizations.
         */
        renderComplexityDistribution(container, distribution = {}, options = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            const entries = Object.entries(distribution);
            if (entries.length === 0) {
                el.innerHTML = '<div style="padding:24px; text-align:center; opacity:0.6; font-size:12px;">No complexity telemetry available</div>';
                return;
            }

            const maxVal = Math.max(...entries.map(e => e[1]), 1);
            const height = options.height || 160;
            const barWidth = 38;
            const spacing = 16;
            const svgWidth = entries.length * (barWidth + spacing) + spacing + 20;

            let barsSvg = '';
            entries.forEach(([notation, count], idx) => {
                const x = 20 + idx * (barWidth + spacing);
                const barHeight = Math.max((count / maxVal) * (height - 50), 4);
                const y = (height - 30) - barHeight;

                // Color scale by efficiency
                let color = '#10b981'; // Green for O(1), O(log n), O(n)
                if (notation.includes('n^2') || notation.includes('n log n')) color = '#f59e0b';
                if (notation.includes('n^3') || notation.includes('2^n')) color = '#ef4444';

                barsSvg += `
                    <g class="chart-cpx-bar" data-notation="${notation}" data-count="${count}">
                        <title>${notation}: ${count} submissions</title>
                        <rect x="${x}" y="10" width="${barWidth}" height="${height - 40}" rx="6" fill="rgba(255,255,255,0.04)" />
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${color}" opacity="0.9" />
                        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${count}</text>
                        <text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.6">${notation}</text>
                    </g>
                `;
            });

            el.innerHTML = `
                <div class="cpx-chart-wrap" style="width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 ${svgWidth} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%; max-height:${height}px; display:block;">
                        <line x1="10" y1="${height - 28}" x2="${svgWidth - 10}" y2="${height - 28}" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />
                        ${barsSvg}
                    </svg>
                </div>
            `;
        },

        /**
         * Renders donut chart for Language Distribution.
         * @param {string|HTMLElement} container - Target container.
         * @param {Object} langDist - e.g. {"python": 74, "java": 38, "cpp": 26, "javascript": 12}
         */
        renderLanguageDonut(container, langDist = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            const entries = Object.entries(langDist);
            const total = entries.reduce((acc, curr) => acc + curr[1], 0);

            if (total === 0) {
                el.innerHTML = '<div style="padding:24px; text-align:center; opacity:0.6; font-size:12px;">No language distribution data</div>';
                return;
            }

            const colors = {
                python: '#3b82f6',
                java: '#f59e0b',
                cpp: '#10b981',
                c: '#8b5cf6',
                javascript: '#eab308'
            };

            const size = 150;
            const strokeWidth = 18;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;

            let accumulatedAngle = 0;
            let circlesSvg = '';
            let legendHtml = '<div style="display:flex; flex-direction:column; gap:6px;">';

            entries.forEach(([lang, count]) => {
                const pct = (count / total);
                const strokeDasharray = `${pct * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedAngle * (circumference / 360);
                accumulatedAngle += pct * 360;

                const c = colors[lang.toLowerCase()] || '#ff6b35';

                circlesSvg += `
                    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${c}" stroke-width="${strokeWidth}"
                        stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
                        transform="rotate(-90 ${size / 2} ${size / 2})" opacity="0.9" />
                `;

                legendHtml += `
                    <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${c}; display:inline-block;"></span>
                        <span style="font-weight:600; text-transform:uppercase;">${lang}</span>
                        <span style="opacity:0.6; font-size:11px;">${count} (${Math.round(pct * 100)}%)</span>
                    </div>
                `;
            });
            legendHtml += '</div>';

            el.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap;">
                    <div style="position:relative; width:${size}px; height:${size}px;">
                        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="${strokeWidth}" />
                            ${circlesSvg}
                        </svg>
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                            <span style="font-size:20px; font-weight:800; line-height:1;">${total}</span>
                            <span style="font-size:10px; opacity:0.6; text-transform:uppercase; margin-top:2px;">Analyses</span>
                        </div>
                    </div>
                    ${legendHtml}
                </div>
            `;
        },

        /**
         * Renders evaluation confidence histogram distribution.
         */
        renderConfidenceDistribution(container, dist = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            const buckets = [
                { label: '90-100%', count: dist['90-100%'] || 0, color: '#10b981' },
                { label: '80-89%', count: dist['80-89%'] || 0, color: '#3b82f6' },
                { label: '70-79%', count: dist['70-79%'] || 0, color: '#f59e0b' },
                { label: '<70%', count: dist['<70%'] || 0, color: '#ef4444' }
            ];

            const maxCount = Math.max(...buckets.map(b => b.count), 1);
            let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
            buckets.forEach(b => {
                const pct = Math.max(4, (b.count / maxCount) * 100);
                html += `
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                            <span style="font-weight:600;">${b.label}</span>
                            <span style="font-weight:700;">${b.count} models</span>
                        </div>
                        <div style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:${b.color};"></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            el.innerHTML = html;
        }
    };

    window.MLCharts = MLCharts;
})(window);
