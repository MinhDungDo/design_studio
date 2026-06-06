import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Brand / product reference images. The persistent library the ad generator
  // pulls from (replaces ad-hoc file uploads + Google Drive). Each row points at
  // a file in Convex `_storage`; the app fetches it and uploads to Higgsfield.
  brandAssets: defineTable({
    name: v.string(),
    // "product" = the real product, preserved in every ad (also uploaded to Higgsfield).
    // "reference_ad" = an example of a good ad; style direction for the brain only.
    kind: v.union(v.literal("product"), v.literal("reference_ad")),
    storageId: v.id("_storage"),
    // Cached Higgsfield media id (set after first upload) to skip re-uploading.
    higgsfieldMediaId: v.optional(v.string()),
  }),
});
