# lab/ — Kevin's pipeline sandbox

Isolated so the **framework-agnostic** pipeline runs *before* Minh's Next.js +
Convex scaffold lands. Nothing here ships as-is — it ports 1:1 into the app:

| lab path | ports to | task |
|----------|----------|------|
| `lib/types.ts` | `lib/types.ts` | S2 (the contract — freeze with Minh @ IC1) |
| `lib/imageGen.ts` | `lib/imageGen.ts` | K5 (GPT Image wrapper) |
| `lib/agents/stubs.ts` | replaced by Minh's M2–M4 | swap import only |
| `lib/orchestrator.ts` | `lib/orchestrator.ts` | K7 (generateRun) |
| `lib/seed.ts` | replaced by Ale's pack @ IC1 | S3 |
| `convex/*.ts` | `convex/*.ts` | K1–K4, K6, K8 |

## Run the proofs

```bash
cd lab
npm i
cp .env.example .env   # paste your OPENAI_API_KEY
npm run typecheck      # lib/ + scripts/ (convex/ excluded — needs _generated)
npm run test:image     # K5: writes a real ad photo to out/ — eyeball realism
npm run test:run       # K7: full fan-out on stubs + real photos → out/
```

`SKIP_IMAGE=1 npm run test:run` exercises the event stream without spending on images.

## Porting checklist (when Minh's scaffold merges)
1. `git mv lab/lib/* lib/` and `lab/convex/* convex/` (keep `convex/_generated`).
2. Delete `lab/` toolchain (package.json/tsconfig/scripts) — deps already in the app.
3. Add `loadRunConfig` internalQuery (sketched at the bottom of `convex/run.ts`).
4. Swap `agents/stubs` → Minh's real agents in `orchestrator.ts`.
5. Replace `seed.ts` with Ale's brand pack + personas.
