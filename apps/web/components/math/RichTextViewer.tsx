"use client";

import React from "react";
import type { RichTextDto } from "@gaps/contracts";

interface RichTextViewerProps {
  segments: RichTextDto;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function RichTextViewer({ segments, className = "", size = "md" }: RichTextViewerProps) {
  if (!segments || !Array.isArray(segments)) {
    return null;
  }

  const textSize =
    size === "lg" ? "text-xl sm:text-2xl" : size === "sm" ? "text-sm" : "text-base sm:text-lg";

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-medium ${textSize} ${className}`}
    >
      {segments.map((seg, idx) => {
        if (seg.t === "text") {
          return (
            <span key={idx} className="whitespace-pre-wrap">
              {seg.v}
            </span>
          );
        }

        if (seg.t === "frac") {
          return (
            <span
              key={idx}
              className="inline-flex flex-col items-center justify-center align-middle mx-1 px-1 py-0.5 rounded bg-surface/80 border border-line text-ink tabular-nums text-center"
              style={{ verticalAlign: "middle" }}
            >
              <span className="border-b border-ink/40 w-full px-1 text-sm font-bold leading-tight">
                {seg.n}
              </span>
              <span className="w-full px-1 text-sm font-bold leading-tight">{seg.d}</span>
            </span>
          );
        }

        if (seg.t === "mixed") {
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 align-middle mx-1 tabular-nums"
            >
              <span className="font-bold text-lg text-ink">{seg.w}</span>
              <span className="inline-flex flex-col items-center justify-center px-1 py-0.5 rounded bg-surface/80 border border-line text-ink text-center">
                <span className="border-b border-ink/40 w-full px-1 text-xs font-bold leading-tight">
                  {seg.n}
                </span>
                <span className="w-full px-1 text-xs font-bold leading-tight">{seg.d}</span>
              </span>
            </span>
          );
        }

        if (seg.t === "math") {
          return (
            <span
              key={idx}
              className="font-mono font-semibold text-primary-ink px-1 rounded bg-surface border border-line"
            >
              {seg.v}
            </span>
          );
        }

        if (seg.t === "blank") {
          return (
            <span
              key={idx}
              className="inline-block w-12 h-6 border-b-2 border-primary border-dashed bg-surface/50 rounded-sm mx-1"
              aria-label="blank space"
            />
          );
        }

        return null;
      })}
    </span>
  );
}
