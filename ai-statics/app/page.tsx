"use client";

import { useState } from "react";
import InputForm, { GenerateFormData } from "@/components/InputForm";
import GenerationProgress from "@/components/GenerationProgress";
import AdResultCard from "@/components/AdResult";
import { ProgressStep, AdResult } from "@/lib/agents/orchestrator";
import { AwarenessStage, STAGE_LABEL } from "@/lib/agents/awareness";

export default function Home() {
  const [lanes, setLanes] = useState<AwarenessStage[]>([]);
  const [stepsByLane, setStepsByLane] = useState<Record<string, ProgressStep[]>>({});
  const [resultsByLane, setResultsByLane] = useState<Record<string, AdResult>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (formData: GenerateFormData) => {
    setIsGenerating(true);
    setLanes(formData.stages);
    setStepsByLane(Object.fromEntries(formData.stages.map((s) => [s, []])));
    setResultsByLane({});
    setError(null);

    // Append-or-replace a step within its lane (keyed by step name).
    const upsertLaneStep = (laneId: AwarenessStage, progress: ProgressStep) => {
      setStepsByLane((prev) => {
        const laneSteps = prev[laneId] ?? [];
        const idx = laneSteps.findIndex(
          (s) => "step" in s && "step" in progress && s.step === progress.step
        );
        const next =
          idx >= 0
            ? laneSteps.map((s, i) => (i === idx ? progress : s))
            : [...laneSteps, progress];
        return { ...prev, [laneId]: next };
      });
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep partial line for next chunk

        for (const line of lines.filter(Boolean)) {
          let progress: ProgressStep;
          try {
            progress = JSON.parse(line) as ProgressStep;
          } catch {
            continue;
          }

          if (progress.step === "swarmStart") {
            setLanes(progress.lanes);
          } else if (progress.step === "swarmComplete") {
            // terminal — handled by finally
          } else if (progress.step === "laneComplete") {
            setResultsByLane((prev) => ({ ...prev, [progress.laneId]: progress.result }));
          } else if (progress.step === "error") {
            if (progress.laneId) upsertLaneStep(progress.laneId, progress);
            else setError(progress.message);
          } else if ("laneId" in progress) {
            upsertLaneStep(progress.laneId, progress);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  const hasRun = lanes.length > 0;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ff4d00] rounded-sm flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <span className="font-semibold tracking-tight text-lg">Statics</span>
          <span className="text-white/30 text-sm ml-1">MVP v0.1</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/40 text-sm">Live</span>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-[minmax(360px,420px)_1fr] gap-12">
        <div>
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2">Awareness-Stage Ads</h1>
            <p className="text-white/50">
              One persona, one product — a swarm of ads, one per awareness stage. Watch them generate in parallel.
            </p>
          </div>
          <InputForm onSubmit={handleGenerate} isGenerating={isGenerating} />
        </div>

        <div>
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}

          {!hasRun && !error && (
            <div className="h-full flex items-center justify-center text-white/20 text-sm pt-32">
              Your stage-by-stage ad swarm will appear here
            </div>
          )}

          {hasRun && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {lanes.map((lane) => {
                const result = resultsByLane[lane];
                return (
                  <div key={lane}>
                    {result ? (
                      <AdResultCard result={result} />
                    ) : (
                      <div className="border border-white/10 rounded-xl p-4">
                        <GenerationProgress
                          steps={stepsByLane[lane] ?? []}
                          title={STAGE_LABEL[lane]}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
