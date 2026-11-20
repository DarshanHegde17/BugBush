/**
 * BugBash - Result & Analytics Lightweight SVG Charting Engine
 * Zero-dependency, theme-reactive, accessible SVG charting utility.
 * Supports: Score Distribution (Bar), Pass/Fail (Donut), Trend (Line), and Skill/Difficulty (Horizontal Bars).
 */

(function (window) {
    'use strict';

    const ResultCharts = {
        /**
         * Renders a vertical bar chart for score bucket distributions.
         * @param {string|HTMLElement} container - DOM element or selector ID.
         * @param {Object} distribution - Map of {"0-20": count, "21-40": count, ...}
         * @param {Object} options - Customizations (height, accentColor, showLabels)
         */
        renderScoreDistribution(container, distribution, options = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            const buckets = [
                { label: '0-20%', key: '0-20', count: (distribution && distribution['0-20']) || 0 },
                { label: '21-40%', key: '21-40', count: (distribution && distribution['21-40']) || 0 },
                { label: '41-60%', key: '41-60', count: (distribution && distribution['41-60']) || 0 },
                { label: '61-80%', key: '61-80', count: (distribution && distribution['61-80']) || 0 },
                { label: '81-100%', key: '81-100', count: (distribution && distribution['81-100']) || 0 }
            ];

            const maxCount = Math.max(...buckets.map(b => b.count), 1);
            const height = options.height || 180;
            const barWidth = 36;
            const spacing = 16;
            const svgWidth = buckets.length * (barWidth + spacing) + spacing + 30;

            let barsSvg = '';
            buckets.forEach((b, i) => {
                const x = 30 + i * (barWidth + spacing);
                const barHeight = Math.max((b.count / maxCount) * (height - 50), 4);
                const y = (height - 30) - barHeight;
                const isTopBucket = i >= 3;
                const fillColor = isTopBucket ? '#ff6b35' : (i < 2 ? '#ef4444' : '#eab308');

                barsSvg += `
                    <g class="chart-bar-group" data-bucket="${b.key}" data-count="${b.count}">
                        <title>${b.label}: ${b.count} candidate${b.count === 1 ? '' : 's'}</title>
                        <!-- Background slot track -->
                        <rect x="${x}" y="10" width="${barWidth}" height="${height - 40}" rx="6" fill="rgba(255,255,255,0.04)" />
                        <!-- Active bar -->
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${fillColor}" opacity="0.9">
                            <animate attributeName="height" from="0" to="${barHeight}" dur="0.4s" fill="freeze" />
                            <animate attributeName="y" from="${height - 30}" to="${y}" dur="0.4s" fill="freeze" />
                        </rect>
                        <!-- Value above bar -->
                        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" opacity="0.9">${b.count}</text>
                        <!-- Label below bar -->
                        <text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.6">${b.label}</text>
                    </g>
                `;
            });

            el.innerHTML = `
                <div class="result-svg-chart-wrap" style="position:relative; width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 ${svgWidth} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%; max-height:${height}px; display:block;">
                        <!-- Horizontal baseline -->
                        <line x1="15" y1="${height - 28}" x2="${svgWidth - 10}" y2="${height - 28}" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />
                        ${barsSvg}
                    </svg>
                </div>
            `;
        },

        /**
         * Renders a circular donut chart for Pass vs Fail distribution.
         * @param {string|HTMLElement} container - DOM container element.
         * @param {number} passCount - Total passed.
         * @param {number} failCount - Total failed.
         * @param {Object} options - Customizations.
         */
        renderPassFailDonut(container, passCount, failCount, options = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            const total = passCount + failCount;
            const passPct = total > 0 ? Math.round((passCount / total) * 100) : 0;
            const failPct = total > 0 ? 100 - passPct : 0;

            const size = options.size || 160;
            const strokeWidth = 18;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;

            const passOffset = circumference - (passPct / 100) * circumference;
            const failOffset = circumference - (failPct / 100) * circumference;

            el.innerHTML = `
                <div class="donut-chart-container" style="display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap;">
                    <div style="position:relative; width:${size}px; height:${size}px;">
                        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                            <!-- Background ring -->
                            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="${strokeWidth}" />
                            <!-- Fail segment -->
                            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#ef4444" stroke-width="${strokeWidth}"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${failOffset}"
                                stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})" opacity="0.85" />
                            <!-- Pass segment -->
                            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#10b981" stroke-width="${strokeWidth}"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${passOffset}"
                                stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})" />
                        </svg>
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                            <span style="font-size:22px; font-weight:800; color:#10b981; line-height:1;">${passPct}%</span>
                            <span style="font-size:11px; font-weight:600; opacity:0.6; text-transform:uppercase; margin-top:2px;">Pass Rate</span>
                        </div>
                    </div>
                    <div class="donut-legend" style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
                            <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                            <span style="font-weight:600;">Passed:</span>
                            <span style="font-weight:700;">${passCount}</span>
                            <span style="opacity:0.6;">(${passPct}%)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
                            <span style="width:10px; height:10px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
                            <span style="font-weight:600;">Failed:</span>
                            <span style="font-weight:700;">${failCount}</span>
                            <span style="opacity:0.6;">(${failPct}%)</span>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Renders a candidate historical score trendline.
         * @param {string|HTMLElement} container - DOM container.
         * @param {Array} points - Array of { date: "Nov 12", score: 85, title: "Exam 1" }
         * @param {Object} options - Height and styling options.
         */
        renderTrendLine(container, points = [], options = {}) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            if (!points || points.length === 0) {
                el.innerHTML = '<div style="padding:24px; text-align:center; opacity:0.6; font-size:13px;">No historical test results available for trend visualization.</div>';
                return;
            }

            const height = options.height || 180;
            const width = 480;
            const paddingLeft = 36;
            const paddingRight = 24;
            const paddingTop = 20;
            const paddingBottom = 30;

            const usableW = width - paddingLeft - paddingRight;
            const usableH = height - paddingTop - paddingBottom;

            const step = points.length > 1 ? usableW / (points.length - 1) : usableW / 2;

            const coords = points.map((p, i) => {
                const score = Math.max(0, Math.min(100, p.score || 0));
                const x = points.length === 1 ? paddingLeft + usableW / 2 : paddingLeft + i * step;
                const y = paddingTop + usableH - (score / 100) * usableH;
                return { x, y, score, date: p.date || p.completion_date || `#${i + 1}`, title: p.title || p.assessment_title || '' };
            });

            // Build path string
            let pathD = '';
            coords.forEach((c, idx) => {
                pathD += (idx === 0 ? `M ${c.x} ${c.y}` : ` L ${c.x} ${c.y}`);
            });

            // Gradient area path
            const areaD = pathD + ` L ${coords[coords.length - 1].x} ${paddingTop + usableH} L ${coords[0].x} ${paddingTop + usableH} Z`;

            let dotsSvg = '';
            coords.forEach((c) => {
                dotsSvg += `
                    <g class="trend-node" tabindex="0">
                        <title>${c.title ? c.title + ': ' : ''}${c.score}% (${c.date})</title>
                        <circle cx="${c.x}" cy="${c.y}" r="4.5" fill="#ff6b35" stroke="#ffffff" stroke-width="2" />
                        <text x="${c.x}" y="${c.y - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="#ff6b35">${c.score}%</text>
                        <text x="${c.x}" y="${height - 8}" text-anchor="middle" font-size="9" font-weight="500" fill="currentColor" opacity="0.6">${c.date}</text>
                    </g>
                `;
            });

            el.innerHTML = `
                <div class="trend-chart-wrap" style="width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%; max-height:${height}px; display:block;">
                        <defs>
                            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#ff6b35" stop-opacity="0.3" />
                                <stop offset="100%" stop-color="#ff6b35" stop-opacity="0.0" />
                            </linearGradient>
                        </defs>
                        <!-- Grid lines -->
                        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="currentColor" stroke-opacity="0.08" />
                        <line x1="${paddingLeft}" y1="${paddingTop + usableH * 0.5}" x2="${width - paddingRight}" y2="${paddingTop + usableH * 0.5}" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
                        <line x1="${paddingLeft}" y1="${paddingTop + usableH}" x2="${width - paddingRight}" y2="${paddingTop + usableH}" stroke="currentColor" stroke-opacity="0.15" />
                        <!-- Y-axis guide labels -->
                        <text x="${paddingLeft - 6}" y="${paddingTop + 4}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">100%</text>
                        <text x="${paddingLeft - 6}" y="${paddingTop + usableH * 0.5 + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">50%</text>
                        <text x="${paddingLeft - 6}" y="${paddingTop + usableH + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">0%</text>
                        <!-- Area fill -->
                        <path d="${areaD}" fill="url(#trendGradient)" />
                        <!-- Line stroke -->
                        <path d="${pathD}" fill="none" stroke="#ff6b35" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                        <!-- Interactive node dots -->
                        ${dotsSvg}
                    </svg>
                </div>
            `;
        },

        /**
         * Renders a list of progress bars for Difficulty / Category breakdown.
         * @param {string|HTMLElement} container - DOM element or selector.
         * @param {Array} items - Array of { label: "Easy", percentage: 85, count: 12, color: "#10b981" }
         */
        renderHorizontalBars(container, items = []) {
            const el = typeof container === 'string' ? document.getElementById(container) : container;
            if (!el) return;

            if (!items || items.length === 0) {
                el.innerHTML = '<div style="opacity:0.6; font-size:12px;">No breakdown data available</div>';
                return;
            }

            let html = '<div class="horizontal-bars-list" style="display:flex; flex-direction:column; gap:12px;">';
            items.forEach(item => {
                const pct = Math.max(0, Math.min(100, Math.round(item.percentage || 0)));
                const barColor = item.color || '#ff6b35';
                html += `
                    <div class="h-bar-row">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:12px;">
                            <span style="font-weight:600;">${item.label}</span>
                            <div>
                                <span style="font-weight:700; color:${barColor};">${pct}%</span>
                                ${item.count !== undefined ? `<span style="opacity:0.5; font-size:11px; margin-left:4px;">(${item.count})</span>` : ''}
                            </div>
                        </div>
                        <div style="height:8px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden; position:relative;">
                            <div style="height:100%; width:${pct}%; border-radius:4px; background:${barColor}; transition:width 0.5s ease-out;"></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            el.innerHTML = html;
        }
    };

    window.ResultCharts = ResultCharts;
})(window);
