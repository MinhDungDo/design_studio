/**
 * K1 — Convex schema (6 tables). Draft: ports to convex/schema.ts after Minh's
 * scaffold lands and `npx convex dev` is running. Mirrors lib/types.ts.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  brandKits: defineTable({
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    colors: v.object({
      primary: v.string(),
      secondary: v.optional(v.string()),
      accent: v.optional(v.string()),
    }),
    font: v.string(),
    tone: v.string(),
    productImageStorageIds: v.array(v.id("_storage")),
    copyright: v.optional(v.string()),
  }),

  icpSegments: defineTable({
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
  }).index("by_brandKit", ["brandKitId"]),

  proofAssets: defineTable({
    brandKitId: v.id("brandKits"),
    type: v.union(
      v.literal("review"),
      v.literal("stat"),
      v.literal("testimonial"),
    ),
    text: v.string(),
    source: v.optional(v.string()),
  }).index("by_brandKit", ["brandKitId"]),

  runs: defineTable({
    brandKitId: v.id("brandKits"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    segmentIds: v.array(v.id("icpSegments")),
  }).index("by_brandKit", ["brandKitId"]),

  agentEvents: defineTable({
    runId: v.id("runs"),
    segmentId: v.union(v.id("icpSegments"), v.null()), // null = orchestrator lane
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
  }).index("by_run", ["runId"]),

  ads: defineTable({
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
  })
    .index("by_run", ["runId"])
    .index("by_run_segment", ["runId", "segmentId"]),
});
