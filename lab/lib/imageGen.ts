/**
 * K5 — GPT Image wrapper. Pure: takes a prompt, returns raw image bytes.
 * Storage is intentionally NOT here — the orchestrator injects a `storeImage`
 * hook, so this module has zero Convex/Next dependency and ports 1:1 to lib/.
 */
import OpenAI from "openai";

export interface AdPhoto {
  bytes: Uint8Array;
  contentType: string; // always "image/png" for gpt-image-1
}

export interface GenerateAdPhotoOptions {
  /** "1024x1024" (square, default), "1024x1536" (portrait), "1536x1024" (landscape). */
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  /** gpt-image-1 quality knob. "high" looks best; "medium" is faster/cheaper. */
  quality?: "low" | "medium" | "high";
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Generate one ad photo from a prompt. Square 1:1 by default — the Meta feed
 * card crops to ~1:1 anyway, and it's the cheapest/fastest gpt-image-1 size.
 */
export async function generateAdPhoto(
  prompt: string,
  opts: GenerateAdPhotoOptions = {},
): Promise<AdPhoto> {
  const res = await client().images.generate({
    model: "gpt-image-1",
    prompt,
    size: opts.size ?? "1024x1024",
    quality: opts.quality ?? "high",
    n: 1,
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return {
    bytes: new Uint8Array(Buffer.from(b64, "base64")),
    contentType: "image/png",
  };
}
