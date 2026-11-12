import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./globals.css";
import messages from "@/messages/en.json";

export const metadata: Metadata = {
  title: `${messages.appName} — ${messages.appSubtitle}`,
  description: messages.tagline,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
