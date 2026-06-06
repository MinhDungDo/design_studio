import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { runSwarm } from "@/lib/agents/orchestrator";
import { AWARENESS_STAGES, isAwarenessStage } from "@/lib/agents/awareness";
import { uploadImageFromUrl } from "@/lib/agents/higgsfield";
import { ImageInput } from "@/lib/agents/brain";
import { timingLog, timingWarn } from "@/lib/agents/timingLog";

export const runtime = "nodejs"; // needs fs + the `higgsfield` CLI (execFile)
export const maxDuration = 300; // 5 min — N stage lanes (Claude call + render) in parallel

interface GenerateBody {
  productBrief?: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
  // Convex brandAssets ids, split by role.
  productAssetIds?: string[];
  benchmarkAssetIds?: string[];
  stages?: string[];
}

// Fetch an image and downscale it for the BRAIN only. Claude understands a
// product/benchmark from a ~1568px view (Anthropic's recommended max long edge);
// shipping the full print-res master (some are 15-25 MB) blows past Anthropic's
// 5 MB/image limit and stalls every lane. The renderer never sees this — it uses
// the full-res Higgsfield upload ids. JPEG q80 keeps these well under ~300 KB.
async function fetchImage(url: string, label: string): Promise<ImageInput> {
  const startedAt = Date.now();
  timingLog("asset-prep", "brain-image:start", { label });
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const input = Buffer.from(await res.arrayBuffer());
  const data = (
    await sharp(input)
      .rotate() // honor EXIF orientation before we strip metadata
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76 })
      .toBuffer()
  ).toString("base64");
  timingLog("asset-prep", "brain-image:done", {
    label,
    elapsedMs: Date.now() - startedAt,
    inputBytes: input.byteLength,
    outputBase64Chars: data.length,
  });
  return { data, mediaType: "image/jpeg" };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateBody;
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const log = (message: string, data?: Record<string, unknown>) => {
    const elapsedMs = Date.now() - startedAt;
    timingLog(`generate:${requestId}`, message, { elapsedMs, ...data });
  };

  const productBrief = body.productBrief?.trim();
  const productAssetIds = (body.productAssetIds ?? []).filter(Boolean) as Id<"brandAssets">[];
  const benchmarkAssetIds = (body.benchmarkAssetIds ?? []).filter(Boolean) as Id<"brandAssets">[];

  if (!productBrief || productAssetIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "productBrief and at least one product image are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response(JSON.stringify({ error: "NEXT_PUBLIC_CONVEX_URL is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const convex = new ConvexHttpClient(convexUrl);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        log("request:start", {
          productAssetCount: productAssetIds.length,
          benchmarkAssetCount: benchmarkAssetIds.length,
          requestedStages: body.stages?.length ?? 0,
        });

        // 1. The agent system prompt.
        const brief = await readFile(join(process.cwd(), "content", "BRIEF.md"), "utf8");
        log("brief:loaded", { chars: brief.length });

        // 2. Resolve assets (url + cached Higgsfield id) from Convex.
        const all = await convex.query(api.assets.getAssetsByIds, {
          assetIds: [...productAssetIds, ...benchmarkAssetIds],
        });
        const byId = new Map(all.map((a) => [a._id as string, a]));
        const products = productAssetIds.map((id) => byId.get(id)).filter((a) => a && a.url) as typeof all;
        const benchmarks = benchmarkAssetIds.map((id) => byId.get(id)).filter((a) => a && a.url) as typeof all;
        if (products.length === 0) throw new Error("Selected product images not found in library");
        log("assets:resolved", {
          productCount: products.length,
          benchmarkCount: benchmarks.length,
          uncachedProductUploads: products.filter((a) => !a.higgsfieldMediaId).length,
        });

        // 3. Images for the brain (base64), and product upload ids for the renderer —
        //    reuse the cached Higgsfield id when present, else upload once and cache it.
        const [productImages, benchmarkImages, mediaIds] = await Promise.all([
          Promise.all(products.map((a, index) => fetchImage(a.url!, `product:${index}:${a.name}`))),
          Promise.all(benchmarks.map((a, index) => fetchImage(a.url!, `benchmark:${index}:${a.name}`))),
          Promise.all(
            products.map(async (a) => {
              if (a.higgsfieldMediaId) return a.higgsfieldMediaId;
              const mediaId = await uploadImageFromUrl(a.url!);
              await convex.mutation(api.assets.setHiggsfieldId, { assetId: a._id, higgsfieldMediaId: mediaId });
              return mediaId;
            })
          ),
        ]);
        log("assets:prepared", {
          productBrainImages: productImages.length,
          benchmarkBrainImages: benchmarkImages.length,
          mediaIds: mediaIds.length,
        });

        // 4. Sanitize requested stages; fall back to all five.
        const requested = (body.stages ?? []).filter(isAwarenessStage);
        const stages = requested.length > 0 ? requested : [...AWARENESS_STAGES];
        log("swarm:start", { stages });

        for await (const progress of runSwarm(
          {
            brief,
            productBrief,
            brandKit: body.brandKit?.trim() || undefined,
            customerReviews: body.customerReviews?.trim() || undefined,
            referenceAds: body.referenceAds?.trim() || undefined,
            productImages,
            benchmarkImages,
            mediaIds,
          },
          stages
        )) {
          send(progress);
        }
        log("request:complete");
      } catch (err) {
        timingWarn(`generate:${requestId}`, "request:error", {
          elapsedMs: Date.now() - startedAt,
          message: err instanceof Error ? err.message : "Stream error",
        });
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
