const $ = s => document.querySelector(s);
const urlInput = $('#url');
const scanBtn = $('#scan');
const statusEl = $('#status');
const resultsEl = $('#results');
let lastResults = null;
let wcagDb = null;
let activeLevel = 'AA';

// Load WCAG criteria database on startup
fetch('/api/wcag-criteria').then(r => r.ok ? r.json() : null).then(data => { if (data) wcagDb = data; }).catch(() => {});

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') runScan(); });

async function runScan() {
    const url = urlInput.value.trim();
    if (!url) return;
    $('#topbar-url').textContent = url;

    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    statusEl.className = 'status active';
    statusEl.textContent = 'Launching browser...';
    resultsEl.innerHTML = '';

    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                stagehand: document.getElementById('stagehand-toggle')?.checked || false,
            }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let scanResult = null;
        let scanError = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const message = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                let event = 'message';
                let data = '';
                for (const line of message.split('\n')) {
                    if (line.startsWith('event: ')) event = line.slice(7);
                    else if (line.startsWith('data: ')) data = line.slice(6);
                }
                if (!data) continue;

                if (event === 'progress') {
                    const step = JSON.parse(data);
                    statusEl.textContent = step.message;
                } else if (event === 'result') {
                    scanResult = JSON.parse(data);
                } else if (event === 'error') {
                    scanError = JSON.parse(data);
                }
            }
        }

        if (scanError) throw new Error(scanError.error || 'Scan failed');
        if (!scanResult) throw new Error('No results received');

        lastResults = scanResult;
        statusEl.className = 'status';
        renderResults(scanResult);
    } catch (err) {
        statusEl.className = 'status active error';
        statusEl.textContent = err.message;
    } finally {
        scanBtn.disabled = false;
        scanBtn.textContent = 'Scan';
    }
}

function isUserComponent(name) {
    if (!name || name.length <= 1) return false;
    if (name[0] !== name[0].toUpperCase()) return false;
    if (/^(Provider|Context|Fragment|Suspense|StrictMode)/.test(name)) return false;
    return true;
}

function fmtSource(s) {
    if (!s?.filePath) return '';
    let loc = s.filePath;
    if (s.lineNumber) loc += ':' + s.lineNumber;
    if (s.columnNumber) loc += ':' + s.columnNumber;
    return loc;
}

function renderResults(r) {
    const s = r.summary;
    let html = '';

    html += '<div class="summary">';
    html += stat(s.totalViolations, 'Violations', s.totalViolations > 0 ? 'critical' : '');
    html += stat(s.violationsBySeverity?.critical || 0, 'Critical', 'critical');
    html += stat(s.violationsBySeverity?.serious || 0, 'Serious', 'serious');
    html += stat(s.violationsBySeverity?.moderate || 0, 'Moderate', 'moderate');
    html += stat(s.totalPasses, 'Passing', 'pass');
    if (s.totalComponents > 0) html += stat(s.totalComponents, 'Components', '');
    html += '</div>';

    html += '<div class="toolbar">';
    html += '<select id="template" class="select-sm"><option value="fix-all">Full Fix Prompt</option><option value="critical-only">Critical Only</option><option value="quick-wins">Quick Wins</option></select>';
    html += '<button class="btn-outline" onclick="copyAsPrompt()">Copy AI Prompt</button>';
    html += '<button class="btn-outline" onclick="copyAsJSON()">Copy JSON</button>';
    html += '<span class="spacer"></span>';
    html += '</div>';

    // Tabs
    html += '<div class="tabs">';
    html += '<button class="tab active" data-tab="violations">Violations</button>';
    html += '<button class="tab" data-tab="compliance">Compliance Report</button>';
    html += '</div>';

    // Violations tab
    html += '<div class="tab-content active" id="tab-violations">';
    if (r.violations?.length) {
        html += '<div class="section-title">Violations</div><div class="violations">';
        for (const v of r.violations) html += violation(v);
        html += '</div>';
    }
    if (r.incomplete?.length) {
        html += '<div style="margin-top:2rem"><div class="section-title">Needs Review (' + r.incomplete.length + ')</div><div class="violations">';
        for (const v of r.incomplete) html += violation(v);
        html += '</div></div>';
    }
    if (!r.violations?.length && !r.incomplete?.length) {
        html += '<div style="padding:3rem;text-align:center;color:var(--muted)">No violations found.</div>';
    }
    html += '</div>';

    // Compliance report tab
    html += '<div class="tab-content" id="tab-compliance">';
    html += renderComplianceReport(r);
    html += '</div>';

    resultsEl.innerHTML = html;

    // Wire up tabs
    resultsEl.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Wire up violation accordions
    resultsEl.querySelectorAll('.violation-header').forEach(h => {
        h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });

    // Wire up expandable criterion rows to show SC text
    resultsEl.querySelectorAll('.criterion-row.expandable').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('a')) return; // don't toggle when clicking links
            const scRow = row.nextElementSibling;
            if (scRow && scRow.classList.contains('sc-text-row')) {
                const visible = scRow.style.display !== 'none';
                scRow.style.display = visible ? 'none' : 'table-row';
                row.classList.toggle('expanded', !visible);
            }
        });
    });

    // Wire up level filter buttons
    resultsEl.querySelectorAll('.level-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeLevel = btn.dataset.level;
            resultsEl.querySelectorAll('.level-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateComplianceView();
        });
    });
}

