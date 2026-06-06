import { generateText } from "ai";
import { qwen } from "./qwen";
import { StrategyOutput } from "./strategyAgent";

export interface CopyInput {
  strategy: StrategyOutput;
  brandKit?: string;
  productBrief?: string;
}

export interface CopyOutput {
  headline: string;
  subheadline: string;
  bodyText: string;
  cta: string;
  socialProof?: string;
}

export async function runCopyAgent(input: CopyInput): Promise<CopyOutput> {
  const { text } = await generateText({
    model: qwen,
    system: `You are a world-class direct response copywriter.
You write punchy, benefit-driven copy that converts. You understand:
- Pattern interrupts and scroll-stopping headlines
- Clarity > cleverness for DR ads
- CTAs that create urgency without being spammy
- Social proof integration
Always respond with a valid JSON object only. No markdown.`,
    prompt: `Write high-converting ad copy based on this strategy:

STRATEGY:
- Angle: ${input.strategy.angle}
- Awareness Stage: ${input.strategy.awarenessStage}
- Emotional Hook: ${input.strategy.emotionalHook}
- Ad Concept: ${input.strategy.adConcept}

PRODUCT:
${input.productBrief || "No written brief provided — write copy that fits the strategy above and would suit the product shown in the reference photo."}

BRAND VOICE:
${input.brandKit || "No brand kit provided — default to a clear, confident, conversion-focused tone."}

Respond with ONLY this JSON (no markdown, no backticks):
{
  "headline": "Main headline - max 8 words, punchy",
  "subheadline": "Supporting headline - max 15 words",
  "bodyText": "1-2 sentences max. Benefit focused.",
  "cta": "CTA button text - max 5 words",
  "socialProof": "Optional: a short social proof line or stat"
}`,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as CopyOutput;
}
