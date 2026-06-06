/**
 * K2 — image storage. Draft: ports to convex/images.ts.
 * NOTE: imports from ./_generated/* only resolve after `npx convex dev` has
 * generated them, so this file is intentionally NOT in lab's tsconfig.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Frontend (Brand Kit form, M7) uploads logos/product images through this. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolve a storage id to a servable URL (used by the Results grid / <MetaAd>). */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
