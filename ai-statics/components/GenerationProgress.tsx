"use client";

import { ProgressStep } from "@/lib/agents/orchestrator";

interface Props {
  // Steps for a SINGLE lane (already filtered by laneId).
  steps: ProgressStep[];
  title?: string;
}

export default function GenerationProgress({ steps, title }: Props) {
  const found = steps.find((s) => "step" in s && s.step === "imageGen");
  const status: "waiting" | "running" | "done" =
    found && "status" in found ? found.status : "waiting";

  return (
    <div>
      {title && (
        <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-widest mb-2">
          {title}
        </h3>
      )}
      <div
        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-300 ${
          status === "running"
            ? "border-[#ff4d00]/40 bg-[#ff4d00]/5"
            : status === "done"
            ? "border-green-500/20 bg-green-500/5"
            : "border-white/5 bg-white/2"
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {status === "running" && (
            <div className="w-3.5 h-3.5 border-2 border-[#ff4d00]/40 border-t-[#ff4d00] rounded-full animate-spin" />
          )}
          {status === "done" && (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "waiting" && <div className="w-2 h-2 rounded-full bg-white/15" />}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium ${
              status === "done" ? "text-white/70" : status === "running" ? "text-white" : "text-white/30"
            }`}
          >
            {status === "running" ? "Generating…" : status === "done" ? "Done" : "Queued"}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">Higgsfield DTC Ads</p>
        </div>
      </div>
    </div>
  );
}