function switchTab(tabName) {
    resultsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    resultsEl.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabName));
}

function buildComplianceData(r) {
    if (!wcagDb) return null;

    const criteria = wcagDb.criteria;
    const axeMap = wcagDb.axeMap;

    // Build set of failed criterion IDs from violations
    const failedCriteria = {};
    for (const v of (r.violations || [])) {
        const mapping = axeMap[v.id];
        if (mapping) {
            for (const cId of mapping.criteria) {
                if (!failedCriteria[cId]) failedCriteria[cId] = [];
                failedCriteria[cId].push(v);
            }
        }
        // Also check wcagCriteria on the violation itself
        if (v.wcagCriteria) {
            for (const wc of v.wcagCriteria) {
                if (wc.id && !failedCriteria[wc.id]) failedCriteria[wc.id] = [];
                if (wc.id) failedCriteria[wc.id].push(v);
            }
        }
    }

    // Build set of tested criterion IDs (from passes + violations + incomplete)
    const testedCriteria = new Set();
    for (const v of (r.violations || [])) {
        const mapping = axeMap[v.id];
        if (mapping) mapping.criteria.forEach(id => testedCriteria.add(id));
        if (v.wcagCriteria) v.wcagCriteria.forEach(wc => wc.id && testedCriteria.add(wc.id));
    }
    for (const p of (r.passes || [])) {
        const mapping = axeMap[p.id];
        if (mapping) mapping.criteria.forEach(id => testedCriteria.add(id));
        if (p.wcagCriteria) p.wcagCriteria.forEach(wc => wc.id && testedCriteria.add(wc.id));
    }
    for (const inc of (r.incomplete || [])) {
        const mapping = axeMap[inc.id];
        if (mapping) mapping.criteria.forEach(id => testedCriteria.add(id));
    }

    // Integrate WCAG 2.2 custom check results
    if (r.wcag22) {
        const wcag22Map = {
            targetSize: '2.5.8',
            focusObscured: '2.4.11',
            focusAppearance: '2.4.13',
            dragging: '2.5.7',
            authentication: '3.3.8',
            statusMessages: '4.1.3',
            errorIdentification: '3.3.1',
            errorSuggestion: '3.3.3',
            meaningfulSequence: '1.3.2',
            reflow: '1.4.10',
            hoverFocusContent: '1.4.13',
            sensoryCharacteristics: '1.3.3',
            identifyPurpose: '1.3.6',
            visualPresentation: '1.4.8',
            characterKeyShortcuts: '2.1.4',
            animationInteractions: '2.3.3',
            threeFlashes: '2.3.1',
            sectionHeadings: '2.4.10',
            pointerGestures: '2.5.1',
            pointerCancellation: '2.5.2',
            motionActuation: '2.5.4',
            onFocus: '3.2.1',
            onInput: '3.2.2',
            redundantEntry: '3.3.7',
        };
        for (const [key, criterionId] of Object.entries(wcag22Map)) {
            testedCriteria.add(criterionId);
            const violations = r.wcag22[key] || [];
            if (violations.length > 0) {
                if (!failedCriteria[criterionId]) failedCriteria[criterionId] = [];
                for (const v of violations) {
                    failedCriteria[criterionId].push({
                        id: key,
                        help: v.description,
                        impact: v.impact,
                        nodes: [{ html: v.html || '', target: [v.selector || ''] }]
                    });
                }
            }
        }
    }

    // Integrate supplemental (Stagehand) results
    if (r.supplementalResults) {
        for (const sr of r.supplementalResults) {
            testedCriteria.add(sr.criterionId);
            if (sr.status === 'fail' && sr.issues.length > 0) {
                if (!failedCriteria[sr.criterionId]) failedCriteria[sr.criterionId] = [];
                for (const issue of sr.issues) {
                    failedCriteria[sr.criterionId].push({
                        id: sr.source,
                        help: issue.message,
                        impact: issue.severity,
                        nodes: [{ html: '', target: [issue.selector || ''] }]
                    });
                }
            }
        }
    }

    // Group criteria by principle and level
    const principles = ['Perceivable', 'Operable', 'Understandable', 'Robust'];
    const levels = ['A', 'AA', 'AAA'];
    const result = { principles: {}, levels: {}, failedCriteria, testedCriteria };

    for (const level of levels) {
        result.levels[level] = { total: 0, passed: 0, failed: 0, notTested: 0, manualReview: 0 };
    }

    for (const principle of principles) {
        result.principles[principle] = { criteria: [], passed: 0, failed: 0, notTested: 0, manualReview: 0 };
    }

    for (const [id, criterion] of Object.entries(criteria)) {
        const status = failedCriteria[id] ? 'fail' : testedCriteria.has(id) ? 'pass' : criterion.testability === 'manual' ? 'manual-review' : 'not-tested';
        const entry = { ...criterion, status, violations: failedCriteria[id] || [] };

        if (result.principles[criterion.principle]) {
            result.principles[criterion.principle].criteria.push(entry);
        }
        if (result.levels[criterion.level]) {
            result.levels[criterion.level].total++;
            if (status === 'fail') result.levels[criterion.level].failed++;
            else if (status === 'pass') result.levels[criterion.level].passed++;
            else if (status === 'manual-review') result.levels[criterion.level].manualReview++;
            else result.levels[criterion.level].notTested++;
        }

        // Cumulative: A failures affect AA and AAA conformance
        if (criterion.level === 'A' && status === 'fail') {
            result.levels['AA'].failed++;
            result.levels['AAA'].failed++;
        }
        if (criterion.level === 'AA' && status === 'fail') {
            result.levels['AAA'].failed++;
        }
    }

    // Sort criteria by ID within each principle
    for (const p of principles) {
        result.principles[p].criteria.sort((a, b) => {
            const aParts = a.id.split('.').map(Number);
            const bParts = b.id.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
            }
            return 0;
        });
        for (const c of result.principles[p].criteria) {
            if (c.status === 'fail') result.principles[p].failed++;
            else if (c.status === 'pass') result.principles[p].passed++;
            else if (c.status === 'manual-review') result.principles[p].manualReview++;
            else result.principles[p].notTested++;
        }
    }

    return result;
}

