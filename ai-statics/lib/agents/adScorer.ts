import { generateText } from "ai";
import { qwen } from "./qwen";
import { StrategyOutput } from "./strategyAgent";
import { CopyOutput } from "./copyAgent";

export interface AdScorerInput {
  strategy: StrategyOutput;
  copy: CopyOutput;
  imagePromptUsed: string;
}

export interface AdScorerOutput {
  overallScore: number; // 0-100
  passed: boolean;      // true if score >= 65
  scores: {
    drPrinciples: number;
    brandAlignment: number;
    clarity: number;
    emotionalImpact: number;
    ctaStrength: number;
  };
  feedback: string;
  improvements: string[];
}

export async function runAdScorer(input: AdScorerInput): Promise<AdScorerOutput> {
  const { text } = await generateText({
    model: qwen,
    system: `You are a senior direct response creative director and ad performance expert.
You score static ads against proven DR principles. Be honest and critical.
A passing score (65+) means the ad is ready to test. Below 65 means it needs work.
Always respond with a valid JSON object only. No markdown.`,
    prompt: `Score this ad creative:

STRATEGY USED:
- Angle: ${input.strategy.angle}
- Awareness Stage: ${input.strategy.awarenessStage}
- Emotional Hook: ${input.strategy.emotionalHook}

COPY:
- Headline: ${input.copy.headline}
- Subheadline: ${input.copy.subheadline}
- Body: ${input.copy.bodyText}
- CTA: ${input.copy.cta}
- Social Proof: ${input.copy.socialProof ?? "None"}

IMAGE PROMPT USED:
${input.imagePromptUsed}

Score each dimension 0-100 and give overall feedback.

Respond with ONLY this JSON (no markdown, no backticks):
{
  "overallScore": 0-100,
  "passed": true or false (true if overallScore >= 65),
  "scores": {
    "drPrinciples": 0-100,
    "brandAlignment": 0-100,
    "clarity": 0-100,
    "emotionalImpact": 0-100,
    "ctaStrength": 0-100
  },
  "feedback": "1-2 sentence overall assessment",
  "improvements": ["improvement 1", "improvement 2", "improvement 3"]
}`,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as AdScorerOutput;
}
