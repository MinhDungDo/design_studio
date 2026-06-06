# AI Statics — MVP

AI-powered direct response static ad generator using Vercel AI SDK + GPT Image 2.

## Architecture

```
Next.js App (Minh)
  └── /app/api/generate/route.ts   ← Agent harness (Vercel AI SDK)
        └── lib/agents/
              ├── orchestrator.ts      ← Sequences all agents, streams progress
              ├── strategyAgent.ts     ← Creative strategy (GPT-4o)
              ├── copyAgent.ts         ← DR copywriting (GPT-4o)
              ├── imagePromptAgent.ts  ← Art direction (GPT-4o)
              ├── imageGenerator.ts    ← GPT Image 2 API call
              └── adScorer.ts          ← Quality gate (GPT-4o)

Convex (Kevin)
  └── convex/
        ├── schema.ts    ← DB schema for jobs
        └── jobs.ts      ← Mutations & queries
```

## Quickstart

### 1. Add OpenAI API key (Kevin)
Edit .env.local:
  OPENAI_API_KEY=sk-your-actual-key-here

### 2. Setup Convex (Kevin)
  npx convex dev
Copy the Convex URL into .env.local:
  NEXT_PUBLIC_CONVEX_URL=https://your-url.convex.cloud

### 3. Run
  npm run dev
Open http://localhost:3000

## Agent Pipeline

Input → Strategy → [Copy + ImagePrompt in PARALLEL] → ImageGen → AdScorer → Result

All steps stream live progress to the UI.

## Cost Tips
- Dev: keep quality "standard" in imageGenerator.ts
- Demo: switch to "high" for final run
- Set a spending cap in OpenAI dashboard

## Ownership
Frontend + agents → Minh
Convex DB + billing → Kevin
