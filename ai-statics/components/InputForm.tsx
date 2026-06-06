"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  AwarenessStage,
  AWARENESS_STAGES,
  STAGE_LABEL,
  DEFAULT_STAGES,
} from "@/lib/agents/awareness";

export interface GenerateFormData {
  productBrief: string;
  brandKit?: string;
  customerReviews?: string;
  referenceAds?: string;
  productAssetIds: string[];
  benchmarkAssetIds: string[];
  stages: AwarenessStage[];
}

type AssetKind = "product" | "reference_ad";

interface BrandAsset {
  _id: Id<"brandAssets">;
  name: string;
  kind: AssetKind;
  url: string | null;
}

interface Props {
  onSubmit: (data: GenerateFormData) => void;
  isGenerating: boolean;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#ff4d00]/60 focus:bg-white/8 transition-all resize-none";
const labelClass = "block text-xs font-medium text-white/50 uppercase tracking-widest mb-2";

export default function InputForm({ onSubmit, isGenerating }: Props) {
  const assets = (useQuery(api.assets.listAssets) ?? []) as BrandAsset[];
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const saveAsset = useMutation(api.assets.saveAsset);
  const deleteAsset = useMutation(api.assets.deleteAsset);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [productBrief, setProductBrief] = useState("");
  const [brandKit, setBrandKit] = useState("");
  const [customerReviews, setCustomerReviews] = useState("");
  const [referenceAds, setReferenceAds] = useState("");
  const [stages, setStages] = useState<AwarenessStage[]>(DEFAULT_STAGES);
  const [uploading, setUploading] = useState<AssetKind | null>(null);

  const toggleStage = (stage: AwarenessStage) =>
    setStages((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]));

  const toggleAsset = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: AssetKind) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(kind);
    try {
      // Upload all selected files in parallel; each gets its own upload URL + row.
      await Promise.all(
        files.map(async (file) => {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = await res.json();
          await saveAsset({ storageId, name: file.name, kind });
        })
      );
    } finally {
      setUploading(null);
    }
  };

  const idsForKind = (kind: AssetKind) =>
    assets.filter((a) => a.kind === kind && selectedIds.has(a._id as string)).map((a) => a._id as string);

  const productAssetIds = idsForKind("product");
  const benchmarkAssetIds = idsForKind("reference_ad");

  const canSubmit =
    !isGenerating && productBrief.trim().length > 0 && stages.length > 0 && productAssetIds.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      productBrief: productBrief.trim(),
      brandKit: brandKit.trim() || undefined,
      customerReviews: customerReviews.trim() || undefined,
      referenceAds: referenceAds.trim() || undefined,
      productAssetIds,
      benchmarkAssetIds,
      stages,
    });
  };

  const ImageGroup = ({ kind, hint }: { kind: AssetKind; hint: string }) => {
    const items = assets.filter((a) => a.kind === kind);
    return (
      <div className="grid grid-cols-3 gap-2">
        {items.map((a) => {
          const id = a._id as string;
          const active = selectedIds.has(id);
          return (
            <div key={id} className="relative group">
              <button
                type="button"
                onClick={() => toggleAsset(id)}
                disabled={isGenerating}
                className={`block w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  active ? "border-[#ff4d00]" : "border-white/10 hover:border-white/30"
                }`}
              >
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => deleteAsset({ assetId: a._id })}
                disabled={isGenerating}
                className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white text-[10px] w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from library"
              >
                ×
              </button>
            </div>
          );
        })}
        <label className="flex flex-col items-center justify-center aspect-square border border-dashed border-white/15 rounded-lg cursor-pointer hover:border-[#ff4d00]/50 hover:bg-white/5 transition-all text-center px-2">
          <span className="text-white/50 text-xs">{uploading === kind ? "Uploading…" : "+ Upload"}</span>
          <span className="text-white/25 text-[10px] mt-0.5">{hint}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, kind)}
            disabled={isGenerating || uploading !== null}
          />
        </label>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Product images */}
      <div>
        <label className={labelClass}>
          Product Images *{" "}
          <span className="text-white/25 normal-case tracking-normal">{productAssetIds.length} selected — kept intact</span>
        </label>
        <ImageGroup kind="product" hint="the product" />
      </div>

      {/* Example / benchmark ads */}
      <div>
        <label className={labelClass}>
          Example Ads{" "}
          <span className="text-white/25 normal-case tracking-normal">{benchmarkAssetIds.length} selected — style direction</span>
        </label>
        <ImageGroup kind="reference_ad" hint="good ad refs" />
        <p className="text-white/25 text-xs mt-1">
          Optional. The brain borrows composition/mood/lighting from these — never their branding.
        </p>
      </div>

      {/* Product Brief */}
      <div>
        <label className={labelClass}>Product Brief *</label>
        <textarea
          className={inputClass}
          rows={4}
          placeholder="What is the product? Key features, what it is, what problem it solves, the mechanism that makes it different…"
          value={productBrief}
          onChange={(e) => setProductBrief(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Brand Kit */}
      <div>
        <label className={labelClass}>
          Brand Kit <span className="text-white/25 normal-case tracking-normal">optional</span>
        </label>
        <textarea
          className={inputClass}
          rows={3}
          placeholder="Brand voice/tone, colors, values, what to avoid…"
          value={brandKit}
          onChange={(e) => setBrandKit(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Customer Reviews & Feedback */}
      <div>
        <label className={labelClass}>
          Customer Reviews & Feedback <span className="text-white/25 normal-case tracking-normal">optional</span>
        </label>
        <textarea
          className={inputClass}
          rows={3}
          placeholder="Paste real reviews, survey responses, or feedback — used as voice-of-customer (never invented)."
          value={customerReviews}
          onChange={(e) => setCustomerReviews(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Reference Ads (text) */}
      <div>
        <label className={labelClass}>
          Reference Ads <span className="text-white/25 normal-case tracking-normal">optional text direction</span>
        </label>
        <textarea
          className={inputClass}
          rows={2}
          placeholder="Describe reference ads / competitors to draw composition & mood from (complements the example-ad images)."
          value={referenceAds}
          onChange={(e) => setReferenceAds(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Awareness stages */}
      <div>
        <label className={labelClass}>
          Awareness Stages{" "}
          <span className="text-white/25 normal-case tracking-normal">{stages.length} selected — one ad each</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AWARENESS_STAGES.map((stage) => {
            const active = stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => toggleStage(stage)}
                disabled={isGenerating}
                className={`text-xs px-3 py-2 rounded-lg border transition-all ${
                  active
                    ? "border-[#ff4d00]/60 bg-[#ff4d00]/10 text-white"
                    : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                }`}
              >
                {STAGE_LABEL[stage]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-[#ff4d00] hover:bg-[#e64500] disabled:bg-white/10 disabled:text-white/25 text-white font-semibold py-4 rounded-lg transition-all duration-200 text-sm tracking-wide"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating {stages.length} ads…
          </span>
        ) : (
          `Generate ${stages.length} Ad${stages.length === 1 ? "" : "s"} →`
        )}
      </button>
    </form>
  );
}
