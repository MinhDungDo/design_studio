// The fan-out dimension: one persona, many ads — one per awareness stage
// (Eugene Schwartz). Same product/person; the message, angle, and scene shift
// as the buyer becomes more aware. Shared by the strategy agent (to steer each
// lane) and the UI (labels + stage picker).

export const AWARENESS_STAGES = [
  "unaware",
  "problem-aware",
  "solution-aware",
  "product-aware",
  "most-aware",
] as const;

export type AwarenessStage = (typeof AWARENESS_STAGES)[number];

export const STAGE_LABEL: Record<AwarenessStage, string> = {
  unaware: "Unaware",
  "problem-aware": "Problem-Aware",
  "solution-aware": "Solution-Aware",
  "product-aware": "Product-Aware",
  "most-aware": "Most-Aware",
};

// One-line creative brief injected into the strategy prompt so each lane's
// angle/hook/scene is crafted specifically for that stage of awareness.
export const STAGE_BRIEF: Record<AwarenessStage, string> = {
  unaware:
    "The buyer doesn't know they have the problem. Lead with a relatable moment or curiosity hook — no product talk, no jargon. Goal: stop the scroll and create recognition.",
  "problem-aware":
    "The buyer feels the pain but hasn't sought solutions. Agitate the problem and its cost, then hint relief exists. Frame: PAS (problem-agitate-solution).",
  "solution-aware":
    "The buyer knows solutions exist but not yours. Differentiate the category approach and show why this way works better. Lead with the mechanism/benefit, not the brand.",
  "product-aware":
    "The buyer knows your product but hasn't bought. Hammer proof, specifics, and objection-handling (price, risk, results). Make the offer concrete.",
  "most-aware":
    "The buyer is ready — they just need a reason now. Lead with the offer, urgency, and a hard CTA. Minimal persuasion, maximum clarity.",
};

// A safe default for fast live runs (3 lanes). UI lets the user select more.
export const DEFAULT_STAGES: AwarenessStage[] = [
  "problem-aware",
  "solution-aware",
  "product-aware",
];

export function isAwarenessStage(value: string): value is AwarenessStage {
  return (AWARENESS_STAGES as readonly string[]).includes(value);
}
