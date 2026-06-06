import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { AwarenessStage, AWARENESS_STAGES, STAGE_LABEL, STAGE_BRIEF } from "./awareness";
import { timingLog } from "./timingLog";

// One base64 image plus its mime type.
export interface ImageInput {
  data: string; // base64, no data: prefix
  mediaType: string; // e.g. "image/png"
}

export interface BrainInputs {
  productBrief: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
}

// gpt_image_2's supported aspect ratios (no 4:5 — IG-feed maps to 2:3).
const ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"] as const;

const finalDirectionSchema = z.object({
  stage: z.enum(AWARENESS_STAGES).describe("The awareness stage this direction is for"),
  headline: z.string().describe("On-image headline, 3-7 words"),
  subline: z.string().optional().describe("Optional on-image subline, <=6 words"),
  finalImagePrompt: z
    .string()
    .describe(
      "Complete gpt-image-2 production brief for THIS awareness stage. Bake the headline into the image: put the exact words in quotes, state where they sit, and add 'render text verbatim, correct spelling, no extra words, no duplicate text'. Keep the product from the PRODUCT reference image(s) intact; borrow only composition/mood/lighting from any BENCHMARK image."
    ),
  negativePrompt: z.string().describe("What to avoid in the image"),
  aspectRatio: z.enum(ASPECT_RATIOS).describe("One of gpt_image_2's supported ratios"),
  caption: z.string().describe("Primary text / caption, 125-500 chars"),
});

export type FinalDirection = z.infer<typeof finalDirectionSchema>;

const batchDirectionSchema = z.object({
  directions: z.array(finalDirectionSchema),
});

const OUTPUT_INSTRUCTION = `You are operating as the Static Ad Creative Agent defined above. For EACH requested awareness stage below, run your four phases internally and return ONLY one final result object per stage. Each finalImagePrompt must be production-ready for gpt-image-2, bake the headline into the image with verbatim-text constraints, preserve the product shown in the PRODUCT image(s) exactly, and borrow only composition/mood/lighting/layout (never branding) from any BENCHMARK image. aspectRatio must be one of: ${ASPECT_RATIOS.join(", ")}.`;

function userText(inputs: BrainInputs, stages: AwarenessStage[]): string {
  const lines = [
    OUTPUT_INSTRUCTION,
    "",
    "TARGET AWARENESS STAGES:",
    ...stages.map((stage) => `- ${stage} — ${STAGE_LABEL[stage]}: ${STAGE_BRIEF[stage]}`),
    "",
    `PRODUCT BRIEF: ${inputs.productBrief.trim()}`,
  ];
  if (inputs.brandKit?.trim()) lines.push(`BRAND KIT: ${inputs.brandKit.trim()}`);
  if (inputs.customerReviews?.trim()) lines.push(`CUSTOMER REVIEWS & FEEDBACK: ${inputs.customerReviews.trim()}`);
  if (inputs.referenceAds?.trim()) lines.push(`REFERENCE ADS (text direction): ${inputs.referenceAds.trim()}`);
  return lines.join("\n");
}

// The "Supercomputer" brain: Claude runs content/BRIEF.md (system prompt) over the
// inputs + reference images and returns Final Directions for the requested stages.
export async function runBrainBatch(args: {
  brief: string;
  inputs: BrainInputs;
  stages: AwarenessStage[];
  productImages: ImageInput[];
  benchmarkImages: ImageInput[];
}): Promise<Record<AwarenessStage, FinalDirection>> {
  const startedAt = Date.now();
  timingLog("brain", "batch:start", {
    stages: args.stages,
    productImages: args.productImages.length,
    benchmarkImages: args.benchmarkImages.length,
    briefChars: args.brief.length,
    productBriefChars: args.inputs.productBrief.length,
  });
  const model = anthropic(process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6");

  type Part =
    | { type: "text"; text: string }
    | { type: "image"; image: string; mediaType: string };
  const content: Part[] = [{ type: "text", text: userText(args.inputs, args.stages) }];

  for (const img of args.productImages) {
    content.push({ type: "text", text: "PRODUCT IMAGE — preserve this product exactly (shape, colors, labels, branding):" });
    content.push({ type: "image", image: img.data, mediaType: img.mediaType });
  }
  for (const img of args.benchmarkImages) {
    content.push({ type: "text", text: "BENCHMARK AD — borrow composition/mood/lighting/layout only, NOT its branding or claims:" });
    content.push({ type: "image", image: img.data, mediaType: img.mediaType });
  }

  const { object } = await generateObject({
    model,
    schema: batchDirectionSchema,
    // Each Final Direction is small (~800 tokens). Cap output so we don't reserve
    // the model's 128k max against Anthropic's per-minute limit — with several
    // lanes firing at once that reservation triggers 429s + silent retries.
    maxOutputTokens: Math.min(12000, 2500 * args.stages.length),
    system: args.brief,
    messages: [{ role: "user", content }],
  });
  timingLog("brain", "batch:done", {
    elapsedMs: Date.now() - startedAt,
    directions: object.directions.length,
  });

  const byStage = Object.fromEntries(
    object.directions.map((direction) => [direction.stage, direction])
  ) as Partial<Record<AwarenessStage, FinalDirection>>;

  const missing = args.stages.filter((stage) => !byStage[stage]);
  if (missing.length > 0) {
    throw new Error(`Claude did not return directions for: ${missing.join(", ")}`);
  }

  return byStage as Record<AwarenessStage, FinalDirection>;
}

export async function runBrain(args: {
  brief: string;
  inputs: BrainInputs;
  stage: AwarenessStage;
  productImages: ImageInput[];
  benchmarkImages: ImageInput[];
}): Promise<FinalDirection> {
  const directions = await runBrainBatch({
    brief: args.brief,
    inputs: args.inputs,
    stages: [args.stage],
    productImages: args.productImages,
    benchmarkImages: args.benchmarkImages,
  });
  return directions[args.stage];
}