function renderComplianceReport(r) {
    if (!wcagDb) {
        return '<div style="padding:3rem;text-align:center;color:var(--muted)">Loading WCAG criteria database...</div>';
    }

    const data = buildComplianceData(r);
    if (!data) return '';

    let html = '';

    // Coverage summary
    const totalCriteria = Object.keys(wcagDb.criteria).length;
    const testedTotal = data.testedCriteria.size;
    const failedTotal = Object.keys(data.failedCriteria).length;
    const passedTotal = testedTotal - failedTotal;
    const manualTotal = Object.values(wcagDb.criteria).filter(c => c.testability === 'manual').length;
    const scorePercent = testedTotal > 0 ? Math.round((passedTotal / testedTotal) * 100) : 0;

    html += '<div class="coverage-summary">';
    html += '<span class="coverage-stat">' + testedTotal + '/' + totalCriteria + ' tested</span>';
    html += '<span class="coverage-sep">&middot;</span>';
    html += '<span class="coverage-stat pass">' + passedTotal + ' passing</span>';
    html += '<span class="coverage-sep">&middot;</span>';
    html += '<span class="coverage-stat fail">' + failedTotal + ' failing</span>';
    html += '<span class="coverage-sep">&middot;</span>';
    html += '<span class="coverage-stat manual">' + manualTotal + ' manual review</span>';
    html += '</div>';

    // Level conformance cards
    html += '<div class="compliance-header">';

    // Overall score
    html += '<div class="compliance-score"><div class="score-value">' + scorePercent + '%</div><div class="score-label">Criteria Passing</div></div>';

    html += '<div class="level-cards">';
    for (const level of ['A', 'AA', 'AAA']) {
        const d = data.levels[level];
        const hasFails = d.failed > 0;
        const allPass = d.total > 0 && d.failed === 0 && d.notTested === 0;
        const cls = hasFails ? 'fail' : allPass ? 'pass' : 'partial';
        const label = hasFails ? 'Not Conformant' : allPass ? 'Conformant' : 'Partially Tested';
        html += '<div class="level-card ' + cls + '">';
        html += '<div class="level-card-title">Level ' + level + '</div>';
        html += '<div class="level-card-value">' + label + '</div>';
        html += '<div class="level-card-detail">' + d.total + ' criteria &middot; ' + d.passed + ' pass &middot; ' + d.failed + ' fail</div>';
        html += '</div>';
    }
    html += '</div></div>';

    // Level filter
    html += '<div class="level-filter">';
    for (const level of ['A', 'AA', 'AAA']) {
        html += '<button class="level-filter-btn' + (level === activeLevel ? ' active' : '') + '" data-level="' + level + '">Level ' + level + '</button>';
    }
    html += '</div>';

    // Principles
    const principles = ['Perceivable', 'Operable', 'Understandable', 'Robust'];
    for (const pName of principles) {
        const p = data.principles[pName];
        const filtered = filterCriteriaByLevel(p.criteria, activeLevel);
        if (filtered.length === 0) continue;

        const pFailed = filtered.filter(c => c.status === 'fail').length;
        const pPassed = filtered.filter(c => c.status === 'pass').length;
        const pManualReview = filtered.filter(c => c.status === 'manual-review').length;
        const pNotTested = filtered.filter(c => c.status === 'not-tested').length;

        html += '<div class="principle" data-principle="' + pName + '">';
        html += '<div class="principle-header">';
        html += '<div class="principle-name">' + pName + '</div>';
        let statsText = pPassed + ' pass &middot; ' + pFailed + ' fail';
        if (pManualReview > 0) statsText += ' &middot; ' + pManualReview + ' manual review';
        if (pNotTested > 0) statsText += ' &middot; ' + pNotTested + ' not tested';
        html += '<div class="principle-stats">' + statsText + '</div>';
        html += '</div>';

        html += '<table class="criteria-table">';
        html += '<thead><tr><th>Criterion</th><th>Title</th><th>Level</th><th>Status</th></tr></thead>';
        html += '<tbody>';
        for (const c of filtered) {
            const hasSCText = c.successCriterionText && c.successCriterionText.length > 0;
            html += '<tr class="criterion-row' + (hasSCText ? ' expandable' : '') + '">';
            html += '<td class="criterion-id">' + esc(c.id) + '</td>';
            html += '<td class="criterion-title"><a href="' + esc(c.w3cUrl) + '" target="_blank">' + esc(c.title) + '</a>';
            if (c.violations.length > 0) {
                html += '<div class="criterion-violations"><span>' + c.violations.length + ' violation' + (c.violations.length > 1 ? 's' : '') + '</span>';
                html += ' &mdash; ' + c.violations.map(v => esc(v.help || v.id)).join(', ');
                html += '</div>';
            }
            html += '</td>';
            html += '<td class="criterion-level">' + c.level + '</td>';
            html += '<td><span class="status-badge ' + c.status + '">' + formatStatus(c.status) + '</span></td>';
            html += '</tr>';
            if (hasSCText) {
                html += '<tr class="sc-text-row" style="display:none"><td></td><td colspan="3"><div class="sc-text">' + esc(c.successCriterionText) + '</div></td></tr>';
            }
        }
        html += '</tbody></table></div>';
    }

    return html;
}

