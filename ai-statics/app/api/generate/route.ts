import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runSwarm } from "@/lib/agents/orchestrator";
import { AWARENESS_STAGES, isAwarenessStage } from "@/lib/agents/awareness";
import { uploadImageFromUrl, fetchBrandKit } from "@/lib/agents/higgsfield";

export const runtime = "nodejs"; // needs fs + the `higgsfield` CLI (execFile)
export const maxDuration = 300; // 5 min — N stage lanes generate images in parallel

interface GenerateBody {
  offer?: string;
  productDetails?: string;
  formatId?: string;
  // Convex storage URLs of the selected reference image(s).
  assetUrls?: string[];
  // Optional: a store URL → auto-built brand kit; or a pre-resolved brandKitId.
  storeUrl?: string;
  brandKitId?: string;
  stages?: string[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateBody;

  const offer = body.offer?.trim();
  const formatId = body.formatId?.trim();
  const assetUrls = (body.assetUrls ?? []).filter((u) => typeof u === "string" && u.length > 0);

  if (!offer || !formatId || assetUrls.length === 0) {
    return new Response(
      JSON.stringify({ error: "offer, formatId, and at least one assetUrl are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream progress back to the client as newline-delimited JSON.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // 1. Load the internal creative brief that steers every prompt.
        const brief = await readFile(join(process.cwd(), "content", "BRIEF.md"), "utf8");

        // 2. Resolve a brand kit if a store URL was provided.
        let brandKitId = body.brandKitId;
        if (!brandKitId && body.storeUrl) {
          brandKitId = (await fetchBrandKit(body.storeUrl)).id;
        }

        // 3. Upload the reference image(s) to Higgsfield once; reuse across lanes.
        const mediaIds = await Promise.all(assetUrls.map(uploadImageFromUrl));

        // 4. Sanitize requested stages; fall back to all five.
        const requested = (body.stages ?? []).filter(isAwarenessStage);
        const stages = requested.length > 0 ? requested : [...AWARENESS_STAGES];

        const productDetails = body.productDetails?.trim() || undefined;
        for await (const progress of runSwarm({ offer, productDetails, brief, formatId, brandKitId, mediaIds }, stages)) {
          send(progress);
        }
      } catch (err) {
        send({ step: "error", message: err instanceof Error ? err.message : "Stream error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
