/**
 * Track A proof: generate a real ad photo and write it to lab/out/ so we can
 * eyeball realism BEFORE building the swarm. Iterate on the prompt here, then
 * hand Minh (M4) a known-good "imperfect phone-shot UGC" recipe.
 *
 *   cd lab && npm i
 *   OPENAI_API_KEY=sk-... npm run test:image
 */
import { mkdir, writeFile } from "node:fs/promises";
import { generateAdPhoto } from "../lib/imageGen";

// Swap this string while tuning. The goal: looks like a real customer photo,
// NOT a glossy stock render. Phone-shot, natural light, mild imperfection.
const PROMPT = [
  "Authentic UGC-style phone photo for a Meta feed ad.",
  "A real-looking person holding a sleek reusable water bottle at a sunny kitchen counter,",
  "natural window light, slight motion blur, shot on an iPhone, candid and unposed,",
  "imperfect framing, no text, no logos, no watermark, photorealistic, shallow depth of field.",
].join(" ");

async function main() {
  console.log("→ generating ad photo (gpt-image-1, high quality)…");
  const t0 = Date.now();
  const photo = await generateAdPhoto(PROMPT);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  await mkdir(new URL("../out/", import.meta.url), { recursive: true });
  const path = new URL("../out/test-image.png", import.meta.url);
  await writeFile(path, photo.bytes);

  console.log(`✓ ${photo.bytes.length.toLocaleString()} bytes in ${secs}s`);
  console.log(`✓ wrote ${path.pathname}`);
  console.log("→ open it. If it looks like slop, tune PROMPT and re-run.");
}

main().catch((err) => {
  console.error("✗ image generation failed:", err);
  process.exit(1);
});
