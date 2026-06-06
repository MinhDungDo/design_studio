import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

// One DTC ad format preset (a "lane style"). From `ad-formats list`.
export interface AdFormat {
  id: string;
  name: string;
  type: string;
  priority: number;
}

// Thin wrapper around the `higgsfield` CLI. The CLI carries its own auth
// (`higgsfield auth login`) on the host machine — no API key in app env.
// Logs each invocation and surfaces stderr on failure (visible in the dev log).
async function higgsfield(...args: string[]): Promise<string> {
  const label = `${args[0]} ${args[1] ?? ""} ${args[2] ?? ""}`.trim();
  console.log(`[higgsfield] → ${label}`);
  const started = Date.now();
  try {
    const { stdout } = await execFileAsync("higgsfield", args, {
      timeout: 10 * 60 * 1000, // 10 min — generation jobs run with --wait
      maxBuffer: 64 * 1024 * 1024,
    });
    console.log(`[higgsfield] ✓ ${label} (${Date.now() - started}ms)`);
    return stdout.trim();
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
    console.error(`[higgsfield] ✗ ${label} (${Date.now() - started}ms)\n${detail}`);
    throw new Error(`higgsfield ${label} failed: ${detail.slice(0, 400)}`);
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Pull an image (e.g. a Convex storage URL) and upload it to Higgsfield as a
// reference media input. Returns the media id used in `dtc-ads --media`.
export async function uploadImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source image (${res.status}) from ${url}`);
  const mime = (res.headers.get("content-type") ?? "image/png").split(";")[0];
  const ext = EXT_BY_MIME[mime] ?? "png";
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = join(tmpdir(), `ref-${randomUUID()}.${ext}`);
  await writeFile(tmpPath, buf);
  try {
    const out = await higgsfield("upload", "create", tmpPath, "--json");
    const parsed = JSON.parse(out);
    const id = parsed.id ?? parsed.uuid ?? parsed.media_id;
    if (!id) throw new Error(`No media id from 'upload create'. Raw: ${out.slice(0, 300)}`);
    return id as string;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

// The DTC ad formats become the per-run style. Filtered to real headline presets
// (valid uuid + human-cased name) to drop internal/noise rows.
export async function listAdFormats(): Promise<AdFormat[]> {
  const out = await higgsfield("marketing-studio", "ad-formats", "list", "--type", "headline", "--json");
  const all = JSON.parse(out) as AdFormat[];
  return all.filter(
    (f) =>
      f &&
      typeof f.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(f.id) &&
      typeof f.name === "string" &&
      /^[A-Z]/.test(f.name)
  );
}

// Optional: build a brand kit from a store URL so the ad picks up brand colors,
// fonts, and voice. Returns the brand-kit id for `dtc-ads --brand-kit-id`.
export async function fetchBrandKit(url: string): Promise<{ id: string; name?: string }> {
  const out = await higgsfield("marketing-studio", "brand-kits", "fetch", "--url", url, "--wait", "--json");
  const k = JSON.parse(out);
  const id = k.id ?? k.uuid;
  if (!id) throw new Error(`No brand kit id from 'brand-kits fetch'. Raw: ${out.slice(0, 300)}`);
  return { id, name: k.name };
}

async function downloadToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download result image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

export interface DtcAdInput {
  prompt: string;
  formatId: string;
  mediaIds: string[];
  brandKitId?: string;
  aspectRatio?: string;
  quality?: "low" | "medium" | "high";
  resolution?: "1k" | "2k" | "4k";
}

// Generate one branded DTC ad. Higgsfield's backend writes the copy and bakes it
// into the image from (prompt + format + brand kit + reference product image).
export async function runDtcAd(input: DtcAdInput): Promise<{ imageBase64: string; imageUrl: string }> {
  const args = [
    "marketing-studio", "dtc-ads", "generate",
    "--prompt", input.prompt,
    "--format-id", input.formatId,
    "--aspect-ratio", input.aspectRatio ?? "1:1",
    "--quality", input.quality ?? "low",
    "--resolution", input.resolution ?? "1k",
    "--wait", "--json",
  ];
  for (const mediaId of input.mediaIds) args.push("--media", `${mediaId}:image`);
  if (input.brandKitId) args.push("--brand-kit-id", input.brandKitId);

  const out = await higgsfield(...args);
  // `dtc-ads generate --json` returns an array of job objects (one per batch item),
  // each with a top-level `result_url`. Verified against a live run.
  const parsed = JSON.parse(out);
  const job = Array.isArray(parsed) ? parsed[0] : parsed;
  const resultUrl: string | undefined =
    job?.result_url ?? job?.url ?? job?.results?.[0]?.url ?? job?.images?.[0]?.url;
  if (!resultUrl) throw new Error(`No result URL from dtc-ads job. Raw: ${out.slice(0, 500)}`);
  return { imageBase64: await downloadToBase64(resultUrl), imageUrl: resultUrl };
}
