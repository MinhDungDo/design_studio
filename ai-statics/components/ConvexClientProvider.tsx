"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace", color: "#f87171", lineHeight: 1.6 }}>
        <strong>NEXT_PUBLIC_CONVEX_URL is not set.</strong>
        <br />
        Run <code>npx convex dev</code> in <code>ai-statics/</code>, then add the printed URL to{" "}
        <code>.env.local</code> as <code>NEXT_PUBLIC_CONVEX_URL=…</code> and restart{" "}
        <code>npm run dev</code>.
      </div>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
