import { AwarenessStage, AWARENESS_STAGES } from "./awareness";
import { runBrainBatch, BrainInputs, FinalDirection, ImageInput } from "./brain";
import { renderGptImage2 } from "./higgsfield";
import { timingLog } from "./timingLog";

export interface GenerationInput {
  // The agent system prompt (content/BRIEF.md), read once by the route.
  brief: string;
  // Per-run product inputs from the form.
  productBrief: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
  // Reference images as base64 for the brain (multimodal).
  productImages: ImageInput[];
  benchmarkImages: ImageInput[];
  // Higgsfield upload ids for the PRODUCT image(s) — for gpt_image_2 --image.
  mediaIds: string[];
  // Which awareness stages to fan out into (one ad per stage). Defaults to all.
  stages?: AwarenessStage[];
}

// One finished ad for one awareness stage.
export interface AdResult {
  laneId: AwarenessStage;
  imageUrl: string;
  headline: string;
  subline?: string;
  caption: string;
}

// Each per-lane step carries laneId so the UI routes it to the right column.
export type ProgressStep =
  | { step: "swarmStart"; lanes: AwarenessStage[] }
  | { step: "laneStart"; laneId: AwarenessStage }
  | { step: "brain"; status: "running" | "done"; laneId: AwarenessStage }
  | { step: "imageGen"; status: "running" | "done"; laneId: AwarenessStage }
  | { step: "laneComplete"; laneId: AwarenessStage; result: AdResult }
  | { step: "swarmComplete" }
  | { step: "error"; laneId?: AwarenessStage; message: string };

type Emit = (step: ProgressStep) => void;

// One awareness stage: Claude (the "Supercomputer" brain) writes the direction,
// then Higgsfield gpt_image_2 renders it.
async function runLane(
  input: GenerationInput,
  stage: AwarenessStage,
  direction: FinalDirection,
  emit: Emit
): Promise<AdResult> {
  const startedAt = Date.now();
  timingLog("swarm", "lane:render:start", { stage });
  emit({ step: "imageGen", status: "running", laneId: stage });
  const { imageUrl } = await renderGptImage2({
    prompt: direction.finalImagePrompt,
    negativePrompt: direction.negativePrompt,
    mediaIds: input.mediaIds,
    aspectRatio: direction.aspectRatio,
    // Dev defaults favor speed; bump via env for finals.
    quality: (process.env.RENDER_QUALITY as "low" | "medium" | "high") || "medium",
    resolution: (process.env.RENDER_RESOLUTION as "1k" | "2k" | "4k") || "1k",
  });
  emit({ step: "imageGen", status: "done", laneId: stage });
  timingLog("swarm", "lane:render:done", { stage, elapsedMs: Date.now() - startedAt });

  return {
    laneId: stage,
    imageUrl,
    headline: direction.headline,
    subline: direction.subline,
    caption: direction.caption,
  };
}

// Fan out across awareness stages; merge every lane's progress into one ordered
// stream. Lanes run concurrently (capped by SWARM_CONCURRENCY). Each lane is one
// Claude call + one billable Higgsfield render.
export async function* runSwarm(
  input: GenerationInput,
  stages: AwarenessStage[] = [...AWARENESS_STAGES]
): AsyncGenerator<ProgressStep> {
  const queue: ProgressStep[] = [];
  let notify: (() => void) | null = null;
  const wake = () => {
    const f = notify;
    notify = null;
    f?.();
  };
  const emit: Emit = (step) => {
    queue.push(step);
    wake();
  };

  const concurrency = Number(process.env.SWARM_CONCURRENCY) || Math.min(stages.length, 3);
  timingLog("swarm", "start", { stages, concurrency });
  let next = 0;
  let active = 0;
  let finished = 0;

  emit({ step: "swarmStart", lanes: stages });

  for (const stage of stages) emit({ step: "brain", status: "running", laneId: stage });
  while (queue.length > 0) yield queue.shift()!;

  const inputs: BrainInputs = {
    productBrief: input.productBrief,
    brandKit: input.brandKit,
    customerReviews: input.customerReviews,
    referenceAds: input.referenceAds,
  };
  const brainStartedAt = Date.now();
  const directions = await runBrainBatch({
    brief: input.brief,
    inputs,
    stages,
    productImages: input.productImages,
    benchmarkImages: input.benchmarkImages,
  });
  timingLog("swarm", "brain:done", { elapsedMs: Date.now() - brainStartedAt });
  for (const stage of stages) emit({ step: "brain", status: "done", laneId: stage });

  const launch = () => {
    while (active < concurrency && next < stages.length) {
      const stage = stages[next++];
      active++;
      emit({ step: "laneStart", laneId: stage });
      runLane(input, stage, directions[stage], emit)
        .then((result) => emit({ step: "laneComplete", laneId: stage, result }))
        .catch((err) =>
          emit({
            step: "error",
            laneId: stage,
            message: err instanceof Error ? err.message : "Unknown error",
          })
        )
        .finally(() => {
          active--;
          finished++;
          wake();
          launch();
        });
    }
  };
  launch();

  while (finished < stages.length || queue.length > 0) {
    if (queue.length === 0) await new Promise<void>((r) => (notify = r));
    while (queue.length > 0) yield queue.shift()!;
  }

  yield { step: "swarmComplete" };
}
