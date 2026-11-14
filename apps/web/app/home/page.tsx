"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GapMapResponse, HomeDashboardResponse } from "@gaps/contracts";
import { Header } from "@/components/common/Header";
import { QuestCard } from "@/components/quest/QuestCard";
import { GapMap } from "@/components/gapmap/GapMap";

export default function HomePage() {
  const router = useRouter();
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [gapMapData, setGapMapData] = useState<GapMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConsentPending, setIsConsentPending] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch home dashboard
        const homeRes = await fetch("/api/v1/home");
        if (homeRes.status === 401) {
          router.push("/login");
          return;
        }

        if (homeRes.status === 403) {
          const errData = await homeRes.json().catch(() => ({}));
          if (errData.error?.code === "CONSENT_REQUIRED") {
            setIsConsentPending(true);
            setIsLoading(false);
            return;
          }
        }

        if (!homeRes.ok) {
          throw new Error("Failed to load dashboard");
        }

        const homeJson: HomeDashboardResponse = await homeRes.json();
        setHomeData(homeJson);

        // Fetch GapMap data
        const gapRes = await fetch("/api/v1/gapmap");
        if (gapRes.ok) {
          const gapJson: GapMapResponse = await gapRes.json();
          setGapMapData(gapJson);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading dashboard");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleStartSession = (conceptId?: string, mode: "learn" | "review" = "learn") => {
    const url = conceptId
      ? `/session?conceptId=${conceptId}&mode=${mode}`
      : `/session?mode=${mode}`;
    router.push(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted">Loading your learning map…</p>
        </div>
      </div>
    );
  }

  if (isConsentPending) {
    return (
      <div className="min-h-screen bg-surface-2 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 bg-surface rounded-3xl border border-line shadow-sm text-center space-y-5">
            <span className="text-4xl">📋</span>
            <h2 className="text-2xl font-extrabold text-ink">Parent Consent Needed</h2>
            <p className="text-sm text-text leading-relaxed">
              Your teacher is still setting things up for your class. Ask them about returning your
              Gaps parent consent form so you can start learning!
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-3 bg-surface-2 hover:bg-line text-ink font-bold rounded-xl text-sm transition-colors"
              >
                Sign out or switch student
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !homeData) {
    return (
      <div className="min-h-screen bg-surface-2 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface rounded-3xl border border-line shadow-sm text-center space-y-4">
            <p className="text-sm font-bold text-ink">{error || "Could not load data"}</p>
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
        displayName={homeData.student.displayName}
        sparksTotal={homeData.student.sparksTotal}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Retention / Warmup Review Due Banner */}
        {homeData.dueReviews.length > 0 && (
          <div className="p-4 bg-teal/10 border border-teal/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <h4 className="font-extrabold text-ink text-sm">
                  Review Ready: {homeData.dueReviews[0]?.conceptTitle}
                </h4>
                <p className="text-xs text-muted">
                  Spaced review keeps your knowledge fresh and earns retention stars.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStartSession(homeData.dueReviews[0]?.conceptId, "review")}
              className="px-4 py-2 bg-teal hover:bg-teal/90 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              Start Review Now →
            </button>
          </div>
        )}

        {/* Dashboard Top Row: Continue Learning Card & Daily Quest Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Continue Learning Target Card */}
          <div className="p-6 bg-surface rounded-2xl border border-line shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                  Target Skill
                </span>
                <span className="text-xs font-bold text-muted capitalize">
                  Status: {homeData.focusConcept.status.replace("_", " ")}
                </span>
              </div>

              <h2 className="text-2xl font-extrabold text-ink leading-tight">
                {homeData.focusConcept.studentTitle}
              </h2>
              <p className="text-xs text-muted font-medium">
                {homeData.focusConcept.title} · Step-by-step adaptive practice
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleStartSession(homeData.focusConcept.id, "learn")}
                className="w-full py-4 bg-primary text-white rounded-xl font-extrabold text-base hover:bg-primary-ink active:scale-98 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>Continue Learning</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Daily Quest Card */}
          <QuestCard
            quest={homeData.dailyQuest}
            onStartQuest={() => handleStartSession(homeData.focusConcept.id, "learn")}
          />
        </div>

        {/* GapMap Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-ink tracking-tight">GapMap</h2>
              <p className="text-xs text-muted">
                Your visual progress across all 14 fractions concepts. Tap any skill to view mastery
                evidence.
              </p>
            </div>
          </div>

          {gapMapData && (
            <GapMap
              data={gapMapData}
              onSelectConcept={(conceptId) => handleStartSession(conceptId, "learn")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
