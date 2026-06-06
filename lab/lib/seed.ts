/**
 * S3 — placeholder seed fixture. Stands in for Ale's Brand pack (P2) + personas
 * (P3) + proof (P4) until they land at IC1 (0:30), then swap the values in.
 * Shapes are validated against the frozen contract so the swap is drop-in.
 */
import {
  BrandKitSchema,
  IcpSegmentSchema,
  ProofAssetSchema,
  type BrandKit,
  type IcpSegment,
  type ProofAsset,
} from "./types";

export const seedBrandKit: BrandKit = BrandKitSchema.parse({
  id: "brand_placeholder",
  name: "EverFlask",
  colors: { primary: "#1A73E8", secondary: "#0B2545", accent: "#34C759" },
  font: "Inter",
  tone: "warm, confident, no hype",
  productImageUrls: [],
  copyright: "© 2026 EverFlask (placeholder brand)",
});

export const seedSegments: IcpSegment[] = [
  IcpSegmentSchema.parse({
    id: "seg_eco",
    name: "Eco-conscious commuter",
    description: "Urban professional who wants to cut single-use plastic.",
    awarenessStage: "problem-aware",
    pains: ["guilt over plastic waste", "bottles that leak in a bag"],
    objections: ["another bottle I'll lose", "is it actually leakproof?"],
  }),
  IcpSegmentSchema.parse({
    id: "seg_gym",
    name: "Gym regular",
    description: "Trains 4x/week, wants a bottle that survives the gym floor.",
    awarenessStage: "solution-aware",
    pains: ["warm water mid-workout", "bottles that dent"],
    objections: ["keeps cold long enough?", "fits the cup holder?"],
  }),
  IcpSegmentSchema.parse({
    id: "seg_gift",
    name: "Gift buyer",
    description: "Looking for a premium, giftable everyday object.",
    awarenessStage: "unaware",
    pains: ["boring gift options"],
    objections: ["does it look premium?"],
  }),
];

export const seedProofAssets: ProofAsset[] = [
  ProofAssetSchema.parse({
    id: "proof_review",
    type: "review",
    text: "Genuinely leakproof — tossed it in my bag for a year, zero spills.",
    source: "Verified buyer",
  }),
  ProofAssetSchema.parse({
    id: "proof_stat",
    type: "stat",
    text: "Keeps drinks cold for 24 hours.",
    source: "Lab tested",
  }),
  ProofAssetSchema.parse({
    id: "proof_testimonial",
    type: "testimonial",
    text: "Replaced 300+ plastic bottles this year for me.",
    source: "Maya, daily user",
  }),
];
