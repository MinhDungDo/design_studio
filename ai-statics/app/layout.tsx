import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Statics — Ad Generator",
  description: "AI-powered direct response static ad generation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
