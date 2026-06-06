import { runStrategyAgent, StrategyOutput } from "./strategyAgent";
import { runCopyAgent, CopyOutput } from "./copyAgent";
import { runImagePromptAgent, ImagePromptOutput } from "./imagePromptAgent";
import { runImageGenerator, ProductImageInput } from "./imageGenerator";
import { runAdScorer, AdScorerOutput } from "./adScorer";

export interface GenerationInput {
  productBrief?: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
  productImage: ProductImageInput;
}

export interface GenerationResult {
  strategy: StrategyOutput;
  copy: CopyOutput;
  imagePrompt: ImagePromptOutput;
  imageBase64: string;
  scorer: AdScorerOutput;
}

export type ProgressStep =
  | { step: "strategy"; status: "running" | "done"; data?: StrategyOutput }
  | { step: "copy"; status: "running" | "done"; data?: CopyOutput }
  | { step: "imagePrompt"; status: "running" | "done"; data?: ImagePromptOutput }
  | { step: "imageGen"; status: "running" | "done"; imageBase64?: string }
  | { step: "scorer"; status: "running" | "done"; data?: AdScorerOutput }
  | { step: "complete"; result: GenerationResult }
  | { step: "error"; message: string };

export async function* runOrchestrator(
  input: GenerationInput
): AsyncGenerator<ProgressStep> {
  try {
    // Step 1: Strategy
    yield { step: "strategy", status: "running" };
    const strategy = await runStrategyAgent(input);
    yield { step: "strategy", status: "done", data: strategy };

    // Step 2: Copy + Image Prompt in parallel
    yield { step: "copy", status: "running" };
    yield { step: "imagePrompt", status: "running" };

    const [copy, imagePrompt] = await Promise.all([
      runCopyAgent({ strategy, brandKit: input.brandKit, productBrief: input.productBrief }),
      runImagePromptAgent({ strategy, brandKit: input.brandKit, productBrief: input.productBrief, copy: { headline: "", subheadline: "", bodyText: "", cta: "" } }),
    ]);

    yield { step: "copy", status: "done", data: copy };
    yield { step: "imagePrompt", status: "done", data: imagePrompt };

    // Step 3: Generate image
    yield { step: "imageGen", status: "running" };
    const imageResult = await runImageGenerator(imagePrompt, input.productImage);
    yield { step: "imageGen", status: "done", imageBase64: imageResult.imageBase64 };

    // Step 4: Score the ad
    yield { step: "scorer", status: "running" };
    const scorer = await runAdScorer({
      strategy,
      copy,
      imagePromptUsed: imagePrompt.prompt,
    });
    yield { step: "scorer", status: "done", data: scorer };

    // Final result
    yield {
      step: "complete",
      result: {
        strategy,
        copy,
        imagePrompt,
        imageBase64: imageResult.imageBase64,
        scorer,
      },
    };
  } catch (err) {
    yield {
      step: "error",
      message: err instanceof Error ? err.message : "Unknown error occurred",
    };
  }
}
