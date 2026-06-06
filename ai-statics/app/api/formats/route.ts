import { listAdFormats } from "@/lib/agents/higgsfield";

export const runtime = "nodejs"; // uses the `higgsfield` CLI (execFile)

// The form's ad-format picker. Each format becomes the per-run lane style.
export async function GET() {
  try {
    const formats = await listAdFormats();
    return Response.json({ formats });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list ad formats" },
      { status: 500 }
    );
  }
}
