/**
 * S2 — THE CONTRACT. Freeze with Minh at IC1 (0:30).
 *
 * Zod schemas are the single source of truth; TS types are inferred from them.
 * The agents (Minh) and the orchestrator (Kevin) both import from here and
 * NOTHING ELSE crosses the seam. No Convex imports in this file — it must be
 * usable from pure scripts, the agents, and Convex actions alike.
 */
import { z } from "zod";

/* ────────────────────────────── Inputs ────────────────────────────── */

export const BrandKitSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().optional(), // resolved storage URL or remote URL
  colors: z.object({
    primary: z.string(), // hex, e.g. "#1A73E8"
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }),
  font: z.string(), // font family name, e.g. "Inter"
  tone: z.string(), // voice/tone description, e.g. "warm, confident, no hype"
  productImageUrls: z.array(z.string()).default([]),
  copyright: z.string().optional(),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

export const AwarenessStage = z.enum([
  "unaware",
  "problem-aware",
  "solution-aware",
  "product-aware",
  "most-aware",
]);
export type AwarenessStage = z.infer<typeof AwarenessStage>;

export const IcpSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  awarenessStage: AwarenessStage,
  pains: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
});
export type IcpSegment = z.infer<typeof IcpSegmentSchema>;

export const ProofAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["review", "stat", "testimonial"]),
  text: z.string(),
  source: z.string().optional(), // attribution, e.g. "G2, 2025" or "Jane D."
});
export type ProofAsset = z.infer<typeof ProofAssetSchema>;

/* ─────────────────────────── Agent outputs ─────────────────────────── */

export const StrategySchema = z.object({
  awarenessStage: AwarenessStage,
  angle: z.string(), // the strategic hook, e.g. "ditch single-use plastic guilt"
  emotion: z.string(), // target feeling, e.g. "relief"
  setting: z.string(), // scene for the photo, e.g. "sunny kitchen counter"
  bigIdea: z.string(), // one-line creative concept
  proofAssetId: z.string().optional(), // which ProofAsset this leans on
});
export type Strategy = z.infer<typeof StrategySchema>;

export const CopySchema = z.object({
  headline: z.string(),
  primary: z.string(), // primary/body text
  cta: z.string(), // call to action, e.g. "Shop now"
});
export type Copy = z.infer<typeof CopySchema>;

export const ImagePromptSchema = z.object({
  imagePrompt: z.string(),
});
export type ImagePrompt = z.infer<typeof ImagePromptSchema>;

/* ───────────────────────────── Final ad ────────────────────────────── */

export const AdDraftSchema = z.object({
  segmentId: z.string(),
  strategy: StrategySchema,
  copy: CopySchema,
  imagePrompt: z.string(),
  /** Convex storage id once stored; the script harness uses a file path. */
  imageStorageId: z.string().optional(),
  imageUrl: z.string().optional(),
});
export type AdDraft = z.infer<typeof AdDraftSchema>;

/* ─────────────────────────── Live events ───────────────────────────── */

export const AgentEventSchema = z.object({
  runId: z.string(),
  /** which lane this belongs to: the orchestrator or a specific persona. */
  segmentId: z.string().nullable(), // null = orchestrator-level event
  agent: z.enum([
    "orchestrator",
    "strategy",
    "copy",
    "imagePrompt",
    "image",
    "render",
  ]),
  status: z.enum(["started", "completed", "failed"]),
  message: z.string().optional(),
  /** ms epoch — stamped by the emitter (Convex/Date), not inside pure code. */
  at: z.number().optional(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

/* ───────────────────── Agent function signatures ───────────────────── */
// Minh implements these as PURE functions (no Convex). Kevin stubs them until
// they land, then swaps the import — signatures must not drift.

export interface PsychologyNotes {
  text: string; // M1 playbook distilled to a prompt-ready brief
}

export type RunStrategyGenerator = (args: {
  brandKit: BrandKit;
  psychologyNotes: PsychologyNotes;
  segment: IcpSegment;
  proofAssets: ProofAsset[];
}) => Promise<Strategy>;

export type RunCopyGenerator = (args: {
  strategy: Strategy;
  brandKit: BrandKit;
  segment: IcpSegment;
  proofAssets: ProofAsset[];
}) => Promise<Copy>;

export type RunImagePromptGenerator = (args: {
  strategy: Strategy;
  brandKit: BrandKit;
}) => Promise<ImagePrompt>;

/* ──────────────────── Orchestrator (Kevin) seam ────────────────────── */
// Hooks are dependency-injected so generateRun stays pure & testable: a script
// passes console.log + writeFile; Convex passes a mutation + storage.

/** Returns a stable reference (storage id / path) the renderer can resolve. */
export type StoreImage = (
  photo: { bytes: Uint8Array; contentType: string },
  meta: { runId: string; segmentId: string },
) => Promise<{ imageStorageId?: string; imageUrl?: string }>;

export type EmitEvent = (event: AgentEvent) => void | Promise<void>;

export interface GenerateRunDeps {
  emitEvent: EmitEvent;
  storeImage: StoreImage;
  /** Optional: persist each ad the moment its persona finishes, so the results
   *  grid (K10) streams in reactively instead of all-at-once. */
  onDraft?: (draft: AdDraft) => void | Promise<void>;
  /** Optional: override the image generator — e.g. a fake for testing the
   *  pipeline/live-view without OpenAI spend. Defaults to generateAdPhoto. */
  generateImage?: (prompt: string) => Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Optional: inject Minh's real agents; defaults to stubs in lab. */
  agents?: {
    runStrategyGenerator: RunStrategyGenerator;
    runCopyGenerator: RunCopyGenerator;
    runImagePromptGenerator: RunImagePromptGenerator;
  };
  psychologyNotes?: PsychologyNotes;
}

export interface RunInput {
  runId: string;
  brandKit: BrandKit;
  segments: IcpSegment[];
  proofAssets: ProofAsset[];
}
