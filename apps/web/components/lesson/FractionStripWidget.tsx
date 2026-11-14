"use client";

import React from "react";
import type { FractionStripSimulation } from "@gaps/contracts";

interface FractionStripWidgetProps {
  config: FractionStripSimulation;
  currentParts: number;
  currentShaded: number;
  onChangeParts?: (parts: number) => void;
  onChangeShaded?: (shaded: number) => void;
  readOnly?: boolean;
}

export function FractionStripWidget({
  config,
  currentParts,
  currentShaded,
  onChangeParts,
  onChangeShaded,
  readOnly = false,
}: FractionStripWidgetProps) {
  const parts = Math.max(config.minParts, Math.min(config.maxParts, currentParts));
  const shaded = Math.max(0, Math.min(parts, currentShaded));

  const handleToggleSlice = (index: number) => {
    if (readOnly || !config.allowChangeShaded || !onChangeShaded) return;
    if (index < shaded) {
      onChangeShaded(index);
    } else {
      onChangeShaded(index + 1);
    }
  };

  const handleAdjustParts = (delta: number) => {
    if (readOnly || !config.allowChangeParts || !onChangeParts) return;
    const nextParts = parts + delta;
    if (nextParts >= config.minParts && nextParts <= config.maxParts) {
      onChangeParts(nextParts);
      if (shaded > nextParts && onChangeShaded) {
        onChangeShaded(nextParts);
      }
    }
  };

  const handleAdjustShaded = (delta: number) => {
    if (readOnly || !config.allowChangeShaded || !onChangeShaded) return;
    const nextShaded = shaded + delta;
    if (nextShaded >= 0 && nextShaded <= parts) {
      onChangeShaded(nextShaded);
    }
  };

  return (
    <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
      {/* Top Banner: Real-time fraction indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex flex-col items-center justify-center font-extrabold text-primary shadow-xs">
            <span className="text-xl leading-none">{shaded}</span>
            <div className="w-8 h-0.5 bg-primary/40 my-0.5" />
            <span className="text-xl leading-none">{parts}</span>
          </div>

          <div>
            <span className="text-2xs font-extrabold text-primary uppercase tracking-wider">
              Fraction Value
            </span>
            <h4 className="font-extrabold text-ink text-base">
              {shaded}{" "}
              {parts === 1
                ? "whole"
                : parts === 2
                  ? "halves"
                  : parts === 4
                    ? "fourths"
                    : parts === 3
                      ? "thirds"
                      : `${parts}ths`}
            </h4>
            <p className="text-xs text-muted">
              {shaded} shaded {shaded === 1 ? "part" : "parts"} out of {parts} equal{" "}
              {parts === 1 ? "part" : "parts"}
            </p>
          </div>
        </div>

        {config.targetFraction && (
          <div className="px-4 py-2 rounded-2xl bg-amber/10 border border-amber/30 text-amber-900 flex items-center gap-2">
            <span className="text-xs font-bold">Goal:</span>
            <span className="font-extrabold text-sm font-mono">
              {config.targetFraction.n}/{config.targetFraction.d}
            </span>
          </div>
        )}
      </div>

      {/* Interactive Fraction Strip */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-muted px-1">
          <span>0</span>
          <span>1 Whole</span>
        </div>

        <div className="h-16 w-full rounded-2xl overflow-hidden border-2 border-line bg-surface-2 flex shadow-inner">
          {Array.from({ length: parts }).map((_, idx) => {
            const isShaded = idx < shaded;
            return (
              <button
                key={idx}
                type="button"
                disabled={readOnly || !config.allowChangeShaded}
                onClick={() => handleToggleSlice(idx)}
                className={`flex-1 h-full border-r last:border-r-0 border-line/60 flex items-center justify-center transition-all ${
                  isShaded
                    ? "bg-primary text-white font-extrabold shadow-sm hover:brightness-105"
                    : "bg-surface text-muted hover:bg-primary/10 font-bold"
                } ${readOnly || !config.allowChangeShaded ? "cursor-default" : "cursor-pointer"}`}
                title={`Slice ${idx + 1} of ${parts} (${isShaded ? "Shaded" : "Unshaded"})`}
              >
                <span className="text-xs select-none">1/{parts}</span>
              </button>
            );
          })}
        </div>

        {!readOnly && config.allowChangeShaded && (
          <p className="text-2xs text-muted text-center italic pt-1">
            Tap any slice to toggle shaded parts
          </p>
        )}
      </div>

      {/* Manipulation Controls */}
      {!readOnly && (config.allowChangeParts || config.allowChangeShaded) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
          {config.allowChangeParts && (
            <div className="p-3 bg-surface-2/60 rounded-2xl border border-line flex items-center justify-between">
              <div>
                <span className="text-2xs font-extrabold text-muted uppercase">Total Slices</span>
                <p className="font-extrabold text-sm text-ink">{parts} Parts</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Decrease parts"
                  disabled={parts <= config.minParts}
                  onClick={() => handleAdjustParts(-1)}
                  className="w-8 h-8 rounded-xl bg-surface border border-line font-bold text-ink hover:bg-surface-2 disabled:opacity-30 shadow-xs"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-sm text-ink">{parts}</span>
                <button
                  type="button"
                  aria-label="Increase parts"
                  disabled={parts >= config.maxParts}
                  onClick={() => handleAdjustParts(1)}
                  className="w-8 h-8 rounded-xl bg-surface border border-line font-bold text-ink hover:bg-surface-2 disabled:opacity-30 shadow-xs"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {config.allowChangeShaded && (
            <div className="p-3 bg-surface-2/60 rounded-2xl border border-line flex items-center justify-between">
              <div>
                <span className="text-2xs font-extrabold text-muted uppercase">Shaded Slices</span>
                <p className="font-extrabold text-sm text-ink">{shaded} Shaded</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Decrease shaded parts"
                  disabled={shaded <= 0}
                  onClick={() => handleAdjustShaded(-1)}
                  className="w-8 h-8 rounded-xl bg-surface border border-line font-bold text-ink hover:bg-surface-2 disabled:opacity-30 shadow-xs"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-sm text-ink">{shaded}</span>
                <button
                  type="button"
                  aria-label="Increase shaded parts"
                  disabled={shaded >= parts}
                  onClick={() => handleAdjustShaded(1)}
                  className="w-8 h-8 rounded-xl bg-surface border border-line font-bold text-ink hover:bg-surface-2 disabled:opacity-30 shadow-xs"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
