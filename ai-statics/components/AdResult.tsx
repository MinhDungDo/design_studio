"use client";

import { useState } from "react";
import { AdResult as AdResultData } from "@/lib/agents/orchestrator";
import { STAGE_LABEL } from "@/lib/agents/awareness";

interface Props {
  result: AdResultData;
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export default function AdResult({ result }: Props) {
  const { images, laneId } = result;
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];
  const dataUrl = active ? `data:image/png;base64,${active.imageBase64}` : null;
  const multi = images.length > 1;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Awareness-stage label */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
        <span className="text-xs font-semibold tracking-wide text-[#ff4d00]">
          {STAGE_LABEL[laneId]}
        </span>
        <span className="text-[10px] text-white/30 uppercase tracking-widest">
          Awareness stage{multi ? ` · ${images.length} variations` : ""}
        </span>
      </div>

      <div className="p-4">
        {dataUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`${STAGE_LABEL[laneId]} ad${multi ? ` (variation ${activeIndex + 1})` : ""}`}
              className="w-full rounded-lg"
            />
            <button
              onClick={() => download(dataUrl, `ad-${laneId}-${activeIndex + 1}.png`)}
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

        {multi && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                  i === activeIndex ? "border-[#ff4d00]" : "border-white/10 hover:border-white/30"
                }`}
                title={`Variation ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${img.imageBase64}`}
                  alt={`${STAGE_LABEL[laneId]} ad variation ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
