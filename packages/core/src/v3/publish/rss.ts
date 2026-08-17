import type {
  PublicationPlan,
  PublicationReceipt,
  PublicationTarget,
  PublicationValidation,
} from "./types.js";
import { hasValidArtifactHash } from "./types.js";

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  language?: string;
}

export interface RssTargetConfig {
  channel: RssChannel;
  itemUrl: string;
  publishedAt?: string;
}

export interface RssFeedStore {
  read(): Promise<string | undefined>;
  write(feed: string, idempotencyKey: string): Promise<{ url?: string }>;
}

export function createRssPublisher(
  store: RssFeedStore,
  id = "rss",
): PublicationTarget<RssTargetConfig> {
  return {
    id,
    kind: "rss",
    validate(plan) {
      return validateRssPlan(plan);
    },
    preview(plan) {
      return plan.artifact;
    },
    async publish(plan) {
      const validation = validateRssPlan(plan);
      if (!validation.ok) return failedReceipt(plan, validation.blockers.join(" "));
      try {
        const existing = await store.read();
        const feed = renderRssFeed(plan, existing);
        const write = await store.write(feed, plan.idempotencyKey);
        return {
          status: "succeeded",
          targetId: plan.targetId,
          idempotencyKey: plan.idempotencyKey,
          contentHash: plan.artifact.contentHash,
          publishedAt: new Date().toISOString(),
          remoteId: rssGuid(plan),
          remoteUrl: write.url ?? plan.configuration.itemUrl,
        };
      } catch (error) {
        return failedReceipt(plan, error instanceof Error ? error.message : "RSS publication failed.", true);
      }
    },
    async reconcile(plan) {
      try {
        const existing = await store.read();
        if (!existing?.includes(`<guid isPermaLink="false">${escapeXml(rssGuid(plan))}</guid>`)) {
          return undefined;
        }
        return {
          status: "succeeded",
          targetId: plan.targetId,
          idempotencyKey: plan.idempotencyKey,
          contentHash: plan.artifact.contentHash,
          publishedAt: new Date().toISOString(),
          remoteId: rssGuid(plan),
          remoteUrl: plan.configuration.itemUrl,
        };
      } catch (error) {
        return failedReceipt(plan, error instanceof Error ? error.message : "RSS reconciliation failed.", true);
      }
    },
  };
}

export function validateRssPlan(plan: PublicationPlan<RssTargetConfig>): PublicationValidation {
  const blockers: string[] = [];
  if (!plan.approved) blockers.push("The edition revision has not been approved.");
  if (plan.artifact.visibility !== "public") {
    blockers.push("An RSS feed can only receive a public edition artifact.");
  }
  if (!plan.configuration.channel.title || !plan.configuration.channel.link || !plan.configuration.itemUrl) {
    blockers.push("RSS channel title, link, and item URL are required.");
  }
  if (!hasValidArtifactHash(plan.artifact)) {
    blockers.push("The rendered artifact content hash does not match its content.");
  }
  return { ok: blockers.length === 0, warnings: [], blockers };
}

/**
 * Deterministically creates a single-item feed. A store may merge this item
 * into a larger feed; the stable GUID allows correction/update semantics.
 */
export function renderRssFeed(plan: PublicationPlan<RssTargetConfig>, _existing?: string): string {
  const { channel, itemUrl, publishedAt } = plan.configuration;
  const date = new Date(publishedAt ?? plan.createdAt).toUTCString();
  const title = `${plan.artifact.audience} changelog`;
  const item = [
    '<item>',
    `<title>${escapeXml(title)}</title>`,
    `<link>${escapeXml(itemUrl)}</link>`,
    `<guid isPermaLink="false">${escapeXml(rssGuid(plan))}</guid>`,
    `<pubDate>${escapeXml(date)}</pubDate>`,
    `<description><![CDATA[${safeCdata(plan.artifact.content)}]]></description>`,
    '</item>',
  ].join("\n");

  if (_existing && /<rss\b/i.test(_existing) && /<\/channel>/i.test(_existing)) {
    const guid = `<guid isPermaLink="false">${escapeXml(rssGuid(plan))}</guid>`;
    const existingItems = _existing.replace(/\s*<item\b[\s\S]*?<\/item>/gi, (block) =>
      block.includes(guid) ? "" : block,
    );
    return existingItems.replace(/<\/channel>/i, `${item}\n</channel>`);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml(channel.title)}</title>`,
    `<link>${escapeXml(channel.link)}</link>`,
    `<description>${escapeXml(channel.description)}</description>`,
    channel.language ? `<language>${escapeXml(channel.language)}</language>` : "",
    item,
    '</channel>',
    '</rss>',
  ].filter(Boolean).join("\n");
}

export function rssGuid(plan: PublicationPlan<RssTargetConfig>): string {
  return `polyscribe:${plan.artifact.contentRevisionId}:${plan.artifact.editionRevisionId}:${plan.artifact.contentHash}`;
}

function safeCdata(value: string): string {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function failedReceipt(
  plan: PublicationPlan<RssTargetConfig>,
  message: string,
  retryable = false,
): PublicationReceipt {
  return {
    status: retryable ? "retryable_failed" : "failed",
    targetId: plan.targetId,
    idempotencyKey: plan.idempotencyKey,
    contentHash: plan.artifact.contentHash,
    message,
    retryable,
  };
}
