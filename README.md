# AI Statics — MVP

Direct-response static ad generator. **One ICP → one ad per awareness stage.**
The "Supercomputer" pattern: **Claude (the brain) runs `content/BRIEF.md`** as its
system prompt and writes a `gpt-image-2` production prompt per stage; **Higgsfield
renders** it with the real product image.

## Architecture

```
Next.js App
  └── /app/api/generate/route.ts     ← reads BRIEF.md, resolves assets, downscales
        │                              images for the brain, caches upload ids,
        │                              streams the swarm (NDJSON)
        └── lib/agents/
              ├── brain.ts            ← Claude (BRIEF.md = system prompt, multimodal) → Final Direction
              ├── higgsfield.ts       ← `higgsfield` CLI client: upload + gpt_image_2 render
              ├── orchestrator.ts     ← per awareness stage: brain → render, streams progress
              └── awareness.ts        ← the 5 awareness stages + per-stage briefs

content/BRIEF.md   ← the agent system prompt (4-phase DR Art Director + brand pack)
convex/            ← brand-asset image library (_storage): products + example ads
```

**Pipeline (per awareness stage):**
1. **Claude** gets `BRIEF.md` (system) + the form inputs + the **product image(s)** and any
   **example/benchmark ad images** (multimodal), runs the 4 phases, and returns
   `{ headline, subline?, finalImagePrompt, negativePrompt, aspectRatio, caption }`.
2. **Higgsfield** `generate create gpt_image_2 --image <product upload>` renders the prompt
   (headline baked into the pixels). Streamed live.

Two image roles:
- **Product images** — preserved. Sent to Claude (downscaled, see below) *and* uploaded to
  Higgsfield as `--image` masters for the render.
- **Example / benchmark ads** — style direction only. Sent to **Claude only** (composition/mood,
  never branding); never uploaded to the renderer.

### Image handling (two paths, on purpose)
- **To the brain:** every image is downscaled to ≤1568px JPEG (q80) before it's sent to Claude.
  Print-res masters (15–25 MB) otherwise blow past Anthropic's 5 MB/image limit and stall the
  call. Claude only needs to *understand* the product, not reproduce it. Uses `sharp`.
- **To the renderer:** the **full-res original** is uploaded to Higgsfield **once, ever** — the
  upload id is cached on the Convex asset (`higgsfieldMediaId`) and reused on every later run, so
  repeat generations skip uploads entirely and go straight to brain → render.

## Quickstart

### 1. Higgsfield CLI auth
```
higgsfield auth login
```

### 2. Anthropic key (the brain)
In `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
# CLAUDE_MODEL=claude-sonnet-4-6   # default; claude-opus-4-8 for max quality
```

### 3. Convex (brand-asset backend)
```
npx convex dev    # keep this running — it pushes schema/function changes
```
Copy the printed URL into `.env.local`: `NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud`

### 4. Fill in the brief
Edit `content/BRIEF.md` — the agent prompt + the brand pack (ICP, voice, camera). Swap Appendix A/B for a new brand.

### 5. Run
```
npm install
npm run dev
```
Open http://localhost:3000 — upload product image(s) (and optional example ads), fill the brief fields, pick awareness stages, generate.

## Environment

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ANTHROPIC_API_KEY` | ✅ | — | The brain (Claude). |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | — | Brand-asset backend. |
| `CLAUDE_MODEL` | — | `claude-sonnet-4-6` | Brain model. `claude-opus-4-8` for finals. |
| `SWARM_CONCURRENCY` | — | `min(stages, 3)` | Lanes run in parallel. |
| `RENDER_QUALITY` | — | `medium` | gpt_image_2 quality: `low`/`medium`/`high`. |
| `RENDER_RESOLUTION` | — | `1k` | gpt_image_2 resolution: `1k`/`2k`/`4k`. |

## Higgsfield commands we use
(Kept here, NOT in BRIEF.md, so they never leak into a generation prompt.)
- `higgsfield upload create <file> --json` → upload id for the product image (cached in Convex)
- `higgsfield generate create gpt_image_2 --prompt <brief> --image <id> --aspect_ratio <ar> --quality <q> --resolution <r> --wait --json` → one ad

## Cost
- Each awareness-stage lane = one Claude call + one billable Higgsfield render. `SWARM_CONCURRENCY` caps parallelism.
- Dev favors speed: render defaults to `medium`/`1k`. Bump `RENDER_QUALITY`/`RENDER_RESOLUTION` for finals — no code change.
- Product uploads are billed/cached once per image (first run only); reruns reuse the cached id.

## Notes
- `gpt_image_2` aspect ratios: `1:1,4:3,3:4,16:9,9:16,3:2,2:3` (no 4:5 — the brain maps IG-feed to 2:3).
- `virality_predictor` is video-only, so there's no automated image scorer.
- `sharp` is a direct dependency (image downscaling for the brain) — don't rely on it resolving via `next`.
