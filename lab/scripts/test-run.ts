/**
 * Track B proof: run the FULL orchestrator on stubbed agents + real GPT Image,
 * with console.log as emitEvent and writeFile as storeImage. Proves control
 * flow + parallel fan-out + the event stream WITHOUT Convex or Minh's agents.
 *
 *   cd lab && npm i
 *   OPENAI_API_KEY=sk-... npm run test:run
 *
 * Set SKIP_IMAGE=1 to exercise the pipeline/event stream without spending on
 * image generation (uses a tiny fake photo).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { generateRun } from "../lib/orchestrator";
import { seedBrandKit, seedSegments, seedProofAssets } from "../lib/seed";
import type { AgentEvent, StoreImage } from "../lib/types";

const RUN_ID = "run_lab_001";
const skipImage = process.env.SKIP_IMAGE === "1";

const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(2).padStart(6) + "s";

const emitEvent = (e: AgentEvent) => {
  const lane = e.segmentId ?? "ORCH";
  const icon = e.status === "completed" ? "✓" : e.status === "failed" ? "✗" : "·";
  console.log(
    `[${stamp()}] ${icon} ${lane.padEnd(8)} ${e.agent.padEnd(12)} ${e.status}` +
      (e.message ? `  — ${e.message}` : ""),
  );
};

const storeImage: StoreImage = async (photo, meta) => {
  const dir = new URL("../out/", import.meta.url);
  await mkdir(dir, { recursive: true });
  const file = new URL(`./${meta.runId}-${meta.segmentId}.png`, dir);
  await writeFile(file, photo.bytes);
  return { imageUrl: file.pathname };
};

// 1x1 transparent PNG — injected as a fake photo so we can prove the pipeline +
// event stream without OpenAI spend (or when the billing limit is hit).
const FAKE_PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQDJVT3xAAAAAElFTkSuQmCC",
    "base64",
  ),
);
const fakeGenerateImage = async (_prompt: string) => {
  await new Promise((r) => setTimeout(r, 400)); // mimic API latency for the live view
  return { bytes: FAKE_PNG, contentType: "image/png" };
};

async function main() {
  if (skipImage) {
    console.log("⚠ SKIP_IMAGE=1 — using a fake 1x1 photo (no OpenAI spend).\n");
  }
  console.log(`→ generateRun(${RUN_ID}) — ${seedSegments.length} personas\n`);

  const drafts = await generateRun(
    {
      runId: RUN_ID,
      brandKit: seedBrandKit,
      segments: seedSegments,
      proofAssets: seedProofAssets,
    },
    {
      emitEvent,
      storeImage,
      ...(skipImage ? { generateImage: fakeGenerateImage } : {}),
    },
  );

  console.log(`\n→ ${drafts.length} AdDrafts:`);
  for (const d of drafts) {
    console.log(`\n  ● ${d.segmentId}`);
    console.log(`    headline: ${d.copy.headline}`);
    console.log(`    primary : ${d.copy.primary}`);
    console.log(`    cta     : ${d.copy.cta}`);
    console.log(`    photo   : ${d.imageUrl ?? "(none)"}`);
  }
  console.log(`\n✓ done in ${stamp()}`);
}

main().catch((err) => {
  console.error("✗ run failed:", err);
  process.exit(1);
});
