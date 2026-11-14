"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GapMapResponse, HomeDashboardResponse } from "@gaps/contracts";
import { Header } from "@/components/common/Header";
import { GapMap } from "@/components/gapmap/GapMap";

export default function GapMapPage() {
  const router = useRouter();
  const [gapMapData, setGapMapData] = useState<GapMapResponse | null>(null);
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [homeRes, gapRes] = await Promise.all([
          fetch("/api/v1/home"),
          fetch("/api/v1/gapmap"),
        ]);

        if (homeRes.status === 401 || gapRes.status === 401) {
          router.push("/login");
          return;
        }

        if (homeRes.ok) {
          const homeJson: HomeDashboardResponse = await homeRes.json();
          setHomeData(homeJson);
        }

        if (!gapRes.ok) {
          throw new Error("Failed to load GapMap");
        }

        const gapJson: GapMapResponse = await gapRes.json();
        setGapMapData(gapJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading GapMap");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleSelectConcept = (conceptId: string) => {
    router.push(`/session?conceptId=${conceptId}&mode=learn`);
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

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <Header
        displayName={homeData?.student.displayName}
        sparksTotal={homeData?.student.sparksTotal}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">GapMap</h1>
          <p className="text-xs text-muted mt-1">
            Visual map of all 14 fractions skills. Tap any concept to see mastery evidence or start
            practice.
          </p>
        </div>

        {error && (
          <div className="bg-amber/10 border border-amber/30 text-ink rounded-2xl p-4 text-sm font-semibold">
            {error}
          </div>
        )}

        {gapMapData && (
          <div className="bg-surface p-6 rounded-3xl border border-line shadow-xs">
            <GapMap data={gapMapData} onSelectConcept={handleSelectConcept} />
          </div>
        )}
      </main>
    </div>
  );
}
