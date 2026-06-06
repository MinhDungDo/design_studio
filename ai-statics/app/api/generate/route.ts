import { NextRequest } from "next/server";
import { runOrchestrator, GenerationInput } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 min timeout for image gen

export async function POST(req: NextRequest) {
  const body = await req.json() as GenerationInput;

  // Validate required fields — only the product photo is mandatory; all written
  // context (brief, brand kit, reviews, reference ads) is optional and the agents
  // fall back to inferring from the photo when it's missing.
  if (!body.productImage?.data) {
    return new Response(
      JSON.stringify({ error: "productImage is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream progress back to the client as newline-delimited JSON
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const progress of runOrchestrator(body)) {
          const chunk = JSON.stringify(progress) + "\n";
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const errorChunk = JSON.stringify({
          step: "error",
          message: err instanceof Error ? err.message : "Stream error",
        }) + "\n";
        controller.enqueue(encoder.encode(errorChunk));
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
