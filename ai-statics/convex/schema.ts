import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Each ad generation job
  jobs: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed")
    ),
    // Inputs
    productBrief: v.string(),
    brandKit: v.string(),
    customerReviews: v.string(),
    referenceAds: v.optional(v.string()),
    // Outputs (populated as agents finish)
    strategy: v.optional(v.any()),
    copy: v.optional(v.any()),
    imagePrompt: v.optional(v.any()),
    imageStorageId: v.optional(v.id("_storage")),
    scorer: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  }).index("by_status", ["status"]),
});
