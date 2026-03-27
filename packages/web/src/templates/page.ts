import { html } from 'hono/html';
import { Layout } from './layout.js';

export function ScannerPage() {
    return Layout({ children: html`
<div class="topbar">
    <span class="topbar-title">aria51</span>
    <span class="topbar-sep">/</span>
    <span class="topbar-url" id="topbar-url">Enter a URL to scan</span>
</div>
<div class="container">
    <div class="mode-tabs">
        <button class="mode-tab active" onclick="switchMode('scan')">Scan</button>
        <button class="mode-tab" onclick="switchMode('agent')">Agent</button>
    </div>

    <!-- Scan mode (existing) -->
    <div id="mode-scan" class="mode-content active">
        <div class="search">
            <input type="url" id="url" placeholder="https://example.com" autofocus>
            <button class="btn" id="scan" onclick="runScan()">Scan</button>
        </div>
        <div class="scan-options">
            <input type="checkbox" id="stagehand-toggle" hidden>
            <button class="toggle-btn" id="stagehand-btn" onclick="document.getElementById('stagehand-toggle').checked = !document.getElementById('stagehand-toggle').checked; this.classList.toggle('active', document.getElementById('stagehand-toggle').checked);">AI-POWERED TESTS</button>
            <span class="option-hint">keyboard, tree, screen reader — requires OPENAI_API_KEY</span>
        </div>
        <div class="status" id="status"></div>
        <div id="results"></div>
    </div>

    <!-- Agent mode (new) -->
    <div id="mode-agent" class="mode-content">
        <div class="search">
            <input type="url" id="agent-url" placeholder="https://example.com">
            <button class="btn" id="agent-run" onclick="runAgent()">Run Agent</button>
        </div>
        <div class="agent-options">
            <label class="option-label">WCAG Level
                <select id="agent-wcag" class="select-sm">
                    <option value="A">A</option>
                    <option value="AA" selected>AA</option>
                    <option value="AAA">AAA</option>
                </select>
            </label>
            <label class="option-label">Max Pages
                <input type="number" id="agent-pages" value="10" min="1" max="50" class="input-sm">
            </label>
            <label class="option-label">
                <input type="checkbox" id="agent-specialists">
                Multi-Specialist Mode
            </label>
        </div>
        <div class="status" id="agent-status"></div>
        <div id="agent-log" class="agent-log"></div>
        <div id="agent-results"></div>
    </div>
</div>
<script src="/scanner.js"></script>
<script src="/agent.js"></script>
` });
}
