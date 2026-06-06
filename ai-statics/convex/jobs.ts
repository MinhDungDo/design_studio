import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new job record
export const createJob = mutation({
  args: {
    productBrief: v.string(),
    brandKit: v.string(),
    customerReviews: v.string(),
    referenceAds: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      status: "pending",
      ...args,
    });
    return jobId;
  },
});

// Save completed result to a job
export const completeJob = mutation({
  args: {
    jobId: v.id("jobs"),
    strategy: v.any(),
    copy: v.any(),
    imagePrompt: v.any(),
    imageStorageId: v.optional(v.id("_storage")),
    scorer: v.any(),
  },
  handler: async (ctx, args) => {
    const { jobId, ...rest } = args;
    await ctx.db.patch(jobId, {
      status: "complete",
      ...rest,
    });
  },
});

// Mark a job as failed
export const failJob = mutation({
  args: {
    jobId: v.id("jobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
    });
  },
});

// Get all jobs (for history view)
export const listJobs = query({
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(20);
  },
});

// Get a single job
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Generate a URL for a stored image
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
