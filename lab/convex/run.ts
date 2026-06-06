/**
 * K6 + K8 — the `"use node"` action that runs the pipeline inside Convex.
 * This is the SEAM: it adapts Convex (mutations + storage) to the orchestrator's
 * injected hooks. The orchestrator + agents themselves stay pure (lib/).
 *
 * Draft: ports to convex/run.ts. Imports from ../lib resolve once this lives in
 * the Next app next to lib/. Not in lab's tsconfig (needs _generated + convex).
 */
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateRun } from "../lib/orchestrator";
import type { BrandKit, IcpSegment, ProofAsset } from "../lib/types";

export const execute = internalAction({
  args: { runId: v.id("runs") },
  handler: async (ctx, { runId }) => {
    // 1) Load run config (brand + segments + proof) via internal queries.
    const run = await ctx.runQuery(internal.run.loadRunConfig, { runId });
    if (!run) throw new Error(`run ${runId} not found`);

    try {
      await generateRun(
        {
          runId,
          brandKit: run.brandKit as BrandKit,
          segments: run.segments as IcpSegment[],
          proofAssets: run.proofAssets as ProofAsset[],
        },
        {
          // K8: emit each step as a row → live swarm view subscribes reactively.
          emitEvent: (e) =>
            ctx.runMutation(internal.mutations.emitEvent, {
              runId,
              segmentId: e.segmentId as any, // null | Id<"icpSegments">
              agent: e.agent,
              status: e.status,
              message: e.message,
            }),

          // K8: store the photo bytes in Convex file storage.
          storeImage: async (photo) => {
            const blob = new Blob([photo.bytes], { type: photo.contentType });
            const imageStorageId = await ctx.storage.store(blob);
            return { imageStorageId };
          },

          // K10: persist each ad as its persona finishes → grid streams in.
          onDraft: (draft) =>
            ctx.runMutation(internal.mutations.saveAd, {
              runId,
              segmentId: draft.segmentId as any,
              strategy: draft.strategy,
              copy: draft.copy,
              imagePrompt: draft.imagePrompt,
              imageStorageId: draft.imageStorageId as any,
            }),
        },
      );

      await ctx.runMutation(internal.mutations.finishRun, {
        runId,
        status: "completed",
      });
    } catch (err) {
      await ctx.runMutation(internal.mutations.finishRun, {
        runId,
        status: "failed",
      });
      throw err;
    }
  },
});

/* loadRunConfig lives in a non-node file in the real app (internalQuery). Sketch:
 *
 *   export const loadRunConfig = internalQuery({
 *     args: { runId: v.id("runs") },
 *     handler: async (ctx, { runId }) => {
 *       const run = await ctx.db.get(runId);
 *       if (!run) return null;
 *       const brandKit = await ctx.db.get(run.brandKitId);
 *       const segments = await Promise.all(run.segmentIds.map((id) => ctx.db.get(id)));
 *       const proofAssets = await ctx.db.query("proofAssets")
 *         .withIndex("by_brandKit", (q) => q.eq("brandKitId", run.brandKitId)).collect();
 *       return { brandKit, segments: segments.filter(Boolean), proofAssets };
 *     },
 *   });
 */
