import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { StrategyOutput } from "./strategyAgent";
import { CopyOutput } from "./copyAgent";

export interface ImagePromptInput {
  strategy: StrategyOutput;
  copy: CopyOutput;
  brandKit?: string;
  productBrief?: string;
}

export interface ImagePromptOutput {
  prompt: string;
  negativeGuidance: string;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "standard" | "high";
}

export async function runImagePromptAgent(input: ImagePromptInput): Promise<ImagePromptOutput> {
  const { text } = await generateText({
    model: openai("gpt-4o"),
    system: `You are a world-class art director and AI image prompt engineer.
You write detailed, specific instructions for GPT Image 2's image-EDITING endpoint. It receives the brand's actual product photo as a reference image alongside your prompt and edits it into a finished static ad — it does not generate the product from scratch.
Every prompt you write MUST start by instructing the model to keep the product from the reference photo intact: same shape, proportions, colors, labels, and branding, even if shown from a different angle, distance, or in a different setting. Only the scene around it — background, setting, lighting, props, composition — should be reimagined.
You know how to specify: shot type, lighting, composition, camera angle, color palette, mood, props, typography placement.
For static ads: always leave clean areas for text overlays. Specify photorealistic unless brand requires illustration.
Always respond with a valid JSON object only. No markdown.`,
    prompt: `Create a detailed image-editing prompt for this static ad. The actual product photo will be passed in as a reference image — your prompt only describes how to edit/reimagine the scene around it.

CONCEPT: ${input.strategy.adConcept}
SETTING: ${input.strategy.setting}
EMOTIONAL TONE: ${input.strategy.targetEmotion}

COPY TO COMPLEMENT:
- Headline: ${input.copy.headline}
- CTA: ${input.copy.cta}

BRAND:
${input.brandKit || "No brand kit provided — keep the look clean, modern, and product-forward."}

PRODUCT:
${input.productBrief || "No written brief provided — rely on the reference product photo to understand what the product is and how to showcase it."}

Respond with ONLY this JSON (no markdown, no backticks):
{
  "prompt": "Detailed editing instructions for GPT Image 2. Open by telling it to preserve the product exactly as shown in the reference photo (shape, proportions, colors, labels, branding) while only changing what's around it. Then describe the new scene: shot type, lighting, composition, color palette, mood, props, camera angle, and where to leave clean space for text overlays. Be very specific and descriptive.",
  "negativeGuidance": "What to avoid in the image (e.g. distorting or replacing the product, cluttering text-overlay areas)",
  "size": "1024x1024 OR 1536x1024 (landscape) OR 1024x1536 (portrait/story)",
  "quality": "standard OR high"
}`,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ImagePromptOutput;
}
