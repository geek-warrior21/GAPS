"use client";

import React, { useState } from "react";
import type {
  ItemViewDto,
  LearningSessionDto,
  RequestHelpResponse,
  RichTextDto,
  StepDto,
  SubmitAttemptResponse,
} from "@gaps/contracts";
import { RichTextViewer } from "../math/RichTextViewer";
import { AnswerPad } from "../math/AnswerPad";
import { VisualViewer } from "../visuals/VisualViewer";

interface SessionPlayerProps {
  session: LearningSessionDto;
  initialStep: StepDto;
  onSessionComplete?: () => void;
  onExit?: () => void;
}

export function SessionPlayer({
  session,
  initialStep,
  onSessionComplete,
  onExit,
}: SessionPlayerProps) {
  const [currentStep, setCurrentStep] = useState<StepDto>(initialStep);
  const [answerValue, setAnswerValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tryNo, setTryNo] = useState<1 | 2>(1);
  const [assistanceLevel, setAssistanceLevel] = useState<0 | 1 | 2 | 3>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<SubmitAttemptResponse["outcome"] | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sparksEarned, setSparksEarned] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Help drawer state
  const [activeHelp, setActiveHelp] = useState<{
    kind: "hint" | "explanation" | "worked_example";
    content: unknown;
  } | null>(null);
  const [isLoadingHelp, setIsLoadingHelp] = useState(false);
  const [currentRung, setCurrentRung] = useState(0);

  const handleAdvance = async () => {
    setIsAdvancing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/advance`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.step) {
          setCurrentStep(data.step);
        }
      } else {
        setFeedback("Failed to load next question. Please try again.");
      }
    } catch {
      setFeedback("Network error. Please check your connection.");
    } finally {
      setIsAdvancing(false);
    }
  };

  // Extract current item safely
  const item: ItemViewDto | null =
    currentStep.kind === "item"
      ? currentStep.item
      : currentStep.kind === "feedback_then_retry"
        ? currentStep.item
        : null;

  const handleSubmit = async () => {
    if (!item || !answerValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const clientAttemptId = crypto.randomUUID();
      const res = await fetch(`/api/v1/sessions/${session.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAttemptId,
          itemInstanceId: item.id,
          rawAnswer: answerValue.trim(),
          assistanceLevel,
          tryNo,
          latencyMs: 1500,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.error?.message || "Failed to submit answer. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const data: SubmitAttemptResponse = await res.json();
      setLastOutcome(data.outcome);
      setFeedback(data.feedback);

      if (data.sparksAwarded > 0) {
        setSparksEarned((prev) => prev + data.sparksAwarded);
      }

      if (data.tryAgain) {
        // First try was incorrect: student gets a second try
        setTryNo(2);
        // Clear input for second try
        setAnswerValue("");
      } else {
        // Resolved
        setTryNo(1);
        setAssistanceLevel(0);
        setActiveHelp(null);
        setCurrentRung(0);
        setAnswerValue("");

        if (data.sessionCompleted || !data.nextStep) {
          setSessionCompleted(true);
        } else {
          setCurrentStep(data.nextStep);
        }
      }
    } catch {
      setFeedback("Network error. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestHelp = async (
    kind: "hint" | "explanation" | "worked_example",
    options?: { rung?: 1 | 2 | 3; route?: "picture" | "everyday" | "steps" },
  ) => {
    if (!item || isLoadingHelp) return;

    setIsLoadingHelp(true);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          rung: options?.rung,
          route: options?.route,
        }),
      });

      if (res.ok) {
        const data: RequestHelpResponse = await res.json();
        setActiveHelp({ kind, content: data.content });
        setAssistanceLevel(
          (prev) => Math.max(prev, data.assistanceLevel as 0 | 1 | 2 | 3) as 0 | 1 | 2 | 3,
        );
        if (options?.rung) setCurrentRung(options.rung);
      }
    } catch {
      // Ignore network hiccup on help
    } finally {
      setIsLoadingHelp(false);
    }
  };

  if (sessionCompleted) {
    return (
      <div className="max-w-md mx-auto p-8 bg-surface rounded-3xl border border-line shadow-lg text-center space-y-6">
        <div className="w-16 h-16 bg-teal/15 text-teal text-3xl rounded-full flex items-center justify-center mx-auto shadow-xs">
          ✦
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-ink">Brilliant effort!</h2>
          <p className="text-muted text-sm mt-1">
            You completed your learning session and mastered real maths skills.
          </p>
        </div>

        <div className="p-4 bg-surface-2 rounded-2xl border border-line flex items-center justify-around tabular-nums">
          <div>
            <div className="text-2xl font-extrabold text-ink">5</div>
            <div className="text-xs font-bold text-muted">Steps completed</div>
          </div>
          <div className="w-px h-8 bg-line" />
          <div>
            <div className="text-2xl font-extrabold text-accent">+{sparksEarned}</div>
            <div className="text-xs font-bold text-muted">Sparks earned</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSessionComplete || onExit}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-base hover:bg-primary-ink transition-colors shadow-xs"
          >
            Return to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (currentStep.kind === "explanation") {
    const routeTitles: Record<string, string> = {
      picture: "Visual Model",
      steps: "Step-by-step Method",
      everyday: "Real-world Story",
      rephrase: "Another Way to Think About It",
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
                💡
              </span>
              <div>
                <h3 className="font-extrabold text-ink text-base">
                  Let&apos;s look at this together
                </h3>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  {routeTitles[currentStep.route] ?? "Concept Explanation"}
                </span>
              </div>
            </div>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕ Exit
              </button>
            )}
          </div>

          {currentStep.visual && (
            <div className="p-4 bg-surface-2 rounded-2xl border border-line flex justify-center">
              <VisualViewer visual={currentStep.visual} />
            </div>
          )}

          <div className="p-4 bg-surface-2/60 rounded-2xl text-ink text-base leading-relaxed">
            <RichTextViewer segments={currentStep.body} />
          </div>

          {feedback && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-semibold">
              {feedback}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={isAdvancing}
              onClick={handleAdvance}
              className="w-full py-4 bg-primary text-white font-extrabold rounded-2xl hover:bg-primary-ink active:scale-98 transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>{isAdvancing ? "Loading question…" : "I understand! Try a question →"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep.kind === "worked_example") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-teal/15 text-teal flex items-center justify-center font-bold text-sm">
                📝
              </span>
              <div>
                <h3 className="font-extrabold text-ink text-base">Worked Example</h3>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Follow along step-by-step
                </span>
              </div>
            </div>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕ Exit
              </button>
            )}
          </div>

          <div className="space-y-3">
            {currentStep.steps.map((stepSegments, idx) => (
              <div key={idx} className="p-3 bg-surface-2 rounded-xl text-ink text-sm flex gap-3">
                <span className="font-extrabold text-primary">{idx + 1}.</span>
                <div>
                  <RichTextViewer segments={stepSegments} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl text-ink text-sm font-bold flex items-center gap-2">
            <span>Result:</span>
            <RichTextViewer segments={currentStep.result} />
          </div>

          {feedback && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-semibold">
              {feedback}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={isAdvancing}
              onClick={handleAdvance}
              className="w-full py-4 bg-primary text-white font-extrabold rounded-2xl hover:bg-primary-ink active:scale-98 transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>{isAdvancing ? "Loading question…" : "Now try one yourself →"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return <div className="p-8 text-center text-muted">Loading next question…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top Session Header: Step Dots & Exit */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-3">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="text-muted hover:text-ink text-sm font-bold flex items-center gap-1"
            >
              ← Exit
            </button>
          )}
          <span className="text-xs font-extrabold text-muted uppercase tracking-wider">
            {session.mode} session
          </span>
        </div>

        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const stepNum = i + 1;
            const currentSeq = "stepSeq" in currentStep ? currentStep.stepSeq : 1;
            const isCurrent = stepNum === currentSeq;
            const isDone = stepNum < currentSeq;

            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  isCurrent
                    ? "bg-primary scale-125 ring-2 ring-primary/30"
                    : isDone
                      ? "bg-teal"
                      : "bg-line"
                }`}
                title={`Step ${stepNum}`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
        {/* Question Prompt */}
        <div className="text-lg font-bold text-ink leading-relaxed">
          <RichTextViewer segments={item.prompt} size="lg" />
        </div>

        {/* Visual Model (Fraction Bar, Number Line, Area Model) */}
        {item.visual && (
          <div className="pt-2">
            <VisualViewer visual={item.visual} />
          </div>
        )}
      </div>

      {/* Feedback Banner (Supportive "not yet", never "wrong" or "failed") */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            lastOutcome === "correct"
              ? "bg-teal/10 border-teal/40 text-teal-900"
              : "bg-accent/15 border-accent/40 text-ink"
          }`}
        >
          <span className="text-xl">{lastOutcome === "correct" ? "🎉" : "💡"}</span>
          <div className="text-sm font-bold flex-1">{feedback}</div>
        </div>
      )}

      {/* Help / Teaching Support Drawer */}
      {activeHelp && (
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span>
              {activeHelp.kind === "hint"
                ? `Hint Rung ${currentRung}`
                : activeHelp.kind === "explanation"
                  ? "Explanation"
                  : "Worked Example"}
            </span>
            <button
              type="button"
              onClick={() => setActiveHelp(null)}
              className="text-muted hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="text-sm text-ink leading-relaxed font-medium">
            {Array.isArray(activeHelp.content) ? (
              <RichTextViewer segments={activeHelp.content as RichTextDto} />
            ) : typeof activeHelp.content === "object" &&
              activeHelp.content !== null &&
              "steps" in activeHelp.content ? (
              <div className="space-y-1.5">
                {(activeHelp.content as { steps: RichTextDto[] }).steps.map((st, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-bold text-primary">{i + 1}.</span>
                    <RichTextViewer segments={st} />
                  </div>
                ))}
              </div>
            ) : (
              <span>{JSON.stringify(activeHelp.content)}</span>
            )}
          </div>
        </div>
      )}

      {/* Interactive AnswerPad */}
      <div className="pt-1">
        <AnswerPad
          inputSpec={item.input}
          value={answerValue}
          onChange={setAnswerValue}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* Teaching Support Buttons: Hint Ladder, Worked Example, Explanations */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-line">
        <button
          type="button"
          disabled={isLoadingHelp}
          onClick={() => handleRequestHelp("hint", { rung: ((currentRung % 3) + 1) as 1 | 2 | 3 })}
          className="px-3.5 py-1.5 bg-surface hover:bg-surface-2 active:bg-line border border-line rounded-xl text-xs font-bold text-primary flex items-center gap-1.5 shadow-2xs"
        >
          <span>💡</span>
          <span>
            {currentRung === 0 ? "Need a hint?" : `Next hint (${(currentRung % 3) + 1}/3)`}
          </span>
        </button>

        <button
          type="button"
          disabled={isLoadingHelp}
          onClick={() => handleRequestHelp("worked_example")}
          className="px-3.5 py-1.5 bg-surface hover:bg-surface-2 active:bg-line border border-line rounded-xl text-xs font-bold text-primary flex items-center gap-1.5 shadow-2xs"
        >
          <span>📖</span>
          <span>Worked example</span>
        </button>

        <button
          type="button"
          disabled={isLoadingHelp}
          onClick={() => handleRequestHelp("explanation", { route: "picture" })}
          className="px-3.5 py-1.5 bg-surface hover:bg-surface-2 active:bg-line border border-line rounded-xl text-xs font-bold text-primary flex items-center gap-1.5 shadow-2xs"
        >
          <span>🖼️</span>
          <span>Explain with pictures</span>
        </button>
      </div>
    </div>
  );
}
