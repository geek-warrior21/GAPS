"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  LessonSessionResponse,
  LessonRespondResponse,
  LessonPlan,
  LessonActivity,
} from "@gaps/contracts";
import { LessonActivityRenderer } from "./LessonActivityRenderer";

interface LessonPlayerProps {
  initialData: LessonSessionResponse;
  isPreview?: boolean;
}

function evaluatePreviewActivityResponse(
  lesson: LessonPlan,
  sessionData: LessonSessionResponse,
  currentActivity: LessonActivity,
  response: unknown,
): LessonRespondResponse {
  const currentIdx = sessionData.currentActivityIndex;

  if (sessionData.activeBranch) {
    const parentActivity = lesson.activities.find(
      (a) => a.id === sessionData.activeBranch?.parentActivityId,
    );
    const remediation = parentActivity?.remediation;

    if (sessionData.activeBranch.stage === "remediation_activity") {
      return {
        activityId: currentActivity.id,
        accepted: true,
        feedback: "Remediation exploration completed!",
        activeBranch: { ...sessionData.activeBranch, stage: "followup_check" },
        activeActivity: remediation?.followUpCheck,
        nextActivityIndex: currentIdx,
        isCompleted: false,
        sparksAwarded: 0,
      };
    }

    if (sessionData.activeBranch.stage === "followup_check") {
      const cfg = currentActivity.config as {
        correctAnswer: string;
        choices?: Array<{ id: string }>;
      };
      const answer =
        typeof response === "object" && response !== null && "choiceId" in response
          ? (response as { choiceId: string }).choiceId
          : String(response);
      const isCorrect = answer === cfg.correctAnswer;

      if (isCorrect) {
        const nextIdx = currentIdx + 1 >= lesson.activities.length ? currentIdx : currentIdx + 1;
        const isFinal = currentIdx + 1 >= lesson.activities.length;
        return {
          activityId: currentActivity.id,
          accepted: true,
          isCorrect: true,
          feedback: "Correct! Advancing to main practice.",
          activeBranch: null,
          activeActivity: lesson.activities[nextIdx],
          nextActivityIndex: nextIdx,
          isCompleted: isFinal,
          sparksAwarded: 0,
        };
      }

      return {
        activityId: currentActivity.id,
        accepted: true,
        isCorrect: false,
        feedback: "Let's review the key idea together.",
        activeBranch: { ...sessionData.activeBranch, stage: "stopping_point" },
        activeActivity: remediation?.stoppingPoint,
        nextActivityIndex: currentIdx,
        isCompleted: false,
        sparksAwarded: 0,
      };
    }

    if (sessionData.activeBranch.stage === "stopping_point") {
      const nextIdx = currentIdx + 1 >= lesson.activities.length ? currentIdx : currentIdx + 1;
      const isFinal = currentIdx + 1 >= lesson.activities.length;
      return {
        activityId: currentActivity.id,
        accepted: true,
        feedback: "Continuing lesson with scaffolded support.",
        activeBranch: null,
        activeActivity: lesson.activities[nextIdx],
        nextActivityIndex: nextIdx,
        isCompleted: isFinal,
        sparksAwarded: 0,
      };
    }
  }

  // Linear activities
  if (currentActivity.type === "predict_and_observe") {
    const cfg = currentActivity.config as {
      predictionChoices: Array<{ id: string; isExpected?: boolean }>;
    };
    const choiceId =
      typeof response === "object" && response !== null && "choiceId" in response
        ? (response as { choiceId: string }).choiceId
        : String(response);
    const selected = cfg.predictionChoices.find((c) => c.id === choiceId);
    const isCorrect = Boolean(selected?.isExpected);

    if (!isCorrect && currentActivity.remediation) {
      return {
        activityId: currentActivity.id,
        accepted: true,
        isCorrect: false,
        feedback: currentActivity.remediation.targetedExplanation,
        activeBranch: {
          parentActivityId: currentActivity.id,
          stage: "remediation_activity",
          attemptsCount: 1,
        },
        activeActivity: currentActivity.remediation.remediationActivity,
        nextActivityIndex: currentIdx,
        isCompleted: false,
        sparksAwarded: 0,
      };
    }
  }

  const nextIdx = currentIdx + 1 >= lesson.activities.length ? currentIdx : currentIdx + 1;
  const isFinal = currentIdx + 1 >= lesson.activities.length;

  return {
    activityId: currentActivity.id,
    accepted: true,
    isCorrect: true,
    nextActivityIndex: nextIdx,
    activeBranch: null,
    activeActivity: lesson.activities[nextIdx],
    isCompleted: isFinal,
    sparksAwarded: isFinal ? 15 : 0,
  };
}

export function LessonPlayer({ initialData, isPreview = false }: LessonPlayerProps) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<LessonSessionResponse>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A server-graded check keeps its result on screen until the learner continues.
  const [pendingResult, setPendingResult] = useState<LessonRespondResponse | null>(null);

  const { lesson, currentActivityIndex, isCompleted } = sessionData;
  const adaptive = sessionData.adaptive;
  const currentActivity = sessionData.activeActivity ?? lesson.activities[currentActivityIndex];
  const isFinalActivity = adaptive
    ? adaptive.isClosingStep
    : currentActivityIndex + 1 >= lesson.activities.length && !sessionData.activeBranch;

  const applyResult = (answered: LessonActivity, result: LessonRespondResponse) => {
    setSessionData((prev) => {
      const next = result.activeActivity;
      const activities =
        prev.adaptive && next && !prev.lesson.activities.some((a) => a.id === next.id)
          ? [...prev.lesson.activities, next]
          : prev.lesson.activities;
      return {
        ...prev,
        lesson: { ...prev.lesson, activities },
        adaptive: result.adaptive ?? prev.adaptive,
        currentActivityIndex: result.nextActivityIndex,
        activeActivity: result.activeActivity,
        activeBranch: result.activeBranch,
        completedActivities: prev.completedActivities.includes(answered.id)
          ? prev.completedActivities
          : [...prev.completedActivities, answered.id],
        isCompleted: result.isCompleted,
        sparksAwarded: (prev.sparksAwarded ?? 0) + result.sparksAwarded,
      };
    });
  };

  const handleContinue = () => {
    if (!currentActivity || !pendingResult) return;
    const result = pendingResult;
    setPendingResult(null);
    applyResult(currentActivity, result);
  };

  const handleRespond = async (response: unknown) => {
    if (!currentActivity) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let result: LessonRespondResponse;

      if (isPreview) {
        // Deterministic in-memory preview evaluation (no database writes, fully isolated)
        result = evaluatePreviewActivityResponse(lesson, sessionData, currentActivity, response);
      } else {
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

        result = await res.json();
      }

      if (result.isSavedAndExited) {
        router.push("/learn");
        return;
      }

      const isServerGradedCheck =
        currentActivity.config.type === "independent_check" &&
        currentActivity.config.serverGraded === true;

      if (isServerGradedCheck && !isPreview) {
        // Show the server's verdict first; the next activity follows on Continue.
        setPendingResult(result);
      } else {
        applyResult(currentActivity, result);
      }
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
            {adaptive ? (
              <span data-testid="adaptive-step-label">STEP {adaptive.stepNumber}</span>
            ) : (
              <span>
                ACTIVITY {Math.min(currentActivityIndex + 1, lesson.activities.length)} OF{" "}
                {lesson.activities.length}
              </span>
            )}
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
            serverResult={
              pendingResult
                ? {
                    isCorrect: pendingResult.isCorrect === true,
                    feedback: pendingResult.feedback ?? "",
                  }
                : null
            }
            onContinue={handleContinue}
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
