export const REVIEW_EDITOR_STYLE_ID = "polyscribe-review-editor-styles";

/**
 * The editor deliberately owns a small, namespaced stylesheet so it can be
 * mounted in a plain HTML page without a CSS framework or application-wide
 * reset. Hosts may skip injection and provide their own styles instead.
 */
export const reviewEditorStyles = `
.ps-review-editor {
  --ps-bg: #f5f5f2;
  --ps-surface: #ffffff;
  --ps-surface-subtle: #f8f8f6;
  --ps-ink: #1b1e1d;
  --ps-muted: #676d69;
  --ps-line: #d9ddd8;
  --ps-line-strong: #bbc3bc;
  --ps-accent: #135c47;
  --ps-accent-strong: #0d4938;
  --ps-accent-soft: #e5f2ec;
  --ps-warning: #915500;
  --ps-warning-soft: #fff2d7;
  --ps-danger: #a32f25;
  --ps-danger-soft: #fce8e5;
  --ps-radius: 12px;
  --ps-shadow: 0 1px 2px rgb(24 31 27 / 6%), 0 10px 28px rgb(24 31 27 / 5%);
  box-sizing: border-box;
  color: var(--ps-ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}

.ps-review-editor *,
.ps-review-editor *::before,
.ps-review-editor *::after {
  box-sizing: inherit;
}

.ps-review-editor button,
.ps-review-editor textarea {
  font: inherit;
}

.ps-review-editor button {
  cursor: pointer;
}

.ps-review-editor button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ps-review-editor button:focus-visible,
.ps-review-editor textarea:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ps-accent) 45%, transparent);
  outline-offset: 2px;
}

.ps-review-editor__shell {
  display: grid;
  gap: 18px;
  min-height: 100%;
  padding: clamp(16px, 2.4vw, 32px);
  background: var(--ps-bg);
}

.ps-review-editor__header,
.ps-review-editor__panel,
.ps-review-editor__canvas,
.ps-review-editor__drawer {
  border: 1px solid var(--ps-line);
  border-radius: var(--ps-radius);
  background: var(--ps-surface);
  box-shadow: var(--ps-shadow);
}

.ps-review-editor__header {
  display: grid;
  gap: 16px;
  padding: clamp(18px, 2.5vw, 30px);
}

.ps-review-editor__header-top,
.ps-review-editor__header-actions,
.ps-review-editor__metadata,
.ps-review-editor__section-heading,
.ps-review-editor__block-heading,
.ps-review-editor__target-heading,
.ps-review-editor__conflict-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ps-review-editor__header-top {
  justify-content: space-between;
  gap: 24px;
}

.ps-review-editor__eyebrow,
.ps-review-editor__meta-label,
.ps-review-editor__block-meta,
.ps-review-editor__target-meta,
.ps-review-editor__history-meta {
  color: var(--ps-muted);
  font-size: 0.79rem;
  letter-spacing: 0.02em;
}

.ps-review-editor__eyebrow {
  margin: 0 0 4px;
  font-weight: 650;
  text-transform: uppercase;
}

.ps-review-editor__title {
  margin: 0;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: clamp(1.7rem, 2.8vw, 2.65rem);
  font-weight: 620;
  letter-spacing: -0.035em;
  line-height: 1.04;
}

.ps-review-editor__metadata {
  flex-wrap: wrap;
  gap: 8px 18px;
}

.ps-review-editor__metadata > span {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.ps-review-editor__badge,
.ps-review-editor__status,
.ps-review-editor__severity {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 720;
  letter-spacing: 0.015em;
  line-height: 1;
  white-space: nowrap;
}

.ps-review-editor__badge,
.ps-review-editor__status {
  border: 1px solid var(--ps-line-strong);
  background: var(--ps-surface-subtle);
  color: var(--ps-ink);
}

.ps-review-editor__badge[data-tone="accent"],
.ps-review-editor__status[data-state="approved"],
.ps-review-editor__status[data-state="published"] {
  border-color: #a7d4bf;
  background: var(--ps-accent-soft);
  color: var(--ps-accent-strong);
}

.ps-review-editor__badge[data-tone="warning"],
.ps-review-editor__status[data-state="needs_changes"],
.ps-review-editor__status[data-state="blocked"] {
  border-color: #efcf95;
  background: var(--ps-warning-soft);
  color: var(--ps-warning);
}

.ps-review-editor__badge[data-tone="danger"],
.ps-review-editor__severity[data-severity="blocker"] {
  border: 1px solid #edb9b3;
  background: var(--ps-danger-soft);
  color: var(--ps-danger);
}

.ps-review-editor__severity[data-severity="high"] {
  background: var(--ps-warning-soft);
  color: var(--ps-warning);
}

.ps-review-editor__severity[data-severity="medium"],
.ps-review-editor__severity[data-severity="low"] {
  background: var(--ps-surface-subtle);
  color: var(--ps-muted);
}

.ps-review-editor__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--ps-line-strong);
  border-radius: 8px;
  background: var(--ps-surface);
  color: var(--ps-ink);
  font-size: 0.87rem;
  font-weight: 650;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
}

.ps-review-editor__button:active {
  transform: scale(0.975);
}

.ps-review-editor__button[data-variant="primary"] {
  border-color: var(--ps-accent);
  background: var(--ps-accent);
  color: #fff;
}

.ps-review-editor__button[data-variant="danger"] {
  border-color: #dca39d;
  background: #fff;
  color: var(--ps-danger);
}

@media (hover: hover) and (pointer: fine) {
  .ps-review-editor__button:hover:not(:disabled) {
    border-color: var(--ps-accent);
    color: var(--ps-accent-strong);
  }

  .ps-review-editor__button[data-variant="primary"]:hover:not(:disabled) {
    border-color: var(--ps-accent-strong);
    background: var(--ps-accent-strong);
    color: #fff;
  }
}

.ps-review-editor__tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px;
  border: 1px solid var(--ps-line);
  border-radius: 10px;
  background: var(--ps-surface-subtle);
}

.ps-review-editor__tab {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 7px 11px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ps-muted);
  font-size: 0.88rem;
  font-weight: 660;
  transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.ps-review-editor__tab[aria-selected="true"] {
  background: var(--ps-surface);
  box-shadow: 0 1px 2px rgb(21 30 24 / 9%);
  color: var(--ps-ink);
}

.ps-review-editor__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.75fr);
  gap: 18px;
  align-items: start;
}

.ps-review-editor__main-column,
.ps-review-editor__side-column {
  display: grid;
  gap: 18px;
}

.ps-review-editor__canvas {
  padding: clamp(18px, 2.2vw, 28px);
}

.ps-review-editor__panel {
  padding: 18px;
}

.ps-review-editor__section-heading {
  justify-content: space-between;
  margin-bottom: 14px;
}

.ps-review-editor__section-title {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 760;
  letter-spacing: -0.01em;
}

.ps-review-editor__section-subtitle {
  margin: 3px 0 0;
  color: var(--ps-muted);
  font-size: 0.82rem;
}

.ps-review-editor__blocks,
.ps-review-editor__evidence-list,
.ps-review-editor__mapping-list,
.ps-review-editor__history-list,
.ps-review-editor__quality-list,
.ps-review-editor__target-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ps-review-editor__block,
.ps-review-editor__evidence,
.ps-review-editor__mapping,
.ps-review-editor__history,
.ps-review-editor__quality-task,
.ps-review-editor__target {
  border: 1px solid var(--ps-line);
  border-radius: 9px;
  background: var(--ps-surface);
}

.ps-review-editor__block {
  padding: 14px;
}

.ps-review-editor__block-heading {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.ps-review-editor__block-title,
.ps-review-editor__evidence-title,
.ps-review-editor__mapping-title,
.ps-review-editor__quality-task-title,
.ps-review-editor__target-title,
.ps-review-editor__history-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 720;
}

.ps-review-editor__textarea {
  display: block;
  width: 100%;
  min-height: 114px;
  resize: vertical;
  padding: 11px;
  border: 1px solid var(--ps-line-strong);
  border-radius: 7px;
  background: #fff;
  color: var(--ps-ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
  line-height: 1.55;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.ps-review-editor__textarea:focus {
  border-color: var(--ps-accent);
}

.ps-review-editor__block-claims {
  margin: 9px 0 0;
  color: var(--ps-muted);
  font-size: 0.77rem;
}

.ps-review-editor__empty {
  margin: 0;
  color: var(--ps-muted);
  font-size: 0.86rem;
}

.ps-review-editor__evidence,
.ps-review-editor__mapping,
.ps-review-editor__history,
.ps-review-editor__quality-task,
.ps-review-editor__target {
  padding: 12px;
}

.ps-review-editor__evidence[data-selected="true"],
.ps-review-editor__mapping[data-selected="true"] {
  border-color: var(--ps-accent);
  box-shadow: inset 3px 0 0 var(--ps-accent);
}

.ps-review-editor__evidence-title-row,
.ps-review-editor__mapping-title-row,
.ps-review-editor__quality-title-row,
.ps-review-editor__target-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.ps-review-editor__evidence-meta,
.ps-review-editor__mapping-meta,
.ps-review-editor__target-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 9px;
  margin: 6px 0 0;
  color: var(--ps-muted);
  font-size: 0.76rem;
}

.ps-review-editor__excerpt,
.ps-review-editor__mapping-detail,
.ps-review-editor__quality-task-detail,
.ps-review-editor__target-detail,
.ps-review-editor__history-summary {
  margin: 8px 0 0;
  color: var(--ps-muted);
  font-size: 0.82rem;
}

.ps-review-editor__evidence-actions,
.ps-review-editor__mapping-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.ps-review-editor__text-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ps-accent);
  font-size: 0.79rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ps-review-editor__quality-score {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0 0 14px;
}

.ps-review-editor__quality-score strong {
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: 2.15rem;
  letter-spacing: -0.04em;
}

.ps-review-editor__quality-score span {
  color: var(--ps-muted);
  font-size: 0.84rem;
}

.ps-review-editor__dimension {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  align-items: center;
  color: var(--ps-muted);
  font-size: 0.78rem;
}

.ps-review-editor__dimension-meter {
  grid-column: 1 / -1;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7e9e5;
}

.ps-review-editor__dimension-meter > span {
  display: block;
  width: var(--ps-score, 0%);
  height: 100%;
  border-radius: inherit;
  background: var(--ps-accent);
}

.ps-review-editor__conflict {
  padding: 14px;
  border: 1px solid #edb9b3;
  border-radius: 9px;
  background: var(--ps-danger-soft);
}

.ps-review-editor__conflict h2,
.ps-review-editor__conflict p {
  margin: 0;
}

.ps-review-editor__conflict h2 {
  color: var(--ps-danger);
  font-size: 0.92rem;
}

.ps-review-editor__conflict p {
  margin-top: 5px;
  color: #713129;
  font-size: 0.83rem;
}

.ps-review-editor__conflict-actions {
  flex-wrap: wrap;
  margin-top: 11px;
}

.ps-review-editor__notice {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--ps-accent);
  color: var(--ps-muted);
  font-size: 0.83rem;
}

.ps-review-editor__drawer-backdrop {
  position: fixed;
  z-index: 10;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  padding: 16px;
  background: rgb(19 29 24 / 32%);
}

.ps-review-editor__drawer {
  width: min(480px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 20px;
}

.ps-review-editor__drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.ps-review-editor__drawer-title {
  margin: 0;
  font-size: 1.08rem;
}

.ps-review-editor__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 960px) {
  .ps-review-editor__layout {
    grid-template-columns: 1fr;
  }

  .ps-review-editor__side-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .ps-review-editor__shell {
    padding: 12px;
  }

  .ps-review-editor__header-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .ps-review-editor__header-actions {
    flex-wrap: wrap;
  }

  .ps-review-editor__side-column {
    grid-template-columns: 1fr;
  }

  .ps-review-editor__drawer-backdrop {
    padding: 0;
  }

  .ps-review-editor__drawer {
    max-height: 100vh;
    border-radius: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ps-review-editor *,
  .ps-review-editor *::before,
  .ps-review-editor *::after {
    scroll-behavior: auto !important;
    transition-duration: 0ms !important;
  }
}
`;

export function ensureReviewEditorStyles(document: Document): HTMLStyleElement {
  const existing = document.getElementById(REVIEW_EDITOR_STYLE_ID);
  if (existing?.tagName === "STYLE") {
    return existing as HTMLStyleElement;
  }

  const style = document.createElement("style");
  style.id = REVIEW_EDITOR_STYLE_ID;
  style.textContent = reviewEditorStyles;
  (document.head ?? document.documentElement).append(style);
  return style;
}
