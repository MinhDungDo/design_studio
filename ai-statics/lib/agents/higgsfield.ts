import { execa } from "execa";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

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
    // execa (not node:child_process directly): the npm-installed CLI is a `.cmd`
    // shim on Windows — execFile can't spawn it without shell:true, and shell:true
    // would pass these args (which include LLM-authored prompt text) through
    // cmd.exe unescaped, opening up command injection. execa resolves the shim
    // and safely escapes args without shell interpretation.
    //
    // Spawning a `.cmd` shim still forces Windows to relay the argv through
    // `cmd.exe /c`, and cmd.exe's line-based parsing truncates any quoted
    // argument at its first embedded newline — silently dropping every flag
    // that follows (observed as a phantom "Flag --format-id is required",
    // because the multi-line prompt's line breaks ate the rest of the argv).
    // No argument here is meant to carry real newlines, so flatten them first.
    const safeArgs = args.map((a) => a.replace(/\r\n|\r|\n/g, " "));
    const { stdout } = await execa("higgsfield", safeArgs, {
      timeout: 10 * 60 * 1000, // 10 min — generation jobs run with --wait
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

export interface DtcAdImage {
  imageBase64: string;
  imageUrl: string;
}

export interface DtcAdInput {
  prompt: string;
  formatId: string;
  mediaIds: string[];
  brandKitId?: string;
  aspectRatio?: string;
  quality?: "low" | "medium" | "high";
  resolution?: "1k" | "2k" | "4k";
  // How many ad variations to produce from this one prompt (Higgsfield `--batch-size`,
  // 1..20 — each is its own billable job, run as one job set).
  variants?: number;
}

// Generate one or more branded DTC ad variations from the same prompt. Higgsfield's
// backend writes the copy and bakes it into the image from (prompt + format + brand
// kit + reference product image(s)).
export async function runDtcAd(input: DtcAdInput): Promise<{ images: DtcAdImage[] }> {
  const batchSize = Math.min(Math.max(Math.trunc(input.variants ?? 1), 1), 20);
  const args = [
    "marketing-studio", "dtc-ads", "generate",
    "--prompt", input.prompt,
    "--format-id", input.formatId,
    "--aspect-ratio", input.aspectRatio ?? "1:1",
    "--quality", input.quality ?? "low",
    "--resolution", input.resolution ?? "1k",
    "--batch-size", String(batchSize),
    "--wait", "--json",
  ];
  for (const mediaId of input.mediaIds) args.push("--media", `${mediaId}:image`);
  if (input.brandKitId) args.push("--brand-kit-id", input.brandKitId);

  const out = await higgsfield(...args);
  // `dtc-ads generate --json` returns an array of job objects — one per batch-size
  // unit, each an independently completed job with its own top-level `result_url`.
  // Verified against a live `--batch-size 2` run (two distinct ids + result_urls).
  const parsed = JSON.parse(out);
  const jobs = Array.isArray(parsed) ? parsed : [parsed];
  const resultUrls = jobs
    .map((job) => job?.result_url ?? job?.url ?? job?.results?.[0]?.url ?? job?.images?.[0]?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
  if (resultUrls.length === 0) {
    throw new Error(`No result URLs from dtc-ads job set. Raw: ${out.slice(0, 500)}`);
  }
  const images = await Promise.all(
    resultUrls.map(async (imageUrl) => ({ imageBase64: await downloadToBase64(imageUrl), imageUrl }))
  );
  return { images };
}
