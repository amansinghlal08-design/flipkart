import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Telemetry — the in-app stand-in for the analytics collectors seen in the
 * capture (1.sonic.fdp.api.flipkart.com/4/data/collector/business). The web
 * app fires events through POST /api/v2/analytics/events; they're persisted
 * here and surfaced on the /api reference page.
 */

export const trackEvent = mutation({
  args: {
    event: v.string(),
    path: v.optional(v.string()),
    props: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    ),
  },
  handler: async (ctx, { event, path, props }) => {
    await ctx.db.insert("analyticsEvents", {
      event,
      path,
      props,
      createdAt: Date.now(),
    });
    return { tracked: true, event };
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    return await ctx.db
      .query("analyticsEvents")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(limit, 50));
  },
});

export const countByEvent = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.event, (counts.get(event.event) ?? 0) + 1);
    }
    return Object.fromEntries(counts);
  },
});
