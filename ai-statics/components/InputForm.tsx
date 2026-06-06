"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AwarenessStage,
  AWARENESS_STAGES,
  STAGE_LABEL,
  DEFAULT_STAGES,
} from "@/lib/agents/awareness";

export interface GenerateFormData {
  offer: string;
  productDetails?: string;
  formatId: string;
  storeUrl?: string;
  assetUrls: string[];
  stages: AwarenessStage[];
}

interface AdFormatOption {
  id: string;
  name: string;
}

// Shape returned by convex `assets.listAssets` (api is AnyApi, so we type it here).
interface BrandAsset {
  _id: string;
  name: string;
  kind: "product" | "brand";
  higgsfieldMediaId?: string;
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
  const [offer, setOffer] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [formats, setFormats] = useState<AdFormatOption[]>([]);
  const [formatId, setFormatId] = useState("");
  const [stages, setStages] = useState<AwarenessStage[]>(DEFAULT_STAGES);
  const [uploading, setUploading] = useState(false);

  // Load the DTC ad-format catalog for the picker.
  useEffect(() => {
    fetch("/api/formats")
      .then((r) => r.json())
      .then((d: { formats?: AdFormatOption[] }) => {
        setFormats(d.formats ?? []);
        if (d.formats?.[0]) setFormatId((cur) => cur || d.formats![0].id);
      })
      .catch(() => {});
  }, []);

  const toggleStage = (stage: AwarenessStage) =>
    setStages((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]));

  const toggleAsset = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await saveAsset({ storageId, name: file.name, kind: "product" });
    } finally {
      setUploading(false);
    }
  };

  const selectedUrls = assets
    .filter((a) => selectedIds.has(a._id as string) && a.url)
    .map((a) => a.url as string);

  const canSubmit =
    !isGenerating && offer.trim().length > 0 && formatId && stages.length > 0 && selectedUrls.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      offer: offer.trim(),
      productDetails: productDetails.trim() || undefined,
      formatId,
      storeUrl: storeUrl.trim() || undefined,
      assetUrls: selectedUrls,
      stages,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Brand asset library (Convex-backed) */}
      <div>
        <label className={labelClass}>
          Reference Images *{" "}
          <span className="text-white/25 normal-case tracking-normal">{selectedIds.size} selected</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {assets.map((a) => {
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
            <span className="text-white/50 text-xs">{uploading ? "Uploading…" : "+ Upload"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleUpload}
              disabled={isGenerating || uploading}
            />
          </label>
        </div>
        <p className="text-white/25 text-xs mt-1">
          Your brand/product image library. Selected images are used as references — the product stays intact in every ad.
        </p>
      </div>

      {/* Offer */}
      <div>
        <label className={labelClass}>Offer *</label>
        <textarea
          className={inputClass}
          rows={2}
          placeholder="What are you advertising? e.g. 20% off the summer skincare bundle"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Product details (per-run specifics) */}
      <div>
        <label className={labelClass}>
          Product Details <span className="text-white/25 normal-case tracking-normal">optional</span>
        </label>
        <textarea
          className={inputClass}
          rows={3}
          placeholder="Specifics for THIS product: key features, price, materials, ingredients, claims, what makes it different. (Brand voice & ICP come from the shared brief.)"
          value={productDetails}
          onChange={(e) => setProductDetails(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {/* Ad format */}
      <div>
        <label className={labelClass}>Ad Format</label>
        <select
          className={inputClass}
          value={formatId}
          onChange={(e) => setFormatId(e.target.value)}
          disabled={isGenerating || formats.length === 0}
        >
          {formats.length === 0 && <option value="">Loading formats…</option>}
          {formats.map((f) => (
            <option key={f.id} value={f.id} className="bg-[#0a0a0a]">
              {f.name}
            </option>
          ))}
        </select>
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

      {/* Optional store URL → brand kit */}
      <div>
        <label className={labelClass}>
          Store URL <span className="text-white/25 normal-case tracking-normal">optional — auto-builds a brand kit</span>
        </label>
        <input
          type="url"
          className={inputClass}
          placeholder="https://yourstore.com"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          disabled={isGenerating}
        />
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
