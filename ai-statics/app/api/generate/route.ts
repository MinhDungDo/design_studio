import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { runSwarm } from "@/lib/agents/orchestrator";
import { AWARENESS_STAGES, isAwarenessStage } from "@/lib/agents/awareness";
import { uploadImageFromUrl } from "@/lib/agents/higgsfield";
import { ImageInput } from "@/lib/agents/brain";

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
async function fetchImage(url: string): Promise<ImageInput> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const input = Buffer.from(await res.arrayBuffer());
  const data = (
    await sharp(input)
      .rotate() // honor EXIF orientation before we strip metadata
      .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  ).toString("base64");
  return { data, mediaType: "image/jpeg" };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateBody;

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
        // 1. The agent system prompt.
        const brief = await readFile(join(process.cwd(), "content", "BRIEF.md"), "utf8");

        // 2. Resolve assets (url + cached Higgsfield id) from Convex.
        const all = await convex.query(api.assets.listAssets, {});
        const byId = new Map(all.map((a) => [a._id as string, a]));
        const products = productAssetIds.map((id) => byId.get(id)).filter((a) => a && a.url) as typeof all;
        const benchmarks = benchmarkAssetIds.map((id) => byId.get(id)).filter((a) => a && a.url) as typeof all;
        if (products.length === 0) throw new Error("Selected product images not found in library");

        // 3. Images for the brain (base64), and product upload ids for the renderer —
        //    reuse the cached Higgsfield id when present, else upload once and cache it.
        const [productImages, benchmarkImages, mediaIds] = await Promise.all([
          Promise.all(products.map((a) => fetchImage(a.url!))),
          Promise.all(benchmarks.map((a) => fetchImage(a.url!))),
          Promise.all(
            products.map(async (a) => {
              if (a.higgsfieldMediaId) return a.higgsfieldMediaId;
              const mediaId = await uploadImageFromUrl(a.url!);
              await convex.mutation(api.assets.setHiggsfieldId, { assetId: a._id, higgsfieldMediaId: mediaId });
              return mediaId;
            })
          ),
        ]);

        // 4. Sanitize requested stages; fall back to all five.
        const requested = (body.stages ?? []).filter(isAwarenessStage);
        const stages = requested.length > 0 ? requested : [...AWARENESS_STAGES];

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