function filterCriteriaByLevel(criteria, targetLevel) {
    const levelIncludes = { 'A': ['A'], 'AA': ['A', 'AA'], 'AAA': ['A', 'AA', 'AAA'] };
    const included = levelIncludes[targetLevel] || ['A', 'AA'];
    return criteria.filter(c => included.includes(c.level));
}

function formatStatus(status) {
    if (status === 'fail') return 'Fail';
    if (status === 'pass') return 'Pass';
    if (status === 'manual-review') return 'Manual Review';
    return 'Not Tested';
}

function formatTestability(t) {
    if (t === 'semi-automated') return 'Semi-Auto';
    if (t === 'manual') return 'Manual';
    if (t === 'multi-page') return 'Multi-Page';
    return '';
}

function updateComplianceView() {
    if (!lastResults || !wcagDb) return;
    const container = document.getElementById('tab-compliance');
    if (container) {
        container.innerHTML = renderComplianceReport(lastResults);
        // Re-wire level filter buttons
        container.querySelectorAll('.level-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeLevel = btn.dataset.level;
                container.querySelectorAll('.level-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateComplianceView();
            });
        });
    }
}

function stat(value, label, cls) {
    return '<div class="stat ' + cls + '"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
}

function violation(v) {
    const impact = v.impact || 'minor';
    const nodeCount = v.nodes?.length || 0;
    let html = '<div class="violation ' + impact + '">';
    html += '<div class="violation-header"><span class="violation-title">' + esc(v.help || v.id) + '</span>';
    html += '<div class="violation-meta"><span class="badge ' + impact + '">' + impact + '</span>';
    html += '<span class="count">' + nodeCount + '</span></div></div>';
    html += '<div class="violation-body">';

    if (v.fixSuggestion) {
        const fs = v.fixSuggestion;
        html += '<div class="fix-box">';
        html += '<div class="fix-label">How to fix</div>';
        html += '<div class="fix-text">' + esc(fs.summary) + '</div>';
        if (fs.details && fs.details !== fs.summary) html += '<div class="fix-detail">' + esc(fs.details) + '</div>';
        if (fs.userImpact) html += '<div class="fix-impact">' + esc(fs.userImpact) + '</div>';
        if (fs.wcagCriteria) html += '<div class="fix-wcag">WCAG ' + esc(fs.wcagCriteria) + (fs.wcagLevel ? ' (Level ' + fs.wcagLevel + ')' : '') + '</div>';
        html += '</div>';
    }

    html += '<div class="violation-desc">' + esc(v.description || '');
    if (v.helpUrl) html += ' <a href="' + esc(v.helpUrl) + '" target="_blank">Learn more &rarr;</a>';
    html += '</div>';

    for (const n of (v.nodes || [])) {
        html += '<div class="node">';

        if (n.source?.filePath) {
            html += '<div class="node-source">' + esc(fmtSource(n.source)) + '</div>';
        }

        const compName = n.component && isUserComponent(n.component) ? n.component : null;
        if (compName) {
            const userPath = (n.userComponentPath || []).filter(isUserComponent);
            html += '<div class="node-component">' + esc(compName);
            if (userPath.length > 1) html += ' <span style="color:#999;font-weight:normal;font-size:0.75rem">' + userPath.map(esc).join(' > ') + '</span>';
            html += '</div>';
        }

        if (n.sourceStack?.length > 1) {
            html += '<div class="node-stack">';
            for (const frame of n.sourceStack.slice(0, 5)) {
                const name = frame.componentName && isUserComponent(frame.componentName) ? frame.componentName : '';
                html += '<div class="frame">';
                if (name) html += '<span class="frame-name">' + esc(name) + '</span> ';
                html += '<span class="frame-loc">' + esc(fmtSource(frame)) + '</span>';
                html += '</div>';
            }
            if (n.sourceStack.length > 5) html += '<div class="frame" style="color:#ccc">+ ' + (n.sourceStack.length - 5) + ' more</div>';
            html += '</div>';
        }

        if (n.cssSelector) html += '<div class="node-selector">' + esc(n.cssSelector) + '</div>';
        if (n.htmlSnippet || n.html) html += '<div class="node-html">' + esc(n.htmlSnippet || n.html) + '</div>';
        if (n.failureSummary) html += '<div class="node-failure">' + esc(n.failureSummary) + '</div>';
        if (n.message) html += '<div class="node-failure">' + esc(n.message) + '</div>';

        html += '</div>';
    }

    html += '</div></div>';
    return html;
}

async function copyAsPrompt() {
    if (!lastResults) return;
    const btn = document.querySelector('[onclick="copyAsPrompt()"]');
    const template = document.getElementById('template')?.value || 'fix-all';
    btn.textContent = 'Generating...';
    btn.disabled = true;
    try {
        const res = await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: lastResults, template }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await navigator.clipboard.writeText(data.prompt);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy AI Prompt'; btn.classList.remove('copied'); }, 2000);
    } catch (err) {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Copy AI Prompt'; }, 2000);
    } finally {
        btn.disabled = false;
    }
}

async function copyAsJSON() {
    if (!lastResults) return;
    await navigator.clipboard.writeText(JSON.stringify(lastResults, null, 2));
    const btn = document.querySelector('[onclick="copyAsJSON()"]');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.classList.remove('copied'); }, 2000);
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}
