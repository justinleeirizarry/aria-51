import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

export function Layout({ children }: { children: HtmlEscapedString | Promise<HtmlEscapedString> }) {
    return html`<!DOCTYPE html>
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

  /* Tabs */
  .tabs { display: flex; gap: 0; margin-bottom: 3rem; border-bottom: 2px solid var(--border); }
  .tab { padding: 0.875rem 1.5rem; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; border: 2px solid transparent; border-bottom: none; margin-bottom: -2px; background: none; font-family: inherit; color: var(--muted); }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--fg); border-color: var(--border); background: var(--bg); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* Compliance report */
  .compliance-header { display: flex; gap: 2rem; align-items: flex-start; margin-bottom: 3rem; }
  .compliance-score { min-width: 120px; padding: 1.5rem; border: 2px solid var(--border); text-align: center; }
  .compliance-score .score-value { font-size: 2.5rem; font-weight: 700; line-height: 1; }
  .compliance-score .score-label { font-size: 0.625rem; color: var(--muted); margin-top: 0.5rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }

  .level-cards { display: flex; gap: 0; flex: 1; border: 2px solid var(--border); }
  .level-card { flex: 1; padding: 1.5rem; border-right: 2px solid var(--border); }
  .level-card:last-child { border-right: none; }
  .level-card-title { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 0.75rem; }
  .level-card-value { font-size: 2rem; font-weight: 700; line-height: 1; }
  .level-card-detail { font-size: 0.6875rem; color: var(--muted); margin-top: 0.5rem; }
  .level-card.pass .level-card-value { color: var(--green); }
  .level-card.fail .level-card-value { color: var(--red); }
  .level-card.partial .level-card-value { color: var(--orange); }

  /* Principle sections */
  .principle { margin-bottom: 2.5rem; }
  .principle-header { display: flex; align-items: baseline; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--border); margin-bottom: 1rem; }
  .principle-name { font-size: 0.875rem; font-weight: 700; }
  .principle-stats { font-size: 0.6875rem; color: var(--muted); }

  /* Criteria table */
  .criteria-table { width: 100%; border-collapse: collapse; }
  .criteria-table th { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); text-align: left; padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border-light); }
  .criteria-table td { padding: 0.75rem 0.75rem; font-size: 0.9375rem; border-bottom: 1px solid var(--border-light); vertical-align: top; }
  .criteria-table tr:last-child td { border-bottom: none; }
  .criteria-table .criterion-id { font-weight: 600; white-space: nowrap; min-width: 4rem; }
  .criteria-table .criterion-title { }
  .criteria-table .criterion-level { font-size: 0.8125rem; font-weight: 700; white-space: nowrap; }
  .criteria-table a { color: var(--fg); text-decoration: underline; text-underline-offset: 2px; }
  .criteria-table a:hover { text-decoration-thickness: 2px; }

  .status-badge { font-size: 0.6875rem; padding: 0.25rem 0.625rem; border: 1.5px solid; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; display: inline-block; }
  .status-badge.fail { border-color: var(--red); color: var(--red); }
  .status-badge.pass { border-color: var(--green); color: var(--green); }
  .status-badge.not-tested { border-color: var(--border-light); color: #999; }
  .status-badge.manual-review { border-color: #b08d00; color: #b08d00; }

  .criterion-violations { font-size: 0.8125rem; color: var(--muted); margin-top: 0.25rem; }
  .criterion-violations span { color: var(--red); font-weight: 600; }

  /* Coverage summary */
  .coverage-summary { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; font-size: 0.875rem; font-weight: 600; }
  .coverage-sep { color: var(--border-light); }
  .coverage-stat.pass { color: var(--green); }
  .coverage-stat.fail { color: var(--red); }
  .coverage-stat.manual { color: #b08d00; }

  /* Testability badges */
  .testability-badge { font-size: 0.625rem; padding: 0.1875rem 0.4375rem; border: 1px solid; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; vertical-align: middle; margin-left: 0.375rem; }
  .testability-badge.semi-automated { border-color: var(--blue, #4a90d9); color: var(--blue, #4a90d9); }
  .testability-badge.manual { border-color: #b08d00; color: #b08d00; }
  .testability-badge.multi-page { border-color: #8b5cf6; color: #8b5cf6; }

  /* Expandable criterion rows */
  .criterion-row.expandable { cursor: pointer; }
  .criterion-row.expandable:hover { background: var(--surface, rgba(255,255,255,0.02)); }
  .criterion-row.expandable .criterion-id::before { content: '\\25B8  '; font-size: 0.625rem; color: var(--muted); }
  .criterion-row.expanded .criterion-id::before { content: '\\25BE  '; }
  .sc-text { font-size: 0.875rem; color: var(--muted); line-height: 1.6; padding: 0.75rem 0; white-space: pre-line; }

  /* Level filter */
  .level-filter { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
  .level-filter-btn { padding: 0.5rem 1rem; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; border: 2px solid var(--border); background: none; font-family: inherit; }
  .level-filter-btn:hover { background: var(--surface); }
  .level-filter-btn.active { background: var(--fg); color: var(--bg); }
</style>
</head>
<body>
${children}
</body>
</html>`;
}
