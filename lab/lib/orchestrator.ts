/**
 * K7 — the Orchestrator / Generation Pipeline. Pure control flow, no Convex.
 *
 * generateRun fans out across all personas in parallel. Within one persona:
 *   Strategy → Promise.all([Copy, ImagePrompt]) → GPT Image → storeImage → AdDraft
 * An AgentEvent is emitted at every step so the live swarm view (K9) lights up
 * lane-by-lane. Hooks (emitEvent, storeImage) are injected → testable solo.
 */
import { generateAdPhoto } from "./imageGen";
import { defaultAgents } from "./agents/stubs";
import type {
  AdDraft,
  AgentEvent,
  GenerateRunDeps,
  PsychologyNotes,
  RunInput,
} from "./types";

const DEFAULT_NOTES: PsychologyNotes = {
  text: "Match message to awareness stage. Lead with the pain, resolve with proof.",
};

/**
 * Run the full swarm for one brand across N personas. Returns the drafts (the
 * Convex action also persists each ad as it lands via storeImage + a mutation;
 * in lab the storeImage hook writes the photo to disk).
 */
export async function generateRun(
  input: RunInput,
  deps: GenerateRunDeps,
): Promise<AdDraft[]> {
  const { runId, brandKit, segments, proofAssets } = input;
  const agents = deps.agents ?? defaultAgents;
  const genImage = deps.generateImage ?? generateAdPhoto;
  const notes = deps.psychologyNotes ?? DEFAULT_NOTES;

  const emit = (e: Omit<AgentEvent, "runId">) =>
    deps.emitEvent({ runId, ...e });

  await emit({
    segmentId: null,
    agent: "orchestrator",
    status: "started",
    message: `Fanning out across ${segments.length} personas`,
  });

  // Fan out: every persona runs concurrently.
  const drafts = await Promise.all(
    segments.map((segment) =>
      runPersona(segment.id, async () => {
        // 1) Strategy
        await emit({ segmentId: segment.id, agent: "strategy", status: "started" });
        const strategy = await agents.runStrategyGenerator({
          brandKit,
          psychologyNotes: notes,
          segment,
          proofAssets,
        });
        await emit({
          segmentId: segment.id,
          agent: "strategy",
          status: "completed",
          message: strategy.angle,
        });

        // 2) Copy + Image prompt in parallel (both depend only on strategy)
        await emit({ segmentId: segment.id, agent: "copy", status: "started" });
        await emit({ segmentId: segment.id, agent: "imagePrompt", status: "started" });
        const [copy, { imagePrompt }] = await Promise.all([
          agents
            .runCopyGenerator({ strategy, brandKit, segment, proofAssets })
            .then(async (c) => {
              await emit({
                segmentId: segment.id,
                agent: "copy",
                status: "completed",
                message: c.headline,
              });
              return c;
            }),
          agents
            .runImagePromptGenerator({ strategy, brandKit })
            .then(async (p) => {
              await emit({
                segmentId: segment.id,
                agent: "imagePrompt",
                status: "completed",
              });
              return p;
            }),
        ]);

        // 3) GPT Image → store
        await emit({ segmentId: segment.id, agent: "image", status: "started" });
        const photo = await genImage(imagePrompt);
        const stored = await deps.storeImage(photo, { runId, segmentId: segment.id });
        await emit({
          segmentId: segment.id,
          agent: "image",
          status: "completed",
          message: stored.imageUrl ?? stored.imageStorageId,
        });

        const draft: AdDraft = {
          segmentId: segment.id,
          strategy,
          copy,
          imagePrompt,
          imageStorageId: stored.imageStorageId,
          imageUrl: stored.imageUrl,
        };
        await deps.onDraft?.(draft);
        await emit({ segmentId: segment.id, agent: "render", status: "completed" });
        return draft;
      }).catch(async (err) => {
        await emit({
          segmentId: segment.id,
          agent: "orchestrator",
          status: "failed",
          message: err instanceof Error ? err.message : String(err),
        });
        return null;
      }),
    ),
  );

  const ok = drafts.filter((d): d is AdDraft => d !== null);
  await emit({
    segmentId: null,
    agent: "orchestrator",
    status: "completed",
    message: `${ok.length}/${segments.length} ads generated`,
  });
  return ok;
}

/** Thin wrapper so a single persona failure doesn't reject the whole fan-out. */
function runPersona<T>(_segmentId: string, fn: () => Promise<T>): Promise<T> {
  return fn();
}
