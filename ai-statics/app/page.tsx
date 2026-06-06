"use client";

import { useState } from "react";
import InputForm, { ProductImage } from "@/components/InputForm";
import GenerationProgress from "@/components/GenerationProgress";
import AdResult from "@/components/AdResult";
import { ProgressStep, GenerationResult } from "@/lib/agents/orchestrator";

export default function Home() {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (formData: {
    productBrief?: string;
    brandKit?: string;
    customerReviews?: string;
    referenceAds?: string;
    productImage: ProductImage;
  }) => {
    setIsGenerating(true);
    setSteps([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const progress = JSON.parse(line) as ProgressStep;
            setSteps((prev) => {
              const existing = prev.findIndex(
                (s) => "step" in s && s.step === progress.step
              );
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = progress;
                return updated;
              }
              return [...prev, progress];
            });

            if (progress.step === "complete") {
              setResult(progress.result);
            }
            if (progress.step === "error") {
              setError(progress.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

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

      <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2">Generate Static Ads</h1>
            <p className="text-white/50">AI-powered direct response ad generation. Fill in the details and let the agents do the work.</p>
          </div>
          <InputForm onSubmit={handleGenerate} isGenerating={isGenerating} />
        </div>

        <div>
          {steps.length > 0 && (
            <GenerationProgress steps={steps} isGenerating={isGenerating} />
          )}
          {result && <AdResult result={result} />}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}
          {steps.length === 0 && !error && (
            <div className="h-full flex items-center justify-center text-white/20 text-sm pt-32">
              Your generated ad will appear here
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
