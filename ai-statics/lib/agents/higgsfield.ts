import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { timingLog, timingWarn } from "./timingLog";

const execFileAsync = promisify(execFile);

// Thin wrapper around the `higgsfield` CLI. The CLI carries its own auth
// (`higgsfield auth login`) on the host machine — no API key in app env.
async function higgsfield(args: string[], timeoutMs = 10 * 60 * 1000): Promise<string> {
  const { stdout } = await execFileAsync("higgsfield", args, {
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Pull an image (e.g. a Convex storage URL) and upload it to Higgsfield as a
// reference media input. Returns the upload id used in `generate create --image`.
export async function uploadImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source image (${res.status}) from ${url}`);
  const mime = (res.headers.get("content-type") ?? "image/png").split(";")[0];
  const ext = EXT_BY_MIME[mime] ?? "png";
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = join(tmpdir(), `ref-${randomUUID()}.${ext}`);
  await writeFile(tmpPath, buf);
  try {
    // The presigned PUT to Higgsfield's CDN occasionally drops ("Cannot reach …");
    // retry a couple times before failing the whole run.
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const startedAt = Date.now();
        timingLog("higgsfield", "upload:start", { attempt, bytes: buf.byteLength, mime });
        const out = await higgsfield(["upload", "create", tmpPath, "--json"], 90 * 1000);
        const parsed = JSON.parse(out);
        const id = parsed.id ?? parsed.uuid ?? parsed.media_id;
        if (!id) throw new Error(`No media id from 'upload create'. Raw: ${out.slice(0, 300)}`);
        timingLog("higgsfield", "upload:done", { attempt, elapsedMs: Date.now() - startedAt });
        return id as string;
      } catch (err) {
        lastErr = err;
        timingWarn("higgsfield", "upload:retry", {
          attempt,
          message: err instanceof Error ? err.message : "Unknown upload error",
        });
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastErr;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export interface RenderInput {
  prompt: string;
  negativePrompt?: string;
  mediaIds: string[]; // product reference upload ids to preserve
  aspectRatio: string;
  quality?: "low" | "medium" | "high";
  resolution?: "1k" | "2k" | "4k";
}

// Render one ad with GPT Image 2. The brain wrote the full prompt (incl. in-image
// headline); gpt_image_2 has no negative-prompt field, so we fold it into the text.
export async function renderGptImage2(input: RenderInput): Promise<{ imageUrl: string }> {
  const startedAt = Date.now();
  const prompt = input.negativePrompt?.trim()
    ? `${input.prompt}\n\nDo NOT include: ${input.negativePrompt.trim()}`
    : input.prompt;
  timingLog("higgsfield", "render:start", {
    aspectRatio: input.aspectRatio,
    quality: input.quality ?? "high",
    resolution: input.resolution ?? "2k",
    mediaIds: input.mediaIds.length,
    promptChars: prompt.length,
  });

  const cli = [
    "generate", "create", "gpt_image_2",
    "--prompt", prompt,
    "--aspect_ratio", input.aspectRatio,
    "--quality", input.quality ?? "high",
    "--resolution", input.resolution ?? "2k",
    "--wait", "--json",
  ];
  for (const id of input.mediaIds) cli.push("--image", id);

  const out = await higgsfield(cli);
  // `generate create --json` returns an array of job objects with `result_url`.
  const parsed = JSON.parse(out);
  const job = Array.isArray(parsed) ? parsed[0] : parsed;
  const resultUrl: string | undefined =
    job?.result_url ?? job?.url ?? job?.results?.[0]?.url ?? job?.images?.[0]?.url;
  if (!resultUrl) throw new Error(`No result URL from gpt_image_2 job. Raw: ${out.slice(0, 500)}`);
  timingLog("higgsfield", "render:done", { elapsedMs: Date.now() - startedAt });
  return { imageUrl: resultUrl };
}
