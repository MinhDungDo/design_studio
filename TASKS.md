# AdSwarm — Hackathon Task Board

AI static-ad generator. **One persona → many ads, one per awareness stage.**
Same product, same buyer; the angle, copy, and scene shift as the buyer gets more
aware (Schwartz: unaware → problem-aware → solution-aware → product-aware → most-aware).

**Team:** Kevin (Backend/Pipeline) · Minh (Agents + Frontend craft) · Ale (Product Owner)

## 🧱 Actual stack (as built, in `ai-statics/`)
- **Next.js 16** App Router. Generation runs in a **Next API route**
  (`app/api/generate/route.ts`) that **streams NDJSON** progress — not Convex.
- **Text agents → Qwen** (`qwen-max` via DashScope OpenAI-compatible endpoint,
  `lib/agents/model.ts` → `brain`). Needs `DASHSCOPE_API_KEY`. (No OpenAI.)
- **Image → Higgsfield CLI** `gpt_image_2` (`lib/agents/imageGenerator.ts`), the
  **product photo passed as a reference** so the real product stays intact. Needs
  the `higgsfield` CLI installed + authenticated on the server machine.
- **Convex:** scaffolded but **deferred** (orphaned; not wired). Replay can be a
  static fixture later. `lab/` (Kevin's Convex-reactive prototype) is **superseded
  reference only**.

## 🥇 The one rule
**Have ONE genuinely beautiful, real-looking ad end-to-end from a real product
photo.** If it looks like slop, fix the look before scaling the swarm. QC =
human feedback for v1 (an `adScorer` agent also scores each ad).

---

## Pipeline (per awareness stage — N run in parallel)
```
runSwarm(input, stages)  — fans out across the selected awareness stages
  └─ for each stage → runLane:
       Strategy (Qwen, stage-targeted) ──┬─► Copy (Qwen)         → headline/sub/body/cta
                                         └─► Image Prompt (Qwen) → editing prompt
                                                └─► Higgsfield gpt_image_2 (product photo = reference) → ad image
       └─► adScorer (Qwen) → 0-100 + feedback
  every step emits a laneId-tagged ProgressStep → merged into one NDJSON stream
  → UI renders one progress column per stage, then a grid of finished ads
```

## ✅ Implemented on `kevin/pipeline`
- `lib/agents/awareness.ts` — stages, labels, per-stage creative briefs, defaults.
- `strategyAgent` — driven by `targetAwarenessStage` + `persona`.
- `orchestrator` — `runLane` + `runSwarm` (parallel fan-out, concurrency-capped
  via `SWARM_CONCURRENCY`, merged stream, `laneComplete`/`swarmComplete` events).
- `route.ts` — calls `runSwarm`, sanitizes requested stages, `maxDuration=300`.
- UI — `InputForm` (persona + stage picker), `page.tsx` (per-lane state + swarm
  grid), `GenerationProgress` (one column per stage), `AdResult` (stage label).
- Typecheck + lint clean (0 errors).

---

## Phase 0 — Shared setup (BOTH devs, 0:00–0:30)
- [ ] **S1** `create-next-app` (TS/App Router/Tailwind); `npm i convex ai @ai-sdk/openai zod`; `npx convex dev`; set `OPENAI_API_KEY` — *Minh leads; Kevin parallel in `lab/`*
- [ ] **S2** `lib/types.ts` — Zod schemas + types: `BrandKit, IcpSegment, ProofAsset, Strategy, AdDraft, AgentEvent` + the agent signatures — *Kevin drafts, locks with Minh at IC1*
- [ ] **S3** Seed fixture from Ale's P2/P3/P4 (placeholder until P2 v1 lands at IC1) — *Kevin*

---

## 👤 Kevin — Convex DB · Image Storage · Generation Pipeline
- [ ] **K1** [MVP] Convex schema — 6 tables (`brandKits, icpSegments, proofAssets, runs, agentEvents, ads`)
- [ ] **K2** [MVP] Image storage — `generateUploadUrl` mutation + `getImageUrl(storageId)` query
- [ ] **K3** [MVP] Mutations — `createBrandKit, addSegment, addProofAsset, startRun`
- [ ] **K4** [MVP] Reactive queries — `getBrandKit, getRun, listAgentEvents(runId), listAds(runId)`
- [ ] **K5** [MVP] GPT Image wrapper — `generateAdPhoto(prompt)` → bytes → store (raw OpenAI images call)
- [ ] **K6** [MVP] `startRun` action (`"use node"`) — calls `generateRun` with emitEvent + storeImage hooks
- [ ] **K7** [MVP] **Orchestrator / Generation Pipeline** — `generateRun`: per-persona Strategy → `Promise.all([Copy, ImagePrompt])` → photo → store; fan out across 3 personas; emit event per step
- [ ] **K8** [MVP] Hook wiring — `emitEvent` (mutation) + `storeImage` (storage); confirm photos persist
- [ ] **K9** [MVP] **Live swarm view** (frontend) — subscribe `listAgentEvents`; orchestrator + 3 persona lanes light up (build with FAKE events first)
- [ ] **K10** [MVP] **Results grid** (frontend) — 3× Minh's `<MetaAd>` from `listAds` + labels + run summary
- [ ] **K11** [Refine] `regenerateAd(runId, segmentId)` action — re-runs one persona's path (powers human QC)
- [ ] **K12** [Refine] Replay / demo-cache — store one pre-generated run; toggle replays it without the API

## 👤 Minh — Agents (Vercel AI SDK) + Frontend craft
- [ ] **M1** [MVP] Psychology playbook (`psychologyNotes`) — awareness stages, angles, proof mapping (Ale refines via P6)
- [ ] **M2** [MVP] **Strategy Generator** — `generateObject` → `{awarenessStage, angle, emotion, setting, bigIdea, proofAssetId}`
- [ ] **M3** [MVP] **Copy Generator** (Direct Response) — `{headline, primary, cta}` from Strategy
- [ ] **M4** [MVP] **Image Prompt Generator** (Art Director) — `{imagePrompt}` ("imperfect phone-shot UGC, natural light…")
- [ ] **M5** [MVP] Prompt tuning — paired with Ale (P7) until photos look real + copy lands
- [ ] **M6** [MVP] App shell — `ConvexProvider`, layout, Tailwind, routes (`/setup`, `/generate`)
- [ ] **M7** [MVP] **Brand Kit form** — name, logo upload, colors, font, tone, product images, 1-3 segments, proof assets → K2/K3
- [ ] **M8** [MVP] **`<MetaAd>` component** — pixel-real FB/IG sponsored post: profile row, "Sponsored", photo bg, headline/primary/CTA in brand font+colors, Like/Comment/Share bar
- [ ] **M9** [Refine] PNG download — `@vercel/og` (or `html-to-image`) rasterizes `<MetaAd>` → download
- [ ] **M10** [Refine] 👍/👎 + "Regenerate" button per ad → `regenerateAd`

## 👤 Ale — Product Owner (Content · Taste · Demo)
Delivers the **Asset Pack** in waves: v1 by IC1 (0:30), final by IC2 (1:30). Unblocks; never blocked.
- [ ] **P1** [MVP] Pick the demo brand — visually rich, real product photos available (by 0:15)
- [ ] **P2** [MVP] Brand pack — logo, hex colors, font, 5-10 high-res product images, tone, copyright (v1 0:30 / final 1:30)
- [ ] **P3** [MVP] Persona pack — 3 ICP segments: name, description, awareness stage, pains, objections (0:30)
- [ ] **P4** [MVP] Proof pack — real reviews, survey stats, testimonials (0:30)
- [ ] **P5** [Refine] Benchmark pack — 5-10 great Meta ads (screenshots) annotated with *why* they work
- [ ] **P6** [Refine] Style guide — distill P5 into a 1-page brief for the Image Prompt + Copy prompts
- [ ] **P7** **Human QC loop** — sit with Minh during tuning; reject slop, approve "would actually run this" (ongoing from IC2)
- [ ] **P8** [Refine] Demo script + present — 60-90s story: problem → drop brand → watch swarm → 3 ads → regenerate one → download

---

## 🔗 Integration checkpoints (everyone stops & syncs)
- [ ] **IC1 (0:30)** — `types.ts` frozen; **GPT Image proven** (real photo on disk); **Ale Brand pack v1 + 3 personas** delivered; Kevin seeds with real content
- [ ] **IC2 (1:30)** — ONE real ad end-to-end from Ale's brand; **Ale approves the look**; final Asset Pack in
- [ ] **IC3 (2:15)** — parallel fan-out emits real events into K9 live view; 3 ads generate from the 3 personas
- [ ] **🎯 MVP DEMO (3:00)** — full run on screen: setup → swarm → 3 distinct on-brand ads. **Stop, demo, then refine.**

## ➕ Refine phase (3:00+) — make it demo-day solid
- [ ] K12 replay mode works offline (no live API dependency during judging)
- [ ] M9 PNG download produces a clean file
- [ ] K11/M10 "Regenerate the weak one" moment rehearsed
- [ ] P5/P6 benchmark + style guide tighten the look
- [ ] P8 demo script dry-run twice

## ✅ Demo-day checklist
- [ ] 3 ads are visibly distinct (different angle/awareness per persona)
- [ ] Text is crisp + on-brand on every ad (Satori, not baked into the image)
- [ ] Live swarm view is visibly *parallel* (lanes light up together)
- [ ] Replay mode works offline (refine)
- [ ] "Regenerate the weak one" moment rehearsed (refine)
- [ ] PNG download produces a clean file (refine)
