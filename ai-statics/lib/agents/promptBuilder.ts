import { AwarenessStage, STAGE_LABEL, STAGE_BRIEF } from "./awareness";

// Assemble the image brief handed to Higgsfield's DTC Ads engine. Layers, in order:
// the shared internal brief (content/BRIEF.md: brand + ICP + visual identity), the
// per-run offer and product specifics, and the awareness-stage directive so each lane
// targets a different stage.
export function buildAdPrompt(
  brief: string,
  offer: string,
  productDetails: string | undefined,
  stage: AwarenessStage
): string {
  const lines = [
    brief.trim(),
    "",
    `OFFER / WHAT WE'RE ADVERTISING: ${offer.trim()}`,
  ];
  if (productDetails?.trim()) {
    lines.push("", `PRODUCT DETAILS: ${productDetails.trim()}`);
  }
  lines.push(
    "",
    `AWARENESS STAGE — ${STAGE_LABEL[stage]}: ${STAGE_BRIEF[stage]}`,
    `Make this ad unmistakably target the ${STAGE_LABEL[stage]} stage. Keep the product from the reference image intact (shape, colors, labels, branding); only reimagine the scene around it.`
  );
  return lines.join("\n");
}
