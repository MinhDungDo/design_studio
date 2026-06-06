import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ImagePromptOutput } from "./imagePromptAgent";

const execFileAsync = promisify(execFile);

export interface ProductImageInput {
  data: string; // base64-encoded image bytes (no "data:" URL prefix)
  mimeType: string; // e.g. "image/png", "image/jpeg", "image/webp"
}

export interface ImageGeneratorOutput {
  imageBase64: string;
  imageUrl?: string;
  revisedPrompt?: string;
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  "1024x1024": "1:1",
  "1536x1024": "3:2",
  "1024x1536": "2:3",
};

async function higgsfield(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("higgsfield", args, {
    timeout: 10 * 60 * 1000, // 10 minutes
  });
  return stdout.trim();
}

async function uploadProductImage(productImage: ProductImageInput): Promise<string> {
  const ext = EXTENSION_BY_MIME_TYPE[productImage.mimeType] ?? "png";
  const tmpPath = join(tmpdir(), `product-${randomUUID()}.${ext}`);

  await writeFile(tmpPath, Buffer.from(productImage.data, "base64"));
  try {
    const output = await higgsfield("upload", tmpPath, "--json");
    const parsed = JSON.parse(output);
    return parsed.id ?? parsed.uuid;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function downloadToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

export async function runImageGenerator(
  promptData: ImagePromptOutput,
  productImage: ProductImageInput
): Promise<ImageGeneratorOutput> {
  // Upload the customer's product photo to Higgsfield and get back a UUID.
  const imageId = await uploadProductImage(productImage);

  const aspectRatio = SIZE_TO_ASPECT_RATIO[promptData.size] ?? "1:1";

  // Generate the ad image via Higgsfield CLI using GPT Image 2.
  // --wait blocks until the job completes and returns the result URL.
  const output = await higgsfield(
    "generate", "create", "gpt_image_2",
    "--prompt", promptData.prompt,
    "--image", imageId,
    "--aspect_ratio", aspectRatio,
    "--quality", promptData.quality,
    "--wait",
    "--json"
  );

  const result = JSON.parse(output);
  const resultUrl: string | undefined = result.result_url ?? result.url;

  if (!resultUrl) throw new Error("No result URL returned from Higgsfield GPT Image 2 job");

  // Download the generated image and convert to base64 for the UI.
  const imageBase64 = await downloadToBase64(resultUrl);

  return {
    imageBase64,
    imageUrl: resultUrl,
  };
}
