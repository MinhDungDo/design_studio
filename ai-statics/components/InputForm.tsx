"use client";

import { useState } from "react";

export interface ProductImage {
  data: string; // base64-encoded image bytes (no "data:" URL prefix)
  mimeType: string; // e.g. "image/png", "image/jpeg", "image/webp"
}

interface Props {
  onSubmit: (data: {
    productBrief?: string;
    brandKit?: string;
    customerReviews?: string;
    referenceAds?: string;
    productImage: ProductImage;
  }) => void;
  isGenerating: boolean;
}

export default function InputForm({ onSubmit, isGenerating }: Props) {
  const [productBrief, setProductBrief] = useState("");
  const [brandKit, setBrandKit] = useState("");
  const [customerReviews, setCustomerReviews] = useState("");
  const [referenceAds, setReferenceAds] = useState("");
  const [productImage, setProductImage] = useState<ProductImage | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const match = /^data:(.+);base64,(.*)$/.exec(reader.result as string);
      if (match) setProductImage({ mimeType: match[1], data: match[2] });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productImage) return;
    onSubmit({
      productBrief: productBrief || undefined,
      brandKit: brandKit || undefined,
      customerReviews: customerReviews || undefined,
      referenceAds: referenceAds || undefined,
      productImage,
    });
  };

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#ff4d00]/60 focus:bg-white/8 transition-all resize-none";
  const labelClass = "block text-xs font-medium text-white/50 uppercase tracking-widest mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass}>Product Image *</label>
        {productImage ? (
          <div className="relative">
            <img
              src={`data:${productImage.mimeType};base64,${productImage.data}`}
              alt="Product preview"
              className="w-full h-48 object-contain bg-white/5 border border-white/10 rounded-lg"
            />
            <button
              type="button"
              onClick={() => setProductImage(null)}
              disabled={isGenerating}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-32 border border-dashed border-white/15 rounded-lg cursor-pointer hover:border-[#ff4d00]/50 hover:bg-white/5 transition-all text-center px-4">
            <span className="text-white/50 text-sm">Click to upload a product photo</span>
            <span className="text-white/25 text-xs mt-1">PNG, JPG, or WEBP — the real product, kept intact in the generated ad</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImageChange}
              disabled={isGenerating}
            />
          </label>
        )}
      </div>

      <div>
        <label className={labelClass}>Product Brief <span className="text-white/25 normal-case tracking-normal">optional</span></label>
        <textarea
          className={inputClass}
          rows={4}
          placeholder="What is the product? Key features, price point, USP, what problem it solves... (leave blank to let the AI infer from the photo)"
          value={productBrief}
          onChange={(e) => setProductBrief(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <div>
        <label className={labelClass}>Brand Kit <span className="text-white/25 normal-case tracking-normal">optional</span></label>
        <textarea
          className={inputClass}
          rows={3}
          placeholder="Brand voice, colors, fonts, tone of voice, what to avoid, brand values..."
          value={brandKit}
          onChange={(e) => setBrandKit(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <div>
        <label className={labelClass}>Customer Reviews & Feedback <span className="text-white/25 normal-case tracking-normal">optional</span></label>
        <textarea
          className={inputClass}
          rows={4}
          placeholder="Paste real customer reviews, survey responses, or feedback. The more the better..."
          value={customerReviews}
          onChange={(e) => setCustomerReviews(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <div>
        <label className={labelClass}>Reference Ads <span className="text-white/25 normal-case tracking-normal">optional</span></label>
        <textarea
          className={inputClass}
          rows={2}
          placeholder="Describe reference ads or competitors you want to draw inspiration from..."
          value={referenceAds}
          onChange={(e) => setReferenceAds(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <button
        type="submit"
        disabled={isGenerating || !productImage}
        className="w-full bg-[#ff4d00] hover:bg-[#e64500] disabled:bg-white/10 disabled:text-white/25 text-white font-semibold py-4 rounded-lg transition-all duration-200 text-sm tracking-wide"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          "Generate Ad →"
        )}
      </button>
    </form>
  );
}
