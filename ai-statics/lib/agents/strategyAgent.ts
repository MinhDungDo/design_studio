import { generateText } from "ai";
import { qwen } from "./qwen";

export interface StrategyInput {
  productBrief?: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
}

export interface StrategyOutput {
  angle: string;
  awarenessStage: string;
  emotionalHook: string;
  adConcept: string;
  targetEmotion: string;
  setting: string;
}

export async function runStrategyAgent(input: StrategyInput): Promise<StrategyOutput> {
  const { text } = await generateText({
    model: qwen,
    system: `You are a world-class direct response creative strategist.
Your job is to analyze product briefs and customer data to define the BEST angle for a static ad.
You think in terms of: awareness stages (unaware → problem aware → solution aware → product aware → most aware),
emotional hooks, pain points, desires, and proven DR frameworks (PAS, AIDA, before/after).
Some inputs may be missing — when that happens, infer sensibly from whatever you do have (especially the product photo) and proven DR conventions for that kind of product, rather than leaving gaps.
Always respond with a valid JSON object only.`,
    prompt: `Analyze this product and customer data to create the best ad strategy:

PRODUCT BRIEF:
${input.productBrief || "Not provided — infer the product's nature, features, and appeal from the reference product photo."}

BRAND KIT:
${input.brandKit || "Not provided — default to a clean, modern, conversion-focused brand voice that suits the product."}

CUSTOMER REVIEWS & FEEDBACK:
${input.customerReviews || "Not provided — base the emotional hook on common pain points and desires for this kind of product."}

${input.referenceAds ? `REFERENCE ADS:\n${input.referenceAds}` : ""}

Respond with ONLY this JSON structure (no markdown, no backticks):
{
  "angle": "The core angle/hook for this ad",
  "awarenessStage": "Which awareness stage we're targeting",
  "emotionalHook": "The primary emotion we want to trigger",
  "adConcept": "Detailed concept description for this ad",
  "targetEmotion": "Desired emotion after seeing the ad",
  "setting": "Scene/context for the visual (e.g. morning kitchen, gym locker room)"
}`,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as StrategyOutput;
}
