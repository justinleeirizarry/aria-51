import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runScanAsPromise, AppLayer, generatePrompt } from '@accessibility-toolkit/core';
import { getComponentBundlePath } from '@accessibility-toolkit/react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();
app.use('*', cors());

app.get('/', (c) => {
    return c.html(PAGE_HTML);
});

app.get('/fonts/Satoshi-Variable.ttf', async (c) => {
    const fontPath = join(__dirname, 'public/fonts/Satoshi-Variable.ttf');
    const font = await readFile(fontPath);
    return new Response(font, { headers: { 'Content-Type': 'font/ttf', 'Cache-Control': 'public, max-age=31536000' } });
});

app.post('/api/scan', async (c) => {
    const body = await c.req.json();
    const { url, components = true } = body as { url: string; components?: boolean };

    if (!url) {
        return c.json({ error: 'URL is required' }, 400);
    }

    // SSE streaming response for progress updates
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            runScanAsPromise({
                url,
                browser: 'chromium',
                headless: true,
                includeKeyboardTests: true,
                componentBundlePath: components !== false ? getComponentBundlePath() : undefined,
                onProgress: (step) => {
                    send('progress', step);
                },
            }, AppLayer).then(({ results }) => {
                send('result', results);
                controller.close();
            }).catch((error: any) => {
                send('error', { error: error.message || 'Scan failed' });
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
});

app.post('/api/prompt', async (c) => {
    const body = await c.req.json();
    const { results, template = 'fix-all' } = body as { results: any; template?: string };

    try {
        const prompt = generatePrompt(results, template);
        return c.json({ prompt });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

const port = 3847;
console.log(`Accessibility Scanner running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });

const PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Scanner</title>
<style>
  @font-face {
    font-family: 'Satoshi';
    src: url('/fonts/Satoshi-Variable.ttf') format('truetype');
    font-weight: 300 900;
    font-display: swap;
  }
  :root {
    --bg: #ffffff;
    --fg: #000000;
    --muted: #555;
    --border: #000000;
    --border-light: #ddd;
    --surface: #f5f5f5;
    --accent: #000000;
    --red: #cc0000;
    --orange: #cc5500;
    --yellow: #997700;
    --green: #006600;
    --blue: #0044cc;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; font-size: 14px; }

  /* Top bar */
  .topbar { border-bottom: 2px solid var(--border); padding: 1rem 2.5rem; display: flex; align-items: center; gap: 1rem; }
  .topbar-title { font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
  .topbar-sep { color: var(--border-light); }
  .topbar-url { font-size: 0.875rem; color: var(--muted); font-weight: 400; }

  .container { max-width: 960px; margin: 0 auto; padding: 4rem 2.5rem; }

  /* Search */
  .search { display: flex; gap: 0; margin-bottom: 4rem; }
  .search input { flex: 1; padding: 1.125rem 1.25rem; background: var(--bg); border: 2px solid var(--border); border-right: none; border-radius: 0; font-size: 1rem; font-family: inherit; color: var(--fg); outline: none; }
  .search input:focus { background: var(--surface); }
  .search input::placeholder { color: #aaa; }
  .btn { padding: 1.125rem 2rem; background: var(--fg); color: var(--bg); border: 2px solid var(--border); border-radius: 0; font-size: 0.875rem; font-weight: 700; font-family: inherit; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; }
  .btn:hover { background: #333; }
  .btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Status */
  .status { padding: 1.25rem 1.5rem; border: 2px solid var(--border); margin-bottom: 3rem; font-size: 0.875rem; color: var(--muted); display: none; }
  .status.active { display: block; }
  .status.error { color: var(--red); border-color: var(--red); }

  /* Toolbar */
  .toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 3rem; }
  .toolbar .spacer { flex: 1; }
  .btn-outline { padding: 0.625rem 1rem; background: none; color: var(--fg); border: 2px solid var(--border); border-radius: 0; font-size: 0.6875rem; font-weight: 700; font-family: inherit; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; }
  .btn-outline:hover { background: var(--fg); color: var(--bg); }
  .btn-outline:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-outline.copied { background: var(--green); color: var(--bg); border-color: var(--green); }
  select.select-sm { padding: 0.625rem 0.75rem; font-size: 0.6875rem; font-family: inherit; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: var(--bg); color: var(--fg); border: 2px solid var(--border); border-radius: 0; outline: none; cursor: pointer; }

  /* Summary grid */
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0; margin-bottom: 4rem; border: 2px solid var(--border); }
  .stat { padding: 2rem; border-right: 2px solid var(--border); }
  .stat:last-child { border-right: none; }
  .stat-value { font-size: 3rem; font-weight: 700; line-height: 1; }
  .stat-label { font-size: 0.625rem; color: var(--muted); margin-top: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
  .stat.critical .stat-value { color: var(--red); }
  .stat.serious .stat-value { color: var(--orange); }
  .stat.moderate .stat-value { color: var(--yellow); }
  .stat.pass .stat-value { color: var(--green); }

  /* Section */
  .section-title { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--fg); margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--border); }

  /* Violations */
  .violations { display: flex; flex-direction: column; gap: 0; }
  .violation { border: 2px solid var(--border); margin-bottom: -2px; }
  .violation-header { padding: 1.25rem 1.5rem; cursor: pointer; display: flex; align-items: baseline; gap: 1rem; }
  .violation-header:hover { background: var(--surface); }
  .violation-title { font-weight: 600; font-size: 0.9375rem; flex: 1; }
  .violation-meta { display: flex; gap: 0.75rem; align-items: center; flex-shrink: 0; }
  .badge { font-size: 0.5625rem; padding: 0.25rem 0.625rem; border: 2px solid; border-radius: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .badge.critical { border-color: var(--red); color: var(--red); }
  .badge.serious { border-color: var(--orange); color: var(--orange); }
  .badge.moderate { border-color: var(--yellow); color: var(--yellow); }
  .badge.minor { border-color: var(--blue); color: var(--blue); }
  .count { font-size: 0.75rem; color: #999; }

  .violation-body { padding: 0 1.5rem 2rem; display: none; }
  .violation.open .violation-body { display: block; }

  /* Fix box */
  .fix-box { border: 2px solid var(--green); padding: 1.5rem; margin-bottom: 1.5rem; margin-top: 0.5rem; }
  .fix-box .fix-label { font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--green); margin-bottom: 0.625rem; }
  .fix-box .fix-text { font-size: 0.875rem; color: var(--fg); line-height: 1.6; }
  .fix-box .fix-detail { font-size: 0.8125rem; color: var(--muted); margin-top: 0.5rem; line-height: 1.6; }
  .fix-box .fix-impact { font-size: 0.8125rem; color: var(--muted); margin-top: 0.75rem; font-style: italic; }
  .fix-box .fix-wcag { font-size: 0.75rem; color: var(--green); margin-top: 0.625rem; font-weight: 700; }

  .violation-desc { font-size: 0.8125rem; color: var(--muted); margin-bottom: 1.5rem; line-height: 1.6; }
  .violation-desc a { color: var(--fg); text-decoration: underline; text-underline-offset: 2px; }
  .violation-desc a:hover { text-decoration-thickness: 2px; }

  /* Instance nodes */
  .node { border: 1px solid var(--border-light); padding: 1.5rem; margin-bottom: 1rem; }
  .node-source { color: var(--blue); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.625rem; }
  .node-component { color: var(--fg); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; }
  .node-stack { font-size: 0.75rem; color: #999; margin-bottom: 0.75rem; padding-left: 1rem; border-left: 3px solid var(--border-light); }
  .node-stack .frame { margin-bottom: 0.25rem; }
  .node-stack .frame-name { color: var(--muted); }
  .node-stack .frame-loc { color: var(--blue); }
  .node-selector { color: #999; font-size: 0.75rem; margin-bottom: 0.5rem; }
  .node-html { font-size: 0.75rem; color: var(--muted); background: var(--surface); border: 1px solid var(--border-light); padding: 1rem; overflow-x: auto; white-space: pre; margin-bottom: 0.75rem; max-height: 6rem; overflow-y: auto; line-height: 1.6; }
  .node-failure { color: var(--orange); font-size: 0.8125rem; line-height: 1.6; }
</style>
</head>
<body>
<div class="topbar">
    <span class="topbar-title">Accessibility Scanner</span>
    <span class="topbar-sep">/</span>
    <span class="topbar-url" id="topbar-url">Enter a URL to scan</span>
</div>
<div class="container">
    <div class="search">
        <input type="url" id="url" placeholder="https://example.com" autofocus>
        <button class="btn" id="scan" onclick="runScan()">Scan</button>
    </div>
    <div class="status" id="status"></div>
    <div id="results"></div>
</div>
<script>
const $ = s => document.querySelector(s);
const urlInput = $('#url');
const scanBtn = $('#scan');
const statusEl = $('#status');
const resultsEl = $('#results');
let lastResults = null;

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
            body: JSON.stringify({ url }),
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
            while ((boundary = buffer.indexOf('\\n\\n')) !== -1) {
                const message = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                let event = 'message';
                let data = '';
                for (const line of message.split('\\n')) {
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

    resultsEl.innerHTML = html;
    resultsEl.querySelectorAll('.violation-header').forEach(h => {
        h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });
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
</script>
</body>
</html>`;
