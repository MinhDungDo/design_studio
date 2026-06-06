"use client";

import { GenerationResult } from "@/lib/agents/orchestrator";
import { useState } from "react";

interface Props {
  result: GenerationResult;
}

export default function AdResult({ result }: Props) {
  const [activeTab, setActiveTab] = useState<"ad" | "strategy" | "copy" | "score">("ad");
  const { strategy, copy, imageBase64, scorer } = result;

  const scoreColor = scorer.overallScore >= 80
    ? "text-green-400"
    : scorer.overallScore >= 65
    ? "text-yellow-400"
    : "text-red-400";

  const tabs = [
    { id: "ad", label: "Ad Preview" },
    { id: "strategy", label: "Strategy" },
    { id: "copy", label: "Copy" },
    { id: "score", label: `Score ${scorer.overallScore}` },
  ] as const;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-white border-b-2 border-[#ff4d00] bg-white/5"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Ad Preview */}
        {activeTab === "ad" && (
          <div className="space-y-4">
            {imageBase64 ? (
              <div className="relative">
                <img
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Generated ad"
                  className="w-full rounded-lg"
                />
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `data:image/png;base64,${imageBase64}`;
                    link.download = "generated-ad.png";
                    link.click();
                  }}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors"
                >
                  Download
                </button>
              </div>
            ) : (
              <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center">
                <p className="text-white/30 text-sm">No image generated</p>
              </div>
            )}

            {/* Copy overlay preview */}
            <div className="bg-white/5 rounded-lg p-4 space-y-1">
              <p className="text-white font-bold text-lg leading-tight">{copy.headline}</p>
              <p className="text-white/70 text-sm">{copy.subheadline}</p>
              {copy.socialProof && (
                <p className="text-white/50 text-xs">{copy.socialProof}</p>
              )}
              <div className="pt-2">
                <span className="inline-block bg-[#ff4d00] text-white text-xs font-semibold px-4 py-2 rounded">
                  {copy.cta}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Strategy */}
        {activeTab === "strategy" && (
          <div className="space-y-4">
            {[
              { label: "Angle", value: strategy.angle },
              { label: "Awareness Stage", value: strategy.awarenessStage },
              { label: "Emotional Hook", value: strategy.emotionalHook },
              { label: "Ad Concept", value: strategy.adConcept },
              { label: "Target Emotion", value: strategy.targetEmotion },
              { label: "Setting", value: strategy.setting },
            ].map(({ label, value }) => (
              <div key={label} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm text-white/80">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Copy */}
        {activeTab === "copy" && (
          <div className="space-y-4">
            {[
              { label: "Headline", value: copy.headline },
              { label: "Subheadline", value: copy.subheadline },
              { label: "Body Text", value: copy.bodyText },
              { label: "CTA", value: copy.cta },
              { label: "Social Proof", value: copy.socialProof ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm text-white/80">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Score */}
        {activeTab === "score" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-sm">Overall Score</p>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-bold ${scoreColor}`}>
                  {scorer.overallScore}
                </span>
                <span className="text-white/30">/100</span>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  scorer.passed
                    ? "bg-green-500/15 text-green-400"
                    : "bg-red-500/15 text-red-400"
                }`}>
                  {scorer.passed ? "PASSED" : "NEEDS WORK"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(scorer.scores).map(([key, val]) => {
                const label = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase());
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/50">{label}</span>
                      <span className="text-white/70">{val}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ff4d00] rounded-full transition-all duration-500"
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Feedback</p>
              <p className="text-sm text-white/70">{scorer.feedback}</p>
            </div>

            {scorer.improvements.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Improvements</p>
                <ul className="space-y-1.5">
                  {scorer.improvements.map((imp, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/60">
                      <span className="text-[#ff4d00] mt-0.5">→</span>
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
