"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BossBattleInfoDto, HomeDashboardResponse } from "@gaps/contracts";
import { Header } from "@/components/common/Header";
import { QuestCard } from "@/components/quest/QuestCard";

export default function PlayPage() {
  const router = useRouter();
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [bosses, setBosses] = useState<BossBattleInfoDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [homeRes, bossesRes] = await Promise.all([
          fetch("/api/v1/home"),
          fetch("/api/v1/bosses"),
        ]);

        if (homeRes.status === 401 || bossesRes.status === 401) {
          router.push("/login");
          return;
        }

        if (homeRes.ok) {
          const homeJson: HomeDashboardResponse = await homeRes.json();
          setHomeData(homeJson);
        }

        if (bossesRes.ok) {
          const bossesJson = await bossesRes.json();
          setBosses(bossesJson.bosses ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading challenges");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleStartQuest = () => {
    router.push("/session?mode=quest");
  };

  const handleStartBoss = (chapterId: string) => {
    const chapterConceptMap: Record<string, string> = {
      A: "MATH-FRAC-PART",
      B: "MATH-NUM-LCM",
      C: "MATH-FRAC-DEC",
    };
    const conceptId = chapterConceptMap[chapterId] ?? "MATH-FRAC-PART";
    router.push(`/session?conceptId=${conceptId}&mode=boss`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted">Loading games and battles…</p>
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Play & Challenges</h1>
          <p className="text-xs text-muted mt-1">
            Complete daily quests, battle chapter bosses, and earn Sparks!
          </p>
        </div>

        {error && (
          <div className="bg-amber/10 border border-amber/30 text-ink rounded-2xl p-4 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Daily Quest Section */}
        {homeData && (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-ink">Daily Challenge</h2>
            <div className="max-w-xl">
              <QuestCard quest={homeData.dailyQuest} onStartQuest={handleStartQuest} />
            </div>
          </div>
        )}

        {/* Chapter Boss Battles Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Chapter Boss Battles</h2>
            <p className="text-xs text-muted">
              8 intense questions with no hints. Answer at least 6 correctly to defeat the boss and
              earn +40 Sparks!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bosses.map((boss) => {
              const isDefeated = boss.status === "defeated";
              const isLocked = !boss.unlocked;

              return (
                <div
                  key={boss.chapterId}
                  className={`p-6 rounded-3xl border flex flex-col justify-between gap-5 transition-all shadow-xs ${
                    isDefeated
                      ? "bg-teal/5 border-teal/30"
                      : isLocked
                        ? "bg-surface-2/60 border-line opacity-85"
                        : "bg-surface border-line hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                        Chapter {boss.chapterId}
                      </span>
                      <span
                        className={`text-2xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                          isDefeated
                            ? "bg-teal/20 text-teal border-teal/40"
                            : isLocked
                              ? "bg-surface text-muted border-line"
                              : "bg-amber-100 text-amber-900 border-amber-300"
                        }`}
                      >
                        {isDefeated ? "★ Defeated" : isLocked ? "🔒 Locked" : "⚔ Ready"}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-ink text-base">{boss.name}</h3>
                    <p className="text-xs text-muted leading-relaxed font-medium">
                      {boss.unlockRule}
                    </p>

                    {/* Progress Indicator */}
                    <div className="pt-1 space-y-1.5">
                      <div className="flex justify-between text-2xs font-bold text-muted">
                        <span>Progress to unlock</span>
                        <span>
                          {boss.developingOrMasteredCount} / {boss.totalConcepts} concepts
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (boss.developingOrMasteredCount / boss.totalConcepts) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Last Result if any */}
                    {boss.lastResult && (
                      <div className="text-2xs font-bold text-muted p-2 rounded-xl bg-surface-2/60">
                        Last result: {boss.lastResult.correctN}/{boss.lastResult.totalN} correct (
                        {boss.lastResult.status})
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleStartBoss(boss.chapterId)}
                      className={`w-full py-3 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-2 ${
                        isLocked
                          ? "bg-line text-muted cursor-not-allowed"
                          : isDefeated
                            ? "bg-teal text-white hover:bg-teal/90"
                            : "bg-primary text-white hover:bg-primary-ink active:scale-98"
                      }`}
                    >
                      <span>
                        {isLocked ? "🔒 Locked" : isDefeated ? "Battle Again" : "⚔ Battle Boss"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
