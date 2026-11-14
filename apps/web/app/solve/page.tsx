"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { HomeDashboardResponse, SolveInitResponse } from "@gaps/contracts";
import { Header } from "@/components/common/Header";
import { RichTextViewer } from "@/components/math/RichTextViewer";

const PRESET_PROBLEMS = [
  {
    label: "Parts of a whole: Shading fractions",
    text: "How do I shade 3 parts out of 4?",
    conceptId: "MATH-FRAC-PART",
  },
  {
    label: "Equivalent fractions: Equal pieces",
    text: "How do I find equivalent fractions for 2/3?",
    conceptId: "MATH-FRAC-EQUIV",
  },
  {
    label: "Simplifying: Lowest terms",
    text: "How do I simplify 6/8 to simplest form?",
    conceptId: "MATH-FRAC-SIMPLIFY",
  },
  {
    label: "Adding unlike fractions: Common denominator",
    text: "How do I add 1/3 and 1/4?",
    conceptId: "MATH-FRAC-ADDUNLIKE",
  },
  {
    label: "Multiplying fractions: Straight across",
    text: "How do I multiply 2/5 and 3/4?",
    conceptId: "MATH-FRAC-MULT",
  },
  {
    label: "Word problem: Sharing rotis",
    text: "Priya has 3 rotis to share equally among 4 friends. How much does each friend get?",
    conceptId: "MATH-FRAC-WORD",
  },
];

export default function SolvePage() {
  const router = useRouter();
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [solveResult, setSolveResult] = useState<SolveInitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/v1/home");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setHomeData(data);
        }
      } catch {
        // Ignore
      }
    }
    loadUser();
  }, [router]);

  const handleSolve = async (textToSolve?: string, preferredConceptId?: string) => {
    const text = textToSolve ?? inputText;
    if (!text.trim() && !preferredConceptId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          conceptId: preferredConceptId || undefined,
          problemType: "arithmetic",
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to analyze question");
      }

      const data: SolveInitResponse = await res.json();
      setSolveResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to solve");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryOneLikeIt = (conceptId: string) => {
    router.push(`/session?conceptId=${conceptId}&mode=learn`);
  };

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <Header
        displayName={homeData?.student.displayName}
        sparksTotal={homeData?.student.sparksTotal}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <div>
          <span className="text-2xs font-extrabold text-primary uppercase tracking-wider">
            Guided Problem Solving
          </span>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Solve With Me</h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Stuck on a homework problem? Ask any fraction question and we&apos;ll guide you through
            the reasoning step-by-step using authored visual models.
          </p>
        </div>

        {/* Question Input Card */}
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
          <label
            htmlFor="solve-input"
            className="block text-xs font-extrabold text-ink uppercase tracking-wider"
          >
            Type your maths question or problem
          </label>
          <div className="flex gap-2">
            <input
              id="solve-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSolve();
              }}
              placeholder="e.g. How do I add 1/3 and 1/4?"
              className="flex-1 px-4 py-3 rounded-xl border border-line bg-surface-2 text-sm text-ink placeholder:text-muted focus:outline-hidden focus:border-primary font-medium"
            />
            <button
              type="button"
              disabled={isLoading || !inputText.trim()}
              onClick={() => handleSolve()}
              className="px-6 py-3 bg-primary hover:bg-primary-ink text-white font-extrabold text-sm rounded-xl transition-colors shadow-xs disabled:opacity-50"
            >
              {isLoading ? "Thinking…" : "Guide Me"}
            </button>
          </div>

          {error && <p className="text-xs font-bold text-red-600">{error}</p>}

          {/* Quick Preset Ideas */}
          <div className="space-y-2 pt-2 border-t border-line">
            <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
              Or pick an example to explore:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROBLEMS.map((preset) => (
                <button
                  key={preset.conceptId}
                  type="button"
                  onClick={() => {
                    setInputText(preset.text);
                    handleSolve(preset.text, preset.conceptId);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-line bg-surface-2/60 hover:bg-surface-2 text-2xs font-bold text-ink transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Guided Solution View */}
        {solveResult && (
          <div className="p-6 bg-surface rounded-3xl border border-primary/30 shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                  Target Concept
                </span>
                <h3 className="text-lg font-extrabold text-ink">{solveResult.conceptTitle}</h3>
              </div>
              <span className="text-xs font-bold text-muted bg-surface-2 px-3 py-1 rounded-full">
                Guided walkthrough
              </span>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
              <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                Visual Explanation
              </span>
              <div className="text-sm text-ink leading-relaxed font-medium">
                {solveResult.initialStep.kind === "explanation" && (
                  <RichTextViewer segments={solveResult.initialStep.body} />
                )}
              </div>
            </div>

            <div className="p-5 bg-teal/10 border border-teal/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-ink text-sm">Ready to practise?</h4>
                <p className="text-xs text-muted">
                  Test your understanding with a fresh independent question on this concept.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleTryOneLikeIt(solveResult.conceptId)}
                className="px-5 py-2.5 bg-teal hover:bg-teal/90 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span>Try one like it</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
