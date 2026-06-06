/**
 * K3 — mutations: createBrandKit, addSegment, addProofAsset, startRun.
 * Also K8's emitEvent + the internal helpers the action uses to persist ads.
 * Draft: ports to convex/mutations.ts (after `npx convex dev`).
 */
import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const createBrandKit = mutation({
  args: {
    name: v.string(),
    colors: v.object({
      primary: v.string(),
      secondary: v.optional(v.string()),
      accent: v.optional(v.string()),
    }),
    font: v.string(),
    tone: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    productImageStorageIds: v.optional(v.array(v.id("_storage"))),
    copyright: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("brandKits", {
      ...args,
      productImageStorageIds: args.productImageStorageIds ?? [],
    });
  },
});

export const addSegment = mutation({
  args: {
    brandKitId: v.id("brandKits"),
    name: v.string(),
    description: v.string(),
    awarenessStage: v.union(
      v.literal("unaware"),
      v.literal("problem-aware"),
      v.literal("solution-aware"),
      v.literal("product-aware"),
      v.literal("most-aware"),
    ),
    pains: v.array(v.string()),
    objections: v.array(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("icpSegments", args),
});

export const addProofAsset = mutation({
  args: {
    brandKitId: v.id("brandKits"),
    type: v.union(
      v.literal("review"),
      v.literal("stat"),
      v.literal("testimonial"),
    ),
    text: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("proofAssets", args),
});

/**
 * startRun — creates the run row and kicks the action (K6). Returns runId
 * immediately so the UI can subscribe to the live swarm view right away.
 */
export const startRun = mutation({
  args: {
    brandKitId: v.id("brandKits"),
    segmentIds: v.array(v.id("icpSegments")),
  },
  handler: async (ctx, { brandKitId, segmentIds }) => {
    const runId = await ctx.db.insert("runs", {
      brandKitId,
      status: "running",
      segmentIds,
    });
    await ctx.scheduler.runAfter(0, internal.run.execute, { runId });
    return runId;
  },
});

/* ── K8 hooks the action calls (internal — not exposed to the client) ── */

export const emitEvent = internalMutation({
  args: {
    runId: v.id("runs"),
    segmentId: v.union(v.id("icpSegments"), v.null()),
    agent: v.union(
      v.literal("orchestrator"),
      v.literal("strategy"),
      v.literal("copy"),
      v.literal("imagePrompt"),
      v.literal("image"),
      v.literal("render"),
    ),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentEvents", args);
  },
});

export const saveAd = internalMutation({
  args: {
    runId: v.id("runs"),
    segmentId: v.id("icpSegments"),
    strategy: v.object({
      awarenessStage: v.string(),
      angle: v.string(),
      emotion: v.string(),
      setting: v.string(),
      bigIdea: v.string(),
      proofAssetId: v.optional(v.string()),
    }),
    copy: v.object({
      headline: v.string(),
      primary: v.string(),
      cta: v.string(),
    }),
    imagePrompt: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ads", args);
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("runs"),
    status: v.union(v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, { runId, status }) => {
    await ctx.db.patch(runId, { status });
  },
});
