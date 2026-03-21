import { html } from 'hono/html';
import { Layout } from './layout.js';

export function ScannerPage() {
    return Layout({ children: html`
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
    <div class="scan-options">
        <label class="checkbox-label">
            <input type="checkbox" id="stagehand-toggle">
            <span>AI-powered tests</span>
            <span class="option-hint">(keyboard, tree, screen reader — requires OPENAI_API_KEY)</span>
        </label>
    </div>
    <div class="status" id="status"></div>
    <div id="results"></div>
</div>
<script src="/scanner.js"></script>
` });
}
