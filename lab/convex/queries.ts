/**
 * K4 — reactive queries: getBrandKit, getRun, listAgentEvents, listAds.
 * Draft: ports to convex/queries.ts. These power the live swarm view (K9) and
 * results grid (K10) — both update reactively as the action emits events/ads.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getBrandKit = query({
  args: { brandKitId: v.id("brandKits") },
  handler: async (ctx, { brandKitId }) => ctx.db.get(brandKitId),
});

export const getRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, { runId }) => ctx.db.get(runId),
});

/** K9 live swarm view subscribes here — orchestrator + per-persona lanes. */
export const listAgentEvents = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("agentEvents")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect(),
});

/** K10 results grid subscribes here — one <MetaAd> per row. */
export const listAds = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("ads")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect(),
});
