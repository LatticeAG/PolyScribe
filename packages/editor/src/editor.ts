import type {
  ReviewEditorController,
  ReviewSaveOutcome,
} from "./controller.js";
import type { ReviewEditorState } from "./state.js";
import { ensureReviewEditorStyles } from "./styles.js";
import type {
  ReviewBlock,
  ReviewEvidence,
  ReviewMappingCandidate,
  ReviewQualityTask,
} from "./types.js";
import { createReviewEditorView } from "./view-model.js";

export interface RenderReviewEditorOptions {
  /** Inject the small namespaced default stylesheet. Defaults to true. */
  injectStyles?: boolean;
  /** Called after a successful save, conflict, or persistence failure. */
  onSaveOutcome?: (outcome: ReviewSaveOutcome) => void;
}

export type UnmountReviewEditor = () => void;

function humanize(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function createButton(
  document: Document,
  label: string,
  variant?: "primary" | "danger",
): HTMLButtonElement {
  const button = createElement(document, "button", "ps-review-editor__button");
  button.type = "button";
  button.textContent = label;
  if (variant) {
    button.dataset.variant = variant;
  }
  return button;
}

function createBadge(
  document: Document,
  label: string,
  tone?: "accent" | "warning" | "danger",
): HTMLSpanElement {
  const badge = createElement(document, "span", "ps-review-editor__badge");
  badge.textContent = label;
  if (tone) {
    badge.dataset.tone = tone;
  }
  return badge;
}

function createSectionHeading(
  document: Document,
  id: string,
  title: string,
  subtitle?: string,
): HTMLDivElement {
  const heading = createElement(document, "div", "ps-review-editor__section-heading");
  const content = document.createElement("div");
  const headingText = document.createElement("h2");
  headingText.id = id;
  headingText.className = "ps-review-editor__section-title";
  headingText.textContent = title;
  content.append(headingText);

  if (subtitle) {
    const subtitleText = document.createElement("p");
    subtitleText.className = "ps-review-editor__section-subtitle";
    subtitleText.textContent = subtitle;
    content.append(subtitleText);
  }

  heading.append(content);
  return heading;
}

function formatClaimCount(block: ReviewBlock): string {
  const count = block.claimIds.length;
  return `${count} linked ${count === 1 ? "claim" : "claims"}`;
}

function renderBlock(
  document: Document,
  block: ReviewBlock,
  controller: ReviewEditorController,
  saving: boolean,
): HTMLElement {
  const article = createElement(document, "article", "ps-review-editor__block");
  const heading = createElement(document, "div", "ps-review-editor__block-heading");
  const title = document.createElement("h3");
  title.className = "ps-review-editor__block-title";
  title.textContent = block.section;
  const metadata = createElement(document, "span", "ps-review-editor__block-meta");
  metadata.textContent = formatClaimCount(block);
  heading.append(title, metadata);

  const textarea = createElement(document, "textarea", "ps-review-editor__textarea");
  textarea.value = block.markdown;
  textarea.disabled = saving;
  textarea.setAttribute("aria-label", `${block.section} release-note wording`);
  textarea.addEventListener("change", () => {
    controller.dispatch({
      type: "replace-active-block",
      blockId: block.id,
      markdown: textarea.value,
    });
  });

  const claimText = document.createElement("p");
  claimText.className = "ps-review-editor__block-claims";
  claimText.textContent = `Claims: ${block.claimIds.join(", ") || "none linked"}`;
  article.append(heading, textarea, claimText);
  return article;
}

function renderEvidence(
  document: Document,
  evidence: ReviewEvidence,
  selected: boolean,
  controller: ReviewEditorController,
): HTMLElement {
  const item = createElement(document, "li", "ps-review-editor__evidence");
  item.dataset.selected = String(selected);
  const titleRow = createElement(document, "div", "ps-review-editor__evidence-title-row");
  const title = document.createElement("h3");
  title.className = "ps-review-editor__evidence-title";
  title.textContent = evidence.title;
  titleRow.append(title, createBadge(document, humanize(evidence.visibility)));

  const metadata = createElement(document, "p", "ps-review-editor__evidence-meta");
  metadata.textContent = `${humanize(evidence.kind)} · ${humanize(evidence.authority)}${
    evidence.locator ? ` · ${evidence.locator}` : ""
  }`;
  item.append(titleRow, metadata);

  if (evidence.excerpt) {
    const excerpt = document.createElement("p");
    excerpt.className = "ps-review-editor__excerpt";
    excerpt.textContent = evidence.redacted
      ? "Redacted excerpt: this evidence is available only under its visibility policy."
      : evidence.excerpt;
    item.append(excerpt);
  }

  const actions = createElement(document, "div", "ps-review-editor__evidence-actions");
  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.className = "ps-review-editor__text-button";
  inspect.textContent = selected ? "Selected evidence" : "Inspect evidence";
  inspect.setAttribute("aria-pressed", String(selected));
  inspect.addEventListener("click", () => {
    controller.dispatch({ type: "select-evidence", evidenceId: evidence.id });
  });
  actions.append(inspect);

  if (evidence.sourceUrl) {
    const source = document.createElement("a");
    source.href = evidence.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.className = "ps-review-editor__text-button";
    source.textContent = "Open source";
    actions.append(source);
  }

  item.append(actions);
  return item;
}

function renderMapping(
  document: Document,
  mapping: ReviewMappingCandidate,
  selected: boolean,
  controller: ReviewEditorController,
): HTMLElement {
  const item = createElement(document, "li", "ps-review-editor__mapping");
  item.dataset.selected = String(selected);
  const titleRow = createElement(document, "div", "ps-review-editor__mapping-title-row");
  const title = document.createElement("h3");
  title.className = "ps-review-editor__mapping-title";
  title.textContent = mapping.title;
  const status = createElement(document, "span", "ps-review-editor__status");
  status.dataset.state = mapping.status;
  status.textContent = humanize(mapping.status);
  titleRow.append(title, status);

  const metadata = createElement(document, "p", "ps-review-editor__mapping-meta");
  const confidence = mapping.confidence === undefined
    ? "confidence unavailable"
    : `${Math.round(mapping.confidence)}% confidence`;
  metadata.textContent = `${confidence}${mapping.method ? ` · ${mapping.method}` : ""}`;
  item.append(titleRow, metadata);

  if (mapping.detail) {
    const detail = document.createElement("p");
    detail.className = "ps-review-editor__mapping-detail";
    detail.textContent = mapping.detail;
    item.append(detail);
  }

  const actions = createElement(document, "div", "ps-review-editor__mapping-actions");
  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.className = "ps-review-editor__text-button";
  inspect.textContent = selected ? "Candidate selected" : "Inspect candidate";
  inspect.setAttribute("aria-pressed", String(selected));
  inspect.addEventListener("click", () => {
    controller.dispatch({ type: "select-mapping", mappingId: mapping.id });
  });
  actions.append(inspect);
  item.append(actions);
  return item;
}

function renderQualityTask(
  document: Document,
  task: ReviewQualityTask,
): HTMLElement {
  const item = createElement(document, "li", "ps-review-editor__quality-task");
  const row = createElement(document, "div", "ps-review-editor__quality-title-row");
  const title = document.createElement("h3");
  title.className = "ps-review-editor__quality-task-title";
  title.textContent = task.title;
  const severity = createElement(document, "span", "ps-review-editor__severity");
  severity.dataset.severity = task.severity;
  severity.textContent = humanize(task.severity);
  row.append(title, severity);
  item.append(row);

  if (task.detail) {
    const detail = document.createElement("p");
    detail.className = "ps-review-editor__quality-task-detail";
    detail.textContent = task.detail;
    item.append(detail);
  }

  return item;
}

function renderConflict(
  document: Document,
  state: ReviewEditorState,
  controller: ReviewEditorController,
): HTMLElement | undefined {
  if (!state.conflict) {
    return undefined;
  }

  const conflict = createElement(document, "section", "ps-review-editor__conflict");
  conflict.setAttribute("role", "alert");
  conflict.setAttribute("aria-live", "assertive");
  const title = document.createElement("h2");
  title.textContent = "Another reviewer updated this release";
  const detail = document.createElement("p");
  detail.textContent = `${state.conflict.message} ${state.conflict.changedBlockIds.length} block(s) and ${state.conflict.changedClaimIds.length} claim(s) changed in revision ${state.conflict.currentRevisionId}.`;
  const actions = createElement(document, "div", "ps-review-editor__conflict-actions");
  const restore = createButton(document, "Reapply local wording", "primary");
  restore.addEventListener("click", () => controller.restoreConflictDraft());
  const discard = createButton(document, "Use latest revision");
  discard.addEventListener("click", () => controller.discardConflictDraft());
  actions.append(restore, discard);
  conflict.append(title, detail, actions);
  return conflict;
}

function renderPublishDrawer(
  document: Document,
  state: ReviewEditorState,
  controller: ReviewEditorController,
): HTMLElement | undefined {
  if (!state.isPublishDrawerOpen) {
    return undefined;
  }

  const view = createReviewEditorView(state);
  const backdrop = createElement(document, "div", "ps-review-editor__drawer-backdrop");
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      controller.dispatch({ type: "set-publish-drawer", open: false });
    }
  });

  const drawer = createElement(document, "aside", "ps-review-editor__drawer");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "ps-review-publish-title");
  drawer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      controller.dispatch({ type: "set-publish-drawer", open: false });
    }
  });

  const header = createElement(document, "div", "ps-review-editor__drawer-header");
  const heading = document.createElement("div");
  const title = document.createElement("h2");
  title.id = "ps-review-publish-title";
  title.className = "ps-review-editor__drawer-title";
  title.textContent = "Publish review";
  const description = document.createElement("p");
  description.className = "ps-review-editor__section-subtitle";
  description.textContent = `Preview targets for the ${humanize(view.activeEdition.audience)} edition.`;
  heading.append(title, description);
  const close = createButton(document, "Close");
  close.addEventListener("click", () => {
    controller.dispatch({ type: "set-publish-drawer", open: false });
  });
  header.append(heading, close);
  drawer.append(header);

  const targetList = createElement(document, "ul", "ps-review-editor__target-list");
  if (view.publishingTargets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ps-review-editor__empty";
    empty.textContent = "No publishing targets are configured for this audience.";
    drawer.append(empty);
  } else {
    for (const target of view.publishingTargets) {
      const item = createElement(document, "li", "ps-review-editor__target");
      const row = createElement(document, "div", "ps-review-editor__target-heading");
      const label = document.createElement("h3");
      label.className = "ps-review-editor__target-title";
      label.textContent = target.label;
      const status = createElement(document, "span", "ps-review-editor__status");
      status.dataset.state = target.status;
      status.textContent = humanize(target.status);
      row.append(label, status);
      item.append(row);

      if (target.detail) {
        const detail = document.createElement("p");
        detail.className = "ps-review-editor__target-detail";
        detail.textContent = target.detail;
        item.append(detail);
      }

      if (target.targetUrl) {
        const targetLink = document.createElement("a");
        targetLink.href = target.targetUrl;
        targetLink.target = "_blank";
        targetLink.rel = "noreferrer";
        targetLink.className = "ps-review-editor__text-button";
        targetLink.textContent = "Open published target";
        item.append(targetLink);
      }

      targetList.append(item);
    }
    drawer.append(targetList);
  }

  backdrop.append(drawer);
  return backdrop;
}

