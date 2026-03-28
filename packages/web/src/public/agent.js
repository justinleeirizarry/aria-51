/**
 * Agent Tab — Client-side logic for autonomous auditing via SSE
 *
 * Reuses stat(), violation(), switchTab(), esc() from scanner.js
 */

const agentUrlInput = document.getElementById('agent-url');
const agentRunBtn = document.getElementById('agent-run');
const agentStatusEl = document.getElementById('agent-status');
const agentLogEl = document.getElementById('agent-log');
const agentResultsEl = document.getElementById('agent-results');

let agentStartTime = 0;
let agentReport = null;

// Mode switching (Scan / Agent)
window.switchMode = function(mode) {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.mode-tab[onclick*="${mode}"]`)?.classList.add('active');
    document.getElementById(`mode-${mode}`)?.classList.add('active');
};

agentUrlInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runAgent(); });

async function runAgent() {
    const url = agentUrlInput?.value.trim();
    if (!url) return;

    const wcagLevel = document.getElementById('agent-wcag')?.value || 'AA';
    const maxPages = parseInt(document.getElementById('agent-pages')?.value) || 10;
    const specialists = document.getElementById('agent-specialists')?.checked || false;

    document.getElementById('topbar-url').textContent = url;
    agentRunBtn.disabled = true;
    agentRunBtn.textContent = 'Running...';
    agentStatusEl.className = 'status active';
    agentStatusEl.textContent = 'Starting agent...';
    agentLogEl.innerHTML = '';
    agentLogEl.className = 'agent-log active';
    agentResultsEl.innerHTML = '';
    agentReport = null;
    agentStartTime = Date.now();

    try {
        const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, wcagLevel, maxPages, specialists }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let report = null;
        let error = null;

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

                const parsed = JSON.parse(data);

                if (event === 'complete') {
                    report = parsed;
                    logEntry('complete', 'Audit complete');
                } else if (event === 'error') {
                    error = parsed;
                    logEntry('error', parsed.error || 'Agent failed');
                } else if (event === 'heartbeat') {
                    // Keep-alive, ignore
                } else {
                    handleAgentEvent(parsed);
                }
            }
        }

        if (error) throw new Error(error.error || 'Agent failed');
        if (!report) throw new Error('No report received');

        agentReport = report;
        agentStatusEl.className = 'status';
        renderAgentReport(report);
    } catch (err) {
        agentStatusEl.className = 'status active error';
        agentStatusEl.textContent = err.message;
    } finally {
        agentRunBtn.disabled = false;
        agentRunBtn.textContent = 'Run Agent';
    }
}

function handleAgentEvent(event) {
    switch (event.type) {
        case 'thinking':
            agentStatusEl.textContent = event.message;
            logEntry('thinking', event.message);
            break;
        case 'tool_call':
            if (event.message) {
                agentStatusEl.textContent = event.message;
                logEntry('tool', event.message);
            } else if (event.tool) {
                logEntry('tool', event.tool + '(' + truncate(JSON.stringify(event.input), 80) + ')');
            }
            break;
        case 'step_complete':
            logEntry('step', 'Step ' + event.stepIndex + ' \u2014 ' + event.toolCalls + ' tool call(s)');
            break;
        case 'specialist_complete':
            logEntry('specialist', 'Specialist "' + event.specialistId + '" finished: ' + event.findings + ' findings');
            break;
        case 'merge_complete':
            logEntry('specialist', 'Merged: ' + event.totalFindings + ' findings (' + event.deduplicatedCount + ' deduplicated)');
            break;
    }
}

function logEntry(type, message) {
    const elapsed = ((Date.now() - agentStartTime) / 1000).toFixed(1);
    const cls = type === 'thinking' ? 'log-thinking'
        : type === 'tool' ? 'log-tool'
        : type === 'specialist' ? 'log-specialist'
        : type === 'error' ? 'log-error'
        : '';
    agentLogEl.innerHTML += '<div class="log-entry"><span class="log-time">' + elapsed + 's</span><span class="' + cls + '">' + esc(message) + '</span></div>';
    agentLogEl.scrollTop = agentLogEl.scrollHeight;
}

// =============================================================================
// Render the final Agent report — reuses stat(), violation(), switchTab() from scanner.js
// =============================================================================

function renderAgentReport(report) {
    let html = '';

    // Summary bar — reuse stat() from scanner.js
    html += '<div class="summary">';
    html += stat(report.totalFindings, 'Findings', report.totalFindings > 0 ? 'critical' : '');
    html += stat(report.findingsByConfidence?.confirmed || 0, 'Confirmed', 'pass');
    html += stat(report.findingsByConfidence?.corroborated || 0, 'Corroborated', '');
    html += stat(report.findingsByConfidence?.['ai-only'] || 0, 'AI-Only', 'moderate');
    html += stat(report.findingsBySeverity?.critical || 0, 'Critical', 'critical');
    html += stat(report.findingsBySeverity?.serious || 0, 'Serious', 'serious');
    html += stat(report.pagesScanned, 'Pages', '');
    html += stat(Math.round(report.scanDurationMs / 1000) + 's', 'Duration', '');
    html += '</div>';

    // Toolbar
    html += '<div class="toolbar">';
    html += '<button class="btn-outline" onclick="copyAgentJSON()">Copy JSON</button>';
    html += '<span class="spacer"></span>';
    html += '</div>';

    // Tabs — reuses existing tab CSS
    html += '<div class="tabs">';
    html += '<button class="tab active" data-tab="agent-findings">Findings</button>';
    html += '<button class="tab" data-tab="agent-remediation">Remediation</button>';
    html += '<button class="tab" data-tab="agent-summary">Summary</button>';
    html += '</div>';

    // Findings tab — group by confidence, then render each as a violation accordion
    html += '<div class="tab-content active" id="tab-agent-findings">';
    html += renderFindingsByConfidence(report.findings || []);
    html += '</div>';

    // Remediation tab
    html += '<div class="tab-content" id="tab-agent-remediation">';
    html += renderRemediationPlan(report.remediationPlan);
    html += '</div>';

    // Summary tab — render markdown
    html += '<div class="tab-content" id="tab-agent-summary">';
    html += '<div class="agent-summary">' + renderMarkdown(report.agentSummary || 'No summary available.') + '</div>';
    html += '</div>';

    agentResultsEl.innerHTML = html;

    // Wire up tabs — reuse switchTab pattern from scanner.js
    agentResultsEl.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            agentResultsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab.dataset.tab));
            agentResultsEl.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab.dataset.tab));
        });
    });

    // Wire up violation accordions
    agentResultsEl.querySelectorAll('.violation-header').forEach(h => {
        h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });
}

// =============================================================================
// Findings grouped by confidence — renders each finding as a violation card
// =============================================================================

function renderFindingsByConfidence(findings) {
    const groups = [
        { key: 'confirmed', label: 'Confirmed \u2014 axe-core agrees', findings: findings.filter(f => f.confidence === 'confirmed') },
        { key: 'corroborated', label: 'Corroborated \u2014 related evidence found', findings: findings.filter(f => f.confidence === 'corroborated') },
        { key: 'ai-only', label: 'AI-Only \u2014 needs manual review', findings: findings.filter(f => f.confidence === 'ai-only') },
        { key: 'contradicted', label: 'Contradicted \u2014 axe-core disagrees', findings: findings.filter(f => f.confidence === 'contradicted') },
    ];

    let html = '';
    for (const group of groups) {
        if (group.findings.length === 0) continue;

        html += '<div class="section-title">' + esc(group.label) + ' (' + group.findings.length + ')</div>';
        html += '<div class="violations">';
        for (const f of group.findings) {
            // Convert agent finding to violation shape for the existing violation() renderer
            html += violation({
                id: f.criterion?.id || 'unknown',
                impact: f.impact,
                help: f.description,
                description: f.evidence || '',
                helpUrl: f.criterion?.w3cUrl || '',
                tags: [],
                nodes: f.selector ? [{
                    html: f.element || '',
                    htmlSnippet: f.element || '',
                    target: [f.selector],
                    failureSummary: 'Confidence: ' + f.confidence + (f.sources?.length ? ' | Sources: ' + f.sources.map(s => s.type).join(', ') : ''),
                    cssSelector: f.selector,
                }] : [],
            });
        }
        html += '</div>';
    }

    if (findings.length === 0) {
        html += '<div style="padding:3rem;text-align:center;color:var(--muted)">No findings from the agent.</div>';
    }

    return html;
}

// =============================================================================
// Remediation plan — reuses existing CSS
// =============================================================================

function renderRemediationPlan(plan) {
    if (!plan) return '<div style="padding:3rem;text-align:center;color:var(--muted)">No remediation plan generated.</div>';

    let html = '<div class="remediation-summary">' + esc(plan.summary) + '</div>';

    for (const phase of (plan.phases || [])) {
        html += '<div class="remediation-phase">';
        html += '<div class="phase-header">Phase ' + phase.priority + ': ' + esc(phase.title) + '</div>';
        if (phase.description) {
            html += '<div class="phase-description">' + esc(phase.description) + '</div>';
        }
        for (const item of (phase.items || [])) {
            const criterion = item.finding?.criterion?.id || '';
            const impact = item.finding?.impact || '';
            const title = item.finding?.criterion?.title || '';
            html += '<div class="phase-item-card">';
            html += '<div class="phase-item-header">';
            html += '<strong>' + esc(criterion) + '</strong>';
            if (title) html += ' <span class="phase-item-title">' + esc(title) + '</span>';
            if (impact) html += ' <span class="badge ' + impact + '">' + impact + '</span>';
            html += ' <span class="effort">' + esc(item.estimatedEffort) + ' effort</span>';
            html += '</div>';
            html += '<div class="phase-item-fix">' + esc(item.fix) + '</div>';
            if (item.affectedPages?.length > 1) {
                html += '<div class="phase-item-pages">' + item.affectedPages.length + ' pages affected</div>';
            }
            html += '</div>';
        }
        html += '</div>';
    }

    return html;
}

// =============================================================================
// Helpers
// =============================================================================

window.copyAgentJSON = async function() {
    if (!agentReport) return;
    await navigator.clipboard.writeText(JSON.stringify(agentReport, null, 2));
    const btn = document.querySelector('[onclick="copyAgentJSON()"]');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.classList.remove('copied'); }, 2000);
};

function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '...' : str;
}

/**
 * Lightweight markdown → HTML renderer.
 * Handles: headings, bold, lists, horizontal rules, paragraphs.
 * No external deps.
 */
function renderMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            if (inList) { html += '</ul>'; inList = false; }
            html += '<hr>';
            continue;
        }

        // Headings
        const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            if (inList) { html += '</ul>'; inList = false; }
            const level = headingMatch[1].length;
            html += '<h' + level + ' class="md-h' + level + '">' + inlineMd(headingMatch[2]) + '</h' + level + '>';
            continue;
        }

        // List item
        if (/^\s*[-*]\s+/.test(line)) {
            if (!inList) { html += '<ul class="md-list">'; inList = true; }
            html += '<li>' + inlineMd(line.replace(/^\s*[-*]\s+/, '')) + '</li>';
            continue;
        }

        // Empty line — close list, add spacing
        if (line.trim() === '') {
            if (inList) { html += '</ul>'; inList = false; }
            continue;
        }

        // Paragraph
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p class="md-p">' + inlineMd(line) + '</p>';
    }

    if (inList) html += '</ul>';
    return html;
}

/** Inline markdown: bold, code, links */
function inlineMd(text) {
    let s = esc(text);
    // Bold: **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Code: `text`
    s = s.replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
    return s;
}
