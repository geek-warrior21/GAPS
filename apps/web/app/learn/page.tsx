"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ConceptsResponse,
  HomeDashboardResponse,
  RecommendedNextAction,
} from "@gaps/contracts";
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
  const [selectedSubject, setSelectedSubject] = useState<"maths" | "science">("maths");
  const [conceptsData, setConceptsData] = useState<ConceptsResponse | null>(null);
  const [homeData, setHomeData] = useState<HomeDashboardResponse | null>(null);
  const [nextAction, setNextAction] = useState<RecommendedNextAction | null>(null);
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

  useEffect(() => {
    async function fetchNextAction() {
      try {
        const res = await fetch(`/api/v1/curriculum/next-action?subject=${selectedSubject}`);
        if (res.ok) {
          const json: RecommendedNextAction = await res.json();
          setNextAction(json);
        }
      } catch {
        // Ignore background fetch error
      }
    }
    fetchNextAction();
  }, [selectedSubject]);

  const handleStartConcept = (conceptId: string) => {
    router.push(`/session?conceptId=${conceptId}&mode=learn`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted">Loading curriculum…</p>
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
        {/* Top Header & Subject Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              Fractions Curriculum & Lessons
            </h1>
            <p className="text-xs text-muted mt-1">
              Class 6 learning paths. Hands-on interactive explorations, simulations, and guided
              practice.
            </p>
          </div>

          {/* Subject Switcher & Dev Planner Link */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/dev/lesson-planner"
              data-testid="link-dev-planner"
              className="px-3 py-2 rounded-xl border border-dashed border-purple-500/40 text-purple-700 bg-purple-500/10 hover:bg-purple-500/20 text-2xs font-extrabold transition-colors flex items-center gap-1.5"
            >
              <span>🛠️</span>
              <span>Dev Planner</span>
            </Link>

            <div className="flex items-center gap-1.5 p-1 bg-surface rounded-2xl border border-line shadow-2xs">
              <button
                type="button"
                data-testid="tab-subject-maths"
                onClick={() => setSelectedSubject("maths")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedSubject === "maths"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>📐</span>
                <span>Mathematics</span>
              </button>
              <button
                type="button"
                data-testid="tab-subject-science"
                onClick={() => setSelectedSubject("science")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedSubject === "science"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>⚡</span>
                <span>Science</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Next Action on Return based on persisted evidence */}
        {nextAction && nextAction.actionType !== "start_objective" && (
          <div
            data-testid="next-action-card"
            className={`p-6 rounded-3xl border-2 shadow-xs space-y-4 animate-fade-in ${
              nextAction.actionType === "revisit_unresolved"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-950"
                : nextAction.actionType === "fresh_check"
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-950"
                  : "bg-teal-500/10 border-teal-500/30 text-teal-950"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`px-3 py-1 rounded-full text-2xs font-extrabold uppercase tracking-wider ${
                  nextAction.actionType === "revisit_unresolved"
                    ? "bg-amber-600 text-white"
                    : nextAction.actionType === "fresh_check"
                      ? "bg-indigo-600 text-white"
                      : "bg-teal-600 text-white"
                }`}
              >
                {nextAction.actionType === "revisit_unresolved"
                  ? "🛑 Action on Return: Revisit Objective"
                  : nextAction.actionType === "fresh_check"
                    ? "✍️ Action on Return: Fresh Check"
                    : "🚀 Next Milestone"}
              </span>
              <span className="text-2xs font-bold uppercase tracking-wider opacity-80">
                Reason: {nextAction.reasonCode}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-ink">{nextAction.title}</h2>
              <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-90">
                {nextAction.description}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href={`/lesson/${nextAction.lessonId}`}
                data-testid="next-action-button"
                className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 ${
                  nextAction.actionType === "revisit_unresolved"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : nextAction.actionType === "fresh_check"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                }`}
              >
                <span>{nextAction.ctaLabel}</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* MATHEMATICS VIEW */}
        {selectedSubject === "maths" && (
          <div className="space-y-8 animate-fade-in">
            {/* Featured Dynamic Interactive Lesson */}
            <div className="p-6 bg-linear-to-br from-primary/10 via-surface to-surface rounded-3xl border-2 border-primary/20 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 bg-primary text-white rounded-full text-2xs font-extrabold uppercase tracking-wider">
                  Interactive Teaching Slice
                </span>
                <span className="flex items-center gap-1 text-amber-900 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-black border border-amber-500/20">
                  <span>✨</span>
                  <span>+15 Sparks</span>
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-ink">
                  Fractions: Fair Shares & Parts of a Whole
                </h2>
                <p className="text-xs sm:text-sm text-muted font-medium leading-relaxed">
                  Manipulate fraction strips, adjust slice counts, predict fair shares, and verify
                  your understanding through interactive models.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-2xs font-bold text-muted">
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">1. Introduction</span>
                  Equal sharing concept
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">2. Interactive Strip</span>
                  Slice & shade models
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">3. Predict & Observe</span>
                  Hypothesize & verify
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">4. Practice & Check</span>
                  Target build & check
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                <Link
                  href="/lesson/lesson-maths-frac-part-adaptive"
                  data-testid="start-maths-adaptive-lesson-button"
                  className="px-5 py-3 bg-surface-2 hover:bg-line text-ink border border-line rounded-2xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Step-by-Step Lesson</span>
                  <span>🧭</span>
                </Link>
                <Link
                  href="/lesson/lesson-maths-frac-part-1"
                  data-testid="start-maths-lesson-button"
                  className="px-6 py-3 bg-primary hover:bg-primary-ink text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2"
                >
                  <span>Launch Interactive Lesson</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Existing Chapters & Concepts */}
            <div className="space-y-6">
              <h3 className="text-base font-extrabold text-ink">Fractions Practice Chapters</h3>
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
                      <h4 className="text-lg font-extrabold text-ink">{chapter.title}</h4>
                    </div>
                    <span className="text-xs font-bold text-muted tabular-nums">
                      {chapter.concepts.length} concepts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {chapter.concepts.map((concept) => {
                      const statusInfo =
                        STATUS_CONFIG[concept.status] ?? STATUS_CONFIG.not_assessed!;

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

                            <h5 className="font-extrabold text-ink text-sm leading-snug">
                              {concept.studentTitle}
                            </h5>
                            <p className="text-xs text-muted leading-relaxed line-clamp-2">
                              {concept.description}
                            </p>
                          </div>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleStartConcept(concept.id)}
                              className="w-full py-2 bg-primary hover:bg-primary-ink text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
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
          </div>
        )}

        {/* SCIENCE VIEW */}
        {selectedSubject === "science" && (
          <div className="space-y-6 animate-fade-in">
            {/* Science Topic 1: Simple Circuits */}
            <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl font-black">
                    💡
                  </span>
                  <div>
                    <span className="text-2xs font-extrabold text-amber-600 uppercase tracking-wider">
                      Electricity & Circuits • Topic 1
                    </span>
                    <h2 className="text-xl font-extrabold text-ink">
                      Electric Current & Simple Circuits
                    </h2>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-amber-900 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-black border border-amber-500/20">
                  <span>✨</span>
                  <span>+15 Sparks</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted font-medium leading-relaxed">
                Build and test a simple closed circuit loop. Flip switches, connect wires, make
                predictions about open loops, and see the bulb glow.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-bold text-muted">
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">1. Loop Intro</span>
                  Continuous path
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">2. Interactive Lab</span>
                  Switch & wires
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">3. Predict & Test</span>
                  Open circuit test
                </div>
                <div className="p-2.5 bg-surface-2/60 rounded-xl border border-line">
                  <span className="block text-ink font-extrabold">4. Guided Challenge</span>
                  Complete loop
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                <Link
                  href="/lesson/lesson-sci-circuits-adaptive"
                  data-testid="start-circuits-adaptive-lesson-button"
                  className="px-5 py-3 bg-surface-2 hover:bg-line text-ink border border-line rounded-2xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Step-by-Step Lesson</span>
                  <span>🧭</span>
                </Link>
                <Link
                  href="/lesson/lesson-sci-circuits-mastery"
                  data-testid="start-circuits-mastery-button"
                  className="px-5 py-3 bg-surface-2 hover:bg-line text-ink border border-line rounded-2xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Take Mastery Assessment</span>
                  <span>✍️</span>
                </Link>
                <Link
                  href="/lesson/lesson-sci-circuits-1"
                  data-testid="start-circuits-lesson-button"
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2"
                >
                  <span>Launch Circuit Simulator</span>
                  <span>⚡</span>
                </Link>
              </div>
            </div>

            {/* Science Topic 2: Conductors & Insulators (Added via Configuration) */}
            <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-xl font-black">
                    🧲
                  </span>
                  <div>
                    <span className="text-2xs font-extrabold text-teal-600 uppercase tracking-wider">
                      Materials & Conduction • Topic 2
                    </span>
                    <h2 className="text-xl font-extrabold text-ink">
                      Conductors & Insulators: Testing Materials
                    </h2>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-amber-900 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-black border border-amber-500/20">
                  <span>✨</span>
                  <span>+15 Sparks</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted font-medium leading-relaxed">
                Test whether different materials allow electric current to pass through a circuit
                loop. Compare copper keys and rubber erasers.
              </p>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/lesson/lesson-sci-conductors-1"
                  data-testid="start-conductors-lesson-button"
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2"
                >
                  <span>Explore Conductors</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
