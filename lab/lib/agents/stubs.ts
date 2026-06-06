/**
 * Stubbed agents — fake but well-SHAPED outputs so Kevin's orchestrator runs
 * end-to-end before Minh's real agents (M2–M4) land. At integration, the
 * orchestrator swaps `defaultAgents` (these) for Minh's real implementations
 * via GenerateRunDeps.agents — no orchestrator change needed.
 *
 * Each stub is deliberately varied per segment so the 3 ads come out DISTINCT
 * (different angle/awareness), which is what the demo needs to show.
 */
import type {
  RunStrategyGenerator,
  RunCopyGenerator,
  RunImagePromptGenerator,
} from "../types";

// Tiny artificial latency so the live swarm view visibly streams events
// instead of completing instantly. Real agents replace this with API latency.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runStrategyGenerator: RunStrategyGenerator = async ({
  segment,
  proofAssets,
}) => {
  await delay(300);
  return {
    awarenessStage: segment.awarenessStage,
    angle: `Speak to "${segment.name}": ${segment.pains[0] ?? "their core pain"}`,
    emotion: segment.awarenessStage === "unaware" ? "curiosity" : "relief",
    setting: "sunny kitchen counter, natural morning light",
    bigIdea: `Show ${segment.name} that the product erases ${segment.pains[0] ?? "the problem"}`,
    proofAssetId: proofAssets[0]?.id,
  };
};

export const runCopyGenerator: RunCopyGenerator = async ({
  strategy,
  brandKit,
  segment,
}) => {
  await delay(250);
  return {
    headline: `${segment.name}: ${strategy.bigIdea.split(" ").slice(0, 6).join(" ")}`,
    primary: `${strategy.angle}. In ${brandKit.tone} voice — built for people who feel ${strategy.emotion}.`,
    cta: strategy.awarenessStage === "most-aware" ? "Shop now" : "Learn more",
  };
};

export const runImagePromptGenerator: RunImagePromptGenerator = async ({
  strategy,
  brandKit,
}) => {
  await delay(250);
  return {
    imagePrompt: [
      "Authentic UGC-style phone photo for a Meta feed ad.",
      `Scene: ${strategy.setting}.`,
      `Evoke ${strategy.emotion}.`,
      `Feature the product (${brandKit.name}) naturally in frame.`,
      "Shot on an iPhone, natural light, slight motion blur, candid and unposed,",
      "imperfect framing, no text, no logos, no watermark, photorealistic, shallow depth of field.",
    ].join(" "),
  };
};

export const defaultAgents = {
  runStrategyGenerator,
  runCopyGenerator,
  runImagePromptGenerator,
};
