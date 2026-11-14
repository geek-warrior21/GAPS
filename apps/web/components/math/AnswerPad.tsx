"use client";

import React, { useEffect } from "react";
import type { ItemViewDto, RichTextDto } from "@gaps/contracts";
import { RichTextViewer } from "./RichTextViewer";

interface AnswerPadProps {
  inputSpec: ItemViewDto["input"];
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export function AnswerPad({
  inputSpec,
  value,
  onChange,
  onSubmit,
  disabled = false,
  isSubmitting = false,
}: AnswerPadProps) {
  // Handle keyboard typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || isSubmitting) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (value.trim().length > 0) onSubmit();
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        onChange(value.slice(0, -1));
        return;
      }

      if (inputSpec.kind === "comparison") {
        if (e.key === "<" || e.key === "=" || e.key === ">") {
          e.preventDefault();
          onChange(e.key);
        }
        return;
      }

      if (inputSpec.kind !== "choice" && inputSpec.kind !== "order") {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          onChange(value + e.key);
        } else if (e.key === "/" && !value.endsWith("/")) {
          e.preventDefault();
          onChange(value + "/");
        } else if (e.key === "." && !value.endsWith(".")) {
          e.preventDefault();
          onChange(value + ".");
        } else if (e.key === " " && value.length > 0 && !value.endsWith(" ")) {
          e.preventDefault();
          onChange(value + " ");
        } else if (e.key === "-" && value.length === 0) {
          e.preventDefault();
          onChange("-");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, isSubmitting, inputSpec.kind, value, onChange, onSubmit]);

  const handleDigit = (digit: string) => {
    onChange(value + digit);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange("");
  };

  // Render Comparison UI
  if (inputSpec.kind === "comparison") {
    const symbols = [
      { sym: "<", label: "Less than" },
      { sym: "=", label: "Equal to" },
      { sym: ">", label: "Greater than" },
    ];

    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {symbols.map(({ sym, label }) => {
            const isSelected = value === sym;
            return (
              <button
                key={sym}
                type="button"
                disabled={disabled || isSubmitting}
                onClick={() => onChange(sym)}
                className={`py-5 px-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-white shadow-md scale-102 font-extrabold"
                    : "border-line bg-surface text-ink hover:border-primary/50 hover:bg-surface-2"
                }`}
              >
                <span className="text-3xl font-extrabold">{sym}</span>
                <span className="text-xs font-semibold mt-1 opacity-90">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={disabled || isSubmitting || value.length === 0}
          onClick={onSubmit}
          className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-ink transition-colors disabled:opacity-50 shadow-sm"
        >
          {isSubmitting ? "Checking…" : "Check Answer"}
        </button>
      </div>
    );
  }

  // Render Choice UI
  if (inputSpec.kind === "choice" && inputSpec.choices) {
    return (
      <div className="w-full max-w-md mx-auto space-y-3">
        <div className="space-y-2.5">
          {inputSpec.choices.map((choice) => {
            const isSelected = value === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={disabled || isSubmitting}
                onClick={() => onChange(choice.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm border-2 text-ink font-bold"
                    : "border-line bg-surface text-ink hover:border-primary/40 hover:bg-surface-2"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-primary bg-primary text-white" : "border-line bg-surface"
                  }`}
                >
                  {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                </div>
                <div className="flex-1">
                  <RichTextViewer segments={choice.label as RichTextDto} />
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={disabled || isSubmitting || value.length === 0}
          onClick={onSubmit}
          className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-ink transition-colors disabled:opacity-50 shadow-sm mt-4"
        >
          {isSubmitting ? "Checking…" : "Check Answer"}
        </button>
      </div>
    );
  }

  // Parse display preview for math input
  const renderPreview = () => {
    if (!value || value.length === 0) {
      return (
        <span className="text-muted/60 italic font-normal text-base">Tap keypad or type here…</span>
      );
    }

    // Mixed number like "1 2/3"
    const mixedParts = value.trim().split(/\s+/);
    if (mixedParts.length === 2 && mixedParts[1]?.includes("/")) {
      const [w, frac] = mixedParts;
      const [n, d] = (frac ?? "").split("/");
      return (
        <span className="inline-flex items-center gap-2 font-bold text-2xl text-ink tabular-nums">
          <span>{w}</span>
          <span className="inline-flex flex-col items-center justify-center text-lg leading-tight border-b-2 border-ink">
            <span>{n}</span>
            <span className="border-t border-ink w-full text-center">{d || "·"}</span>
          </span>
        </span>
      );
    }

    // Fraction like "3/4"
    if (value.includes("/")) {
      const [n, d] = value.split("/");
      return (
        <span className="inline-flex flex-col items-center justify-center text-xl font-bold text-ink tabular-nums leading-tight">
          <span className="border-b border-ink/70 px-2">{n || "·"}</span>
          <span className="px-2">{d || "·"}</span>
        </span>
      );
    }

    // Normal integer or decimal
    return <span className="font-bold text-2xl text-ink tabular-nums">{value}</span>;
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {/* Live Preview Display Box */}
      <div className="min-h-16 px-4 py-2 bg-surface rounded-2xl border-2 border-primary/40 shadow-sm flex items-center justify-between">
        <div className="flex-1 flex items-center justify-center overflow-x-auto">
          {renderPreview()}
        </div>
        {value.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            className="text-xs font-bold text-muted hover:text-ink px-2 py-1 rounded bg-surface-2 ml-2"
            title="Clear all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mode / Structure helpers */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            if (value.length > 0 && !value.endsWith("/") && !value.includes("/")) {
              onChange(value + "/");
            } else if (!value.includes("/")) {
              onChange(value + "/");
            }
          }}
          className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-2 border border-line rounded-xl text-xs font-bold text-primary flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span className="inline-block border-b border-primary px-1">n</span>/
          <span className="px-1">d</span>
          <span>Fraction</span>
        </button>

        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            if (value.length > 0 && !value.endsWith(" ") && !value.includes(" ")) {
              onChange(value + " ");
            }
          }}
          className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-2 border border-line rounded-xl text-xs font-bold text-primary flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>w n/d</span>
          <span>Mixed</span>
        </button>
      </div>

      {/* Numeric Virtual Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 bg-surface-2 p-2 rounded-2xl border border-line">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || isSubmitting}
            onClick={() => handleDigit(String(digit))}
            className="h-12 rounded-xl bg-surface hover:bg-primary/5 active:bg-primary/10 border border-line shadow-xs font-extrabold text-xl text-ink tabular-nums transition-transform active:scale-95"
          >
            {digit}
          </button>
        ))}

        {/* Fraction Slash / Decimal Button */}
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            if (inputSpec.kind === "decimal") {
              if (!value.endsWith(".")) onChange(value + ".");
            } else {
              if (!value.endsWith("/")) onChange(value + "/");
            }
          }}
          className="h-12 rounded-xl bg-surface hover:bg-primary/5 active:bg-primary/10 border border-line shadow-xs font-extrabold text-xl text-primary transition-transform active:scale-95"
        >
          {inputSpec.kind === "decimal" ? "." : "/"}
        </button>

        {/* Zero */}
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => handleDigit("0")}
          className="h-12 rounded-xl bg-surface hover:bg-primary/5 active:bg-primary/10 border border-line shadow-xs font-extrabold text-xl text-ink tabular-nums transition-transform active:scale-95"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          disabled={disabled || isSubmitting || value.length === 0}
          onClick={handleBackspace}
          className="h-12 rounded-xl bg-surface hover:bg-surface-2 active:bg-line border border-line shadow-xs flex items-center justify-center text-muted font-bold transition-transform active:scale-95"
          aria-label="Backspace"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7h11a2 2 0 012 2v10a2 2 0 01-2 2H10l-7-7z"
            />
          </svg>
        </button>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        disabled={disabled || isSubmitting || value.trim().length === 0}
        onClick={onSubmit}
        className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-ink active:scale-98 transition-all disabled:opacity-40 shadow-sm"
      >
        {isSubmitting ? "Checking…" : "Check Answer"}
      </button>
    </div>
  );
}
