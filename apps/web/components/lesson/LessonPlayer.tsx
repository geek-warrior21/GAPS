"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LessonSessionResponse, LessonRespondResponse } from "@gaps/contracts";
import { LessonActivityRenderer } from "./LessonActivityRenderer";

interface LessonPlayerProps {
  initialData: LessonSessionResponse;
}

export function LessonPlayer({ initialData }: LessonPlayerProps) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<LessonSessionResponse>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { lesson, currentActivityIndex, isCompleted } = sessionData;
  const currentActivity = sessionData.activeActivity ?? lesson.activities[currentActivityIndex];
  const isFinalActivity =
    currentActivityIndex + 1 >= lesson.activities.length && !sessionData.activeBranch;

  const handleRespond = async (response: unknown) => {
    if (!currentActivity) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/lessons/${lesson.lessonId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: currentActivity.id,
          response,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || "Failed to submit activity response");
      }

      const result: LessonRespondResponse = await res.json();

      setSessionData((prev) => ({
        ...prev,
        currentActivityIndex: result.nextActivityIndex,
        activeActivity: result.activeActivity,
        activeBranch: result.activeBranch,
        completedActivities: prev.completedActivities.includes(currentActivity.id)
          ? prev.completedActivities
          : [...prev.completedActivities, currentActivity.id],
        isCompleted: result.isCompleted,
        sparksAwarded: (prev.sparksAwarded ?? 0) + result.sparksAwarded,
      }));
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Top Navigation & Status Bar */}
      <header className="bg-surface border-b border-line px-4 sm:px-8 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/learn"
              className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 hover:bg-surface text-ink text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Back to Learn</span>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-extrabold uppercase tracking-wider text-primary">
                  {lesson.subject === "maths" ? "📐 Mathematics" : "⚡ Science"} • Class{" "}
                  {lesson.level}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-ink leading-tight">
                {lesson.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sessionData.activeBranch ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded-full text-xs font-black">
                <span>🎯</span>
                <span>Adaptive Support</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded-full text-xs font-black">
                <span>✨</span>
                <span>+15 Sparks</span>
              </div>
            )}
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="max-w-4xl mx-auto mt-4 pt-3 border-t border-line flex flex-col gap-2">
          <div className="flex items-center justify-between text-2xs font-extrabold text-muted">
            <span>
              ACTIVITY {Math.min(currentActivityIndex + 1, lesson.activities.length)} OF{" "}
              {lesson.activities.length}
            </span>
            {sessionData.activeBranch ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 font-black text-2xs uppercase">
                Remediation: {sessionData.activeBranch.stage.replace("_", " ")}
              </span>
            ) : (
              <span>{isCompleted ? "COMPLETED" : currentActivity?.title}</span>
            )}
          </div>

          <div className="grid grid-flow-col auto-cols-fr gap-2">
            {lesson.activities.map((act, index) => {
              const isDone = sessionData.completedActivities.includes(act.id);
              const isCurrent = index === currentActivityIndex && !isCompleted;

              let barClass = "bg-line";
              if (isDone) barClass = "bg-primary";
              else if (isCurrent) barClass = "bg-primary/40 animate-pulse";

              return (
                <div
                  key={act.id}
                  className={`h-2 rounded-full transition-all ${barClass}`}
                  title={act.title}
                />
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-900 rounded-2xl text-xs font-bold flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-950 font-black cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Adaptive Remediation Indicator */}
        {sessionData.activeBranch && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-amber-900 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span className="text-xs font-extrabold">
                Targeted remediation active: addressing misconception with hands-on practice & fresh
                check
              </span>
            </div>
            <span className="text-2xs font-black uppercase tracking-wider bg-amber-200/80 px-2.5 py-1 rounded-lg">
              Step: {sessionData.activeBranch.stage.replace("_", " ")}
            </span>
          </div>
        )}

        {/* Completion Screen */}
        {isCompleted ? (
          <div className="p-8 sm:p-12 bg-surface rounded-3xl border border-line shadow-xs text-center space-y-8 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-4xl shadow-inner">
              🎉
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700">
                Lesson Concluded
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">Outstanding Effort!</h2>
              <p className="text-sm text-muted font-medium">
                You worked through the concepts, investigated the model hands-on, and verified your
                understanding.
              </p>
            </div>

            <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl max-w-md mx-auto flex items-center justify-center gap-3">
              <span className="text-3xl">✨</span>
              <div className="text-left">
                <div className="text-sm font-extrabold text-amber-950">
                  +15 Sparks Added to Your Ledger
                </div>
                <div className="text-xs font-medium text-amber-900">
                  Evidence of independent participation recorded.
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-2/40 border border-line rounded-2xl max-w-lg mx-auto text-left space-y-3">
              <div className="text-xs font-extrabold text-muted uppercase tracking-wider">
                What you learned in this lesson:
              </div>
              <ul className="space-y-2">
                {lesson.learningObjectives.map((obj, i) => (
                  <li key={i} className="text-xs font-bold text-ink flex items-start gap-2">
                    <span className="text-teal-600 font-black">✓</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/learn")}
                className="px-8 py-3.5 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                Return to Curriculum
              </button>
            </div>
          </div>
        ) : currentActivity ? (
          <LessonActivityRenderer
            key={currentActivity.id}
            activity={currentActivity}
            isSubmitting={isSubmitting}
            onRespond={handleRespond}
            isFinalActivity={isFinalActivity}
          />
        ) : (
          <div className="p-8 bg-surface rounded-3xl border border-line text-center space-y-4">
            <p className="text-sm font-bold text-ink">No more activities in this lesson.</p>
            <Link
              href="/learn"
              className="inline-block px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-xs"
            >
              Return to Learn
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