/**
 * Mounts a document-first release-review UI into a plain DOM node.
 *
 * It intentionally does not own networking. A host supplies a controller with
 * an optional persistence adapter, leaving PSCF/API integration at the edge.
 */
export function renderReviewEditor(
  container: HTMLElement,
  controller: ReviewEditorController,
  options: RenderReviewEditorOptions = {},
): UnmountReviewEditor {
  const document = container.ownerDocument;
  if (options.injectStyles !== false) {
    ensureReviewEditorStyles(document);
  }

  function render(): void {
    const state = controller.getState();
    const view = createReviewEditorView(state);
    const shell = createElement(document, "div", "ps-review-editor ps-review-editor__shell");
    shell.dataset.status = state.status;

    const header = createElement(document, "header", "ps-review-editor__header");
    header.dataset.region = "release-header";
    header.setAttribute("aria-labelledby", "ps-review-release-title");
    const top = createElement(document, "div", "ps-review-editor__header-top");
    const titleGroup = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "ps-review-editor__eyebrow";
    eyebrow.textContent = "Release review";
    const title = document.createElement("h1");
    title.id = "ps-review-release-title";
    title.className = "ps-review-editor__title";
    title.textContent = view.header.title;
    titleGroup.append(eyebrow, title);

    const actions = createElement(document, "div", "ps-review-editor__header-actions");
    const save = createButton(
      document,
      state.status === "saving" ? "Saving…" : "Save review",
      "primary",
    );
    save.disabled = state.status === "saving";
    save.addEventListener("click", () => {
      void controller.saveActiveEdition().then((outcome) => {
        options.onSaveOutcome?.(outcome);
      });
    });
    const publish = createButton(document, "Publish");
    publish.addEventListener("click", () => {
      controller.dispatch({ type: "set-publish-drawer", open: true });
    });
    actions.append(save, publish);
    top.append(titleGroup, actions);

    const metadata = createElement(document, "div", "ps-review-editor__metadata");
    const range = document.createElement("span");
    const rangeLabel = createElement(document, "span", "ps-review-editor__meta-label");
    rangeLabel.textContent = "Range";
    range.append(rangeLabel);
    range.append(document.createTextNode(view.header.range));
    const completeness = document.createElement("span");
    const completenessLabel = createElement(document, "span", "ps-review-editor__meta-label");
    completenessLabel.textContent = "Sources";
    completeness.append(completenessLabel, createBadge(
      document,
      humanize(view.header.sourceCompleteness),
      view.header.sourceCompleteness === "complete" ? "accent" : "warning",
    ));
    const revision = document.createElement("span");
    const revisionLabel = createElement(document, "span", "ps-review-editor__meta-label");
    revisionLabel.textContent = "Revision";
    revision.append(revisionLabel, document.createTextNode(view.header.revisionId));
    metadata.append(range, completeness, revision, createBadge(document, humanize(view.header.status)));
    header.append(top, metadata);
    shell.append(header);

    const conflict = renderConflict(document, state, controller);
    if (conflict) {
      shell.append(conflict);
    }

    if (state.notice) {
      const notice = document.createElement("p");
      notice.className = "ps-review-editor__notice";
      notice.setAttribute("aria-live", "polite");
      notice.textContent = state.notice;
      shell.append(notice);
    }

    const tabs = createElement(document, "nav", "ps-review-editor__tabs");
    tabs.dataset.region = "audience-tabs";
    tabs.setAttribute("aria-label", "Audience editions");
    tabs.setAttribute("role", "tablist");
    view.editions.forEach((edition, index) => {
      const selected = edition.audience === view.activeEdition.audience;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ps-review-editor__tab";
      tab.id = `ps-review-tab-${index}`;
      tab.textContent = humanize(edition.audience);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("aria-controls", "ps-review-edition-panel");
      tab.tabIndex = selected ? 0 : -1;
      tab.addEventListener("click", () => {
        controller.dispatch({ type: "select-audience", audience: edition.audience });
      });
      tab.addEventListener("keydown", (event) => {
        const nextIndex = getTabIndex(event.key, index, view.editions.length);
        if (nextIndex === undefined) {
          return;
        }
        event.preventDefault();
        const nextAudience = view.editions[nextIndex]!.audience;
        controller.dispatch({ type: "select-audience", audience: nextAudience });
        queueMicrotask(() => {
          container.querySelector<HTMLButtonElement>(`#ps-review-tab-${nextIndex}`)?.focus();
        });
      });
      tabs.append(tab);
    });
    shell.append(tabs);

    const layout = createElement(document, "div", "ps-review-editor__layout");
    const mainColumn = createElement(document, "main", "ps-review-editor__main-column");
    const canvas = createElement(document, "section", "ps-review-editor__canvas");
    canvas.id = "ps-review-edition-panel";
    canvas.dataset.region = "editor-canvas";
    canvas.setAttribute("role", "tabpanel");
    const activeTabIndex = view.editions.findIndex(
      (edition) => edition.audience === view.activeEdition.audience,
    );
    canvas.setAttribute("aria-labelledby", `ps-review-tab-${activeTabIndex}`);
    canvas.append(createSectionHeading(
      document,
      "ps-review-canvas-title",
      `${humanize(view.activeEdition.audience)} edition`,
      `${humanize(view.activeEdition.status)} · ${view.activeEdition.revisionId}`,
    ));
    const blocks = createElement(document, "div", "ps-review-editor__blocks");
    if (view.activeEdition.blocks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ps-review-editor__empty";
      empty.textContent = "This audience has no structured content blocks yet.";
      blocks.append(empty);
    } else {
      for (const block of view.activeEdition.blocks) {
        blocks.append(renderBlock(document, block, controller, state.status === "saving"));
      }
    }
    canvas.append(blocks);
    mainColumn.append(canvas);

    const sideColumn = createElement(document, "div", "ps-review-editor__side-column");
    const evidencePanel = createElement(document, "aside", "ps-review-editor__panel");
    evidencePanel.dataset.region = "evidence-rail";
    evidencePanel.setAttribute("aria-labelledby", "ps-review-evidence-title");
    evidencePanel.append(createSectionHeading(
      document,
      "ps-review-evidence-title",
      "Evidence rail",
      "Trace each statement to its permitted source.",
    ));
    const evidenceList = createElement(document, "ul", "ps-review-editor__evidence-list");
    if (view.evidence.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ps-review-editor__empty";
      empty.textContent = "No evidence records are attached to this review.";
      evidenceList.append(empty);
    } else {
      for (const evidence of view.evidence) {
        evidenceList.append(renderEvidence(
          document,
          evidence,
          state.selectedEvidenceId === evidence.id,
          controller,
        ));
      }
    }
    evidencePanel.append(evidenceList);

    const qualityPanel = createElement(document, "aside", "ps-review-editor__panel");
    qualityPanel.dataset.region = "quality-panel";
    qualityPanel.setAttribute("aria-labelledby", "ps-review-quality-title");
    qualityPanel.append(createSectionHeading(
      document,
      "ps-review-quality-title",
      "Quality",
      view.quality.rubricVersion ? `Rubric ${view.quality.rubricVersion}` : undefined,
    ));
    const score = createElement(document, "p", "ps-review-editor__quality-score");
    const scoreValue = document.createElement("strong");
    scoreValue.textContent = String(Math.round(view.quality.score));
    const scoreLabel = document.createElement("span");
    scoreLabel.textContent = `/ 100 · ${humanize(view.quality.band ?? "needs-review")}`;
    score.append(scoreValue, scoreLabel);
    qualityPanel.append(score);

    if (view.quality.dimensions.length > 0) {
      const dimensions = createElement(document, "div", "ps-review-editor__quality-list");
      for (const dimension of view.quality.dimensions) {
        const row = createElement(document, "div", "ps-review-editor__dimension");
        const label = document.createElement("span");
        label.textContent = dimension.label;
        const dimensionScore = document.createElement("strong");
        dimensionScore.textContent = `${Math.round(dimension.score)}%`;
        const meter = createElement(document, "div", "ps-review-editor__dimension-meter");
        meter.setAttribute("role", "meter");
        meter.setAttribute("aria-label", dimension.label);
        meter.setAttribute("aria-valuemin", "0");
        meter.setAttribute("aria-valuemax", "100");
        meter.setAttribute("aria-valuenow", String(Math.round(dimension.score)));
        const fill = document.createElement("span");
        fill.style.setProperty("--ps-score", `${Math.max(0, Math.min(100, dimension.score))}%`);
        meter.append(fill);
        row.append(label, dimensionScore, meter);
        dimensions.append(row);
      }
      qualityPanel.append(dimensions);
    }

    const qualityTasks = [...view.quality.blockers, ...view.quality.tasks];
    if (qualityTasks.length > 0) {
      const taskList = createElement(document, "ul", "ps-review-editor__quality-list");
      for (const task of qualityTasks) {
        taskList.append(renderQualityTask(document, task));
      }
      qualityPanel.append(taskList);
    }

    const mappingPanel = createElement(document, "aside", "ps-review-editor__panel");
    mappingPanel.dataset.region = "mapping-queue";
    mappingPanel.setAttribute("aria-labelledby", "ps-review-mapping-title");
    mappingPanel.append(createSectionHeading(
      document,
      "ps-review-mapping-title",
      "Mapping queue",
      "Inspect confidence and resolve evidence relationships deliberately.",
    ));
    const mappingList = createElement(document, "ul", "ps-review-editor__mapping-list");
    if (view.mappings.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ps-review-editor__empty";
      empty.textContent = "No mapping candidates need review.";
      mappingList.append(empty);
    } else {
      for (const mapping of view.mappings) {
        mappingList.append(renderMapping(
          document,
          mapping,
          state.selectedMappingId === mapping.id,
          controller,
        ));
      }
    }
    mappingPanel.append(mappingList);

    const historyPanel = createElement(document, "aside", "ps-review-editor__panel");
    historyPanel.dataset.region = "revision-history";
    historyPanel.setAttribute("aria-labelledby", "ps-review-history-title");
    historyPanel.append(createSectionHeading(
      document,
      "ps-review-history-title",
      "Revision history",
      "Every draft, approval, and publication remains traceable.",
    ));
    const historyList = createElement(document, "ol", "ps-review-editor__history-list");
    if (view.revisions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ps-review-editor__empty";
      empty.textContent = "No revision events are available yet.";
      historyList.append(empty);
    } else {
      for (const revisionEntry of view.revisions) {
        const item = createElement(document, "li", "ps-review-editor__history");
        const historyTitle = document.createElement("h3");
        historyTitle.className = "ps-review-editor__history-title";
        historyTitle.textContent = revisionEntry.label ?? humanize(revisionEntry.kind ?? "revision");
        const metadata = createElement(document, "p", "ps-review-editor__history-meta");
        metadata.textContent = `${revisionEntry.actor} · ${revisionEntry.timestamp}`;
        const summary = document.createElement("p");
        summary.className = "ps-review-editor__history-summary";
        summary.textContent = revisionEntry.summary;
        item.append(historyTitle, metadata, summary);
        historyList.append(item);
      }
    }
    historyPanel.append(historyList);

    sideColumn.append(evidencePanel, qualityPanel, mappingPanel, historyPanel);
    layout.append(mainColumn, sideColumn);
    shell.append(layout);

    const drawer = renderPublishDrawer(document, state, controller);
    if (drawer) {
      drawer.dataset.region = "publish-drawer";
      shell.append(drawer);
    }

    container.replaceChildren(shell);
  }

  render();
  const unsubscribe = controller.subscribe(render);
  return () => {
    unsubscribe();
    container.replaceChildren();
  };
}

function getTabIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | undefined {
  if (count === 0) {
    return undefined;
  }

  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (currentIndex + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (currentIndex - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}
