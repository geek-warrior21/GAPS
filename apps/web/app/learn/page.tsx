"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConceptsResponse, HomeDashboardResponse } from "@gaps/contracts";
import { Header } from "@/components/common/Header";

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  not_assessed: {
    label: "Not explored yet",
    badgeClass: "bg-surface-2 text-muted border-line",
    icon: "○",
  },
  needs_support: {
    label: "Let's work on this",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    icon: "💡",
  },
  developing: {
    label: "Getting there",
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
    icon: "📈",
  },
  demonstrated: {
    label: "You can do this",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    icon: "✓",
  },
  retained: {
    label: "Locked in",
    badgeClass: "bg-teal/15 text-teal border-teal/40",
    icon: "★",
  },
};

export default function LearnPage() {
  const router = useRouter();
  const [conceptsData, setConceptsData] = useState<ConceptsResponse | null>(null);
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [homeRes, conceptsRes] = await Promise.all([
          fetch("/api/v1/home"),
          fetch("/api/v1/concepts"),
        ]);

        if (homeRes.status === 401 || conceptsRes.status === 401) {
          router.push("/login");
          return;
        }

        if (!conceptsRes.ok) {
          throw new Error("Failed to load curriculum");
        }

        const conceptsJson: ConceptsResponse = await conceptsRes.json();
        setConceptsData(conceptsJson);

        if (homeRes.ok) {
          const homeJson: HomeDashboardResponse = await homeRes.json();
          setHomeData(homeJson);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading concepts");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleStartConcept = (conceptId: string) => {
    router.push(`/session?conceptId=${conceptId}&mode=learn`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted">Loading fractions curriculum…</p>
        </div>
      </div>
    );
  }

  if (error || !conceptsData) {
    return (
      <div className="min-h-screen bg-surface-2 flex flex-col">
        <Header
          displayName={homeData?.student.displayName}
          sparksTotal={homeData?.student.sparksTotal}
        />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface rounded-3xl border border-line shadow-sm text-center space-y-4">
            <p className="text-sm font-bold text-ink">{error || "Could not load curriculum"}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <Header
        displayName={homeData?.student.displayName}
        sparksTotal={homeData?.student.sparksTotal}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Fractions Curriculum</h1>
          <p className="text-xs text-muted mt-1">
            Explore concepts chapter by chapter. Learn at your own pace with step-by-step guidance.
          </p>
        </div>

        <div className="space-y-8">
          {conceptsData.chapters.map((chapter) => (
            <section
              key={chapter.id}
              className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                    Chapter {chapter.id}
                  </span>
                  <h2 className="text-lg font-extrabold text-ink">{chapter.title}</h2>
                </div>
                <span className="text-xs font-bold text-muted tabular-nums">
                  {chapter.concepts.length} concepts
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chapter.concepts.map((concept) => {
                  const statusInfo = STATUS_CONFIG[concept.status] ?? STATUS_CONFIG.not_assessed!;

                  return (
                    <div
                      key={concept.id}
                      className="p-4 rounded-2xl border border-line bg-surface-2/40 hover:bg-surface-2 flex flex-col justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-extrabold border ${statusInfo.badgeClass}`}
                          >
                            <span>{statusInfo.icon}</span>
                            <span>{statusInfo.label}</span>
                          </span>
                          <span className="text-2xs font-bold text-muted">
                            #{concept.topoOrder}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-ink text-sm leading-snug">
                          {concept.studentTitle}
                        </h3>
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">
                          {concept.description}
                        </p>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleStartConcept(concept.id)}
                          className="w-full py-2 bg-primary hover:bg-primary-ink text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                        >
                          <span>
                            {concept.status === "not_assessed"
                              ? "Start Learning"
                              : "Practise Skill"}
                          </span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
