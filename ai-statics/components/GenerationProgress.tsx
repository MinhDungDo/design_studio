"use client";

import { ProgressStep } from "@/lib/agents/orchestrator";

interface Props {
  steps: ProgressStep[];
  isGenerating: boolean;
}

const STEP_CONFIG = {
  strategy: { label: "Strategy Generator", desc: "Analyzing angles & awareness stage" },
  copy: { label: "Copy Generator", desc: "Writing headlines & CTA" },
  imagePrompt: { label: "Image Prompt Generator", desc: "Art directing the visual" },
  imageGen: { label: "Image Generator", desc: "Calling GPT Image 2" },
  scorer: { label: "Ad Scorer", desc: "Quality checking the result" },
  complete: { label: "Complete", desc: "Ad is ready" },
  error: { label: "Error", desc: "" },
};

export default function GenerationProgress({ steps, isGenerating }: Props) {
  const getStepStatus = (stepName: string) => {
    const found = steps.find((s) => "step" in s && s.step === stepName);
    if (!found) return "waiting";
    if ("status" in found) return found.status;
    if (found.step === "complete") return "done";
    return "waiting";
  };

  const agentSteps = ["strategy", "copy", "imagePrompt", "imageGen", "scorer"] as const;

  return (
    <div className="mb-8">
      <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">
        Agent Pipeline
      </h2>
      <div className="space-y-2">
        {agentSteps.map((stepName) => {
          const status = getStepStatus(stepName);
          const config = STEP_CONFIG[stepName];

          return (
            <div
              key={stepName}
              className={`flex items-center gap-4 p-3 rounded-lg border transition-all duration-300 ${
                status === "running"
                  ? "border-[#ff4d00]/40 bg-[#ff4d00]/5"
                  : status === "done"
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-white/5 bg-white/2"
              }`}
            >
              {/* Status icon */}
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                {status === "running" && (
                  <div className="w-4 h-4 border-2 border-[#ff4d00]/40 border-t-[#ff4d00] rounded-full animate-spin" />
                )}
                {status === "done" && (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === "waiting" && (
                  <div className="w-2 h-2 rounded-full bg-white/15" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  status === "done" ? "text-white/70" : status === "running" ? "text-white" : "text-white/30"
                }`}>
                  {config.label}
                </p>
                {status === "running" && (
                  <p className="text-xs text-white/40 mt-0.5">{config.desc}</p>
                )}
              </div>

              {/* Parallel badge */}
              {(stepName === "copy" || stepName === "imagePrompt") && (
                <span className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">
                  parallel
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
