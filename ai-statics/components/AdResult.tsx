"use client";

import { AdResult as AdResultData } from "@/lib/agents/orchestrator";
import { STAGE_LABEL } from "@/lib/agents/awareness";

interface Props {
  result: AdResultData;
}

export default function AdResult({ result }: Props) {
  const { imageBase64, laneId } = result;
  const dataUrl = `data:image/png;base64,${imageBase64}`;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Awareness-stage label */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
        <span className="text-xs font-semibold tracking-wide text-[#ff4d00]">
          {STAGE_LABEL[laneId]}
        </span>
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Awareness stage</span>
      </div>

      <div className="p-4">
        {imageBase64 ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={`${STAGE_LABEL[laneId]} ad`} className="w-full rounded-lg" />
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = `ad-${laneId}.png`;
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
      </div>
    </div>
  );
}
