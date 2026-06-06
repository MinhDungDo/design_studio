import { AwarenessStage, AWARENESS_STAGES } from "./awareness";
import { runDtcAd } from "./higgsfield";
import { buildAdPrompt } from "./promptBuilder";

export interface GenerationInput {
  // What we're advertising this run (steers Higgsfield's copy).
  offer: string;
  // Optional per-run product specifics (features, price, materials, claims).
  productDetails?: string;
  // The internal creative brief (content/BRIEF.md), read once by the route.
  brief: string;
  // The chosen DTC ad format applied across all lanes.
  formatId: string;
  // Optional brand kit (colors/fonts/voice) resolved from a store URL.
  brandKitId?: string;
  // Higgsfield media ids for the reference product image(s) — uploaded once.
  mediaIds: string[];
  // Which awareness stages to fan out into (one ad per stage). Defaults to all.
  stages?: AwarenessStage[];
  // How many variations to generate per lane (Higgsfield batch — each is a
  // separate billable job). Defaults to 1 (today's one-ad-per-stage behavior).
  variantsPerLane?: number;
}

export interface AdImage {
  imageBase64: string;
  imageUrl?: string;
}

// One finished lane: one or more ad variations for the same awareness stage.
export interface AdResult {
  laneId: AwarenessStage;
  images: AdImage[];
}

// Every per-lane step carries laneId so the UI can route it to the right column.
export type ProgressStep =
  | { step: "swarmStart"; lanes: AwarenessStage[] }
  | { step: "laneStart"; laneId: AwarenessStage }
  | { step: "imageGen"; status: "running" | "done"; laneId: AwarenessStage; imageBase64?: string }
  | { step: "laneComplete"; laneId: AwarenessStage; result: AdResult }
  | { step: "swarmComplete" }
  | { step: "error"; laneId?: AwarenessStage; message: string };

type Emit = (step: ProgressStep) => void;

// Run the image-gen step for ONE awareness stage, producing one or more
// variations. Higgsfield's DTC Ads engine does the creative work (copy + scene)
// from the assembled prompt.
async function runLane(
  input: GenerationInput,
  stage: AwarenessStage,
  emit: Emit
): Promise<AdResult> {
  emit({ step: "imageGen", status: "running", laneId: stage });
  const prompt = buildAdPrompt(input.brief, input.offer, input.productDetails, stage);
  const { images } = await runDtcAd({
    prompt,
    formatId: input.formatId,
    mediaIds: input.mediaIds,
    brandKitId: input.brandKitId,
    variants: input.variantsPerLane,
  });
  emit({ step: "imageGen", status: "done", laneId: stage, imageBase64: images[0]?.imageBase64 });

  return { laneId: stage, images };
}

// Fan out across awareness stages and merge every lane's progress into one
// ordered stream. Lanes run concurrently (capped by SWARM_CONCURRENCY) so the
// UI lights up multiple columns at once. Each lane is a billable Higgsfield job.
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

  const concurrency = Number(process.env.SWARM_CONCURRENCY) || Math.min(stages.length, 5);
  let next = 0;
  let active = 0;
  let finished = 0;

  emit({ step: "swarmStart", lanes: stages });

  const launch = () => {
    while (active < concurrency && next < stages.length) {
      const stage = stages[next++];
      active++;
      emit({ step: "laneStart", laneId: stage });
      runLane(input, stage, emit)
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
