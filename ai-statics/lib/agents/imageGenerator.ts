import OpenAI, { toFile } from "openai";
import { ImagePromptOutput } from "./imagePromptAgent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function runImageGenerator(
  promptData: ImagePromptOutput,
  productImage: ProductImageInput
): Promise<ImageGeneratorOutput> {
  // Edit the customer's real product photo into the new ad scene (instead of
  // generating from scratch) so the actual product stays intact and recognizable.
  const referenceImage = await toFile(
    Buffer.from(productImage.data, "base64"),
    `product.${EXTENSION_BY_MIME_TYPE[productImage.mimeType] ?? "png"}`,
    { type: productImage.mimeType }
  );

  const response = await openai.images.edit({
    model: "gpt-image-2",
    image: referenceImage,
    prompt: promptData.prompt,
    n: 1,
    size: promptData.size,
    quality: promptData.quality,
    input_fidelity: "high",
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("No image data returned from GPT Image 2");

  return {
    imageBase64: imageData.b64_json ?? "",
    revisedPrompt: imageData.revised_prompt,
  };
}
