# AI Statics — MVP

Direct-response static ad generator. **One ICP → one ad per awareness stage.**
The "Supercomputer" pattern: **Claude (the brain) runs `content/BRIEF.md`** as its
system prompt and writes a `gpt-image-2` production prompt per stage; **Higgsfield
renders** it with the real product image.

## Architecture

```
Next.js App
  └── /app/api/generate/route.ts     ← reads BRIEF.md, fetches/uploads images, streams the swarm (NDJSON)
        └── lib/agents/
              ├── brain.ts            ← Claude (BRIEF.md = system prompt, multimodal) → Final Direction
              ├── higgsfield.ts       ← `higgsfield` CLI client: upload + gpt_image_2 render
              ├── orchestrator.ts     ← per awareness stage: brain → render, streams progress
              └── awareness.ts        ← the 5 awareness stages + per-stage briefs

content/BRIEF.md   ← the agent system prompt (4-phase DR Art Director + brand pack)
convex/            ← brand-asset image library (_storage): products + example ads
```

**Pipeline (per awareness stage):**
1. **Claude** gets `BRIEF.md` (system) + the form inputs + the **product image(s)** and any **example/benchmark ad images** (multimodal), runs the 4 phases, returns `{ headline, finalImagePrompt, negativePrompt, aspectRatio, caption, … }`.
2. **Higgsfield** `generate create gpt_image_2 --image <product upload>` renders the prompt (headline baked into the pixels). Streamed live.

Two image roles: **product images** are preserved (sent to Claude *and* to the renderer); **example ads** are style direction (sent to Claude only — composition/mood, never branding).

## Quickstart

### 1. Higgsfield CLI auth
```
higgsfield auth login
```

### 2. Anthropic key (the brain)
In `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
# CLAUDE_MODEL=claude-sonnet-4-6   # or claude-opus-4-8
```

### 3. Convex (brand-asset backend)
```
npx convex dev
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

## Higgsfield commands we use
(Kept here, NOT in BRIEF.md, so they never leak into a generation prompt.)
- `higgsfield upload create <file> --json` → upload id for the product image
- `higgsfield generate create gpt_image_2 --prompt <brief> --image <id> --aspect_ratio <ar> --quality high --resolution 2k --wait --json` → one ad
- `higgsfield generate cost gpt_image_2 …` / `--cost-only` → preview credits

## Cost
- Each awareness-stage lane = one Claude call + one billable Higgsfield render. `SWARM_CONCURRENCY` caps parallelism.
- Dev: lower `--quality`/`--resolution` in `higgsfield.ts`; bump for finals.

## Notes
- `gpt_image_2` aspect ratios: `1:1,4:3,3:4,16:9,9:16,3:2,2:3` (no 4:5 — the brain maps IG-feed to 2:3).
- `virality_predictor` is video-only, so there's no automated image scorer.
