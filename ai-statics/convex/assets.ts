import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Step 1 of an upload: hand the client a short-lived URL to POST the file to.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

// Step 2: record the uploaded file as a reusable brand asset.
export const saveAsset = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    kind: v.union(v.literal("product"), v.literal("reference_ad")),
  },
  handler: async (ctx, args) => await ctx.db.insert("brandAssets", args),
});

// The library, each row with a fetchable URL for preview + Higgsfield upload.
export const listAssets = query({
  args: {},
  handler: async (ctx) => {
    const assets = await ctx.db.query("brandAssets").order("desc").collect();
    return Promise.all(
      assets.map(async (a) => ({
        _id: a._id,
        name: a.name,
        kind: a.kind,
        higgsfieldMediaId: a.higgsfieldMediaId,
        url: await ctx.storage.getUrl(a.storageId),
      }))
    );
  },
});

export const getAssetsByIds = query({
  args: { assetIds: v.array(v.id("brandAssets")) },
  handler: async (ctx, args) => {
    const assets = await Promise.all(args.assetIds.map((id) => ctx.db.get(id)));
    return Promise.all(
      assets
        .filter((a) => a !== null)
        .map(async (a) => ({
          _id: a._id,
          name: a.name,
          kind: a.kind,
          higgsfieldMediaId: a.higgsfieldMediaId,
          url: await ctx.storage.getUrl(a.storageId),
        }))
    );
  },
});

// Cache the Higgsfield media id after first upload (optional optimization).
export const setHiggsfieldId = mutation({
  args: { assetId: v.id("brandAssets"), higgsfieldMediaId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assetId, { higgsfieldMediaId: args.higgsfieldMediaId });
  },
});

// Swap an asset's stored file for a new one (e.g. a downscaled version), keeping
// the row + cached higgsfieldMediaId. Deletes the old file.
export const replaceStorage = mutation({
  args: { assetId: v.id("brandAssets"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.assetId);
    if (!a) return;
    const oldStorageId = a.storageId;
    await ctx.db.patch(args.assetId, { storageId: args.storageId });
    if (oldStorageId !== args.storageId) await ctx.storage.delete(oldStorageId);
  },
});

// Remove an asset from the library (and its stored file).
export const deleteAsset = mutation({
  args: { assetId: v.id("brandAssets") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.assetId);
    if (!a) return;
    await ctx.storage.delete(a.storageId);
    await ctx.db.delete(args.assetId);
  },
});
