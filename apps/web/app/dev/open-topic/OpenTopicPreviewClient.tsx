"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LessonSessionResponse, OpenLessonResponse } from "@gaps/contracts";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import type { PreviewTrace, ProviderReadiness } from "@/server/open-topic/dev-preview";

const API = "/api/v1/dev/open-topic";
// Example topics only: each is a plain string typed into the same box.
const EXAMPLES = ["photosynthesis", "states of matter", "negative numbers"];

export function OpenTopicPreviewClient({ initialLessonId }: { initialLessonId: string | null }) {
  const router = useRouter();
  const [readiness, setReadiness] = useState<ProviderReadiness | null>(null);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clarify, setClarify] = useState<{ question: string; options: string[] } | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(initialLessonId);
  const [session, setSession] = useState<LessonSessionResponse | null>(null);
  const [trace, setTrace] = useState<PreviewTrace | null>(null);
  // Remounts the player after the stored lesson changes underneath it.
  const [playerVersion, setPlayerVersion] = useState(0);

  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ProviderReadiness | null) => setReadiness(json))
      .catch(() => setReadiness(null));
  }, []);

  const loadTrace = useCallback(async (id: string) => {
    const res = await fetch(`${API}/${id}/trace`);
    if (res.ok) setTrace((await res.json()) as PreviewTrace);
  }, []);

  const loadLesson = useCallback(
    async (id: string) => {
      const res = await fetch(`${API}/${id}/start`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNotice(body.error?.message ?? "This stored lesson could not be loaded.");
        setSession(null);
        return;
      }
      setSession((await res.json()) as LessonSessionResponse);
      setPlayerVersion((v) => v + 1);
      await loadTrace(id);
    },
    [loadTrace],
  );

  // Refresh-safe: the lesson id lives in the URL and the lesson is stored on the server.
  useEffect(() => {
    if (!initialLessonId) return;
    async function resume(id: string) {
      await loadLesson(id);
    }
    void resume(initialLessonId);
  }, [initialLessonId, loadLesson]);

  const start = async (clarification?: string) => {
    if (topic.trim().length < 2 || busy) return;
    setBusy("start");
    setNotice(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, ...(clarification ? { clarification } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(body.error?.message ?? "The lesson could not be started.");
        return;
      }
      const result = body as OpenLessonResponse;
      if (result.status === "needs_clarification") {
        setClarify({ question: result.question, options: result.options });
        return;
      }
      setClarify(null);
      if (result.status === "unavailable") {
        setNotice(`${result.message}${result.retryable ? " You can try again." : ""}`);
        return;
      }
      if (!result.lessonId.startsWith("open-")) {
        setNotice(
          `An authored lesson already covers this topic (${result.lessonId}), so nothing is generated for it.`,
        );
        return;
      }
      setLessonId(result.lessonId);
      router.replace(`/dev/open-topic?lesson=${result.lessonId}`);
      await loadLesson(result.lessonId);
    } finally {
      setBusy(null);
    }
  };

  const autoplay = async (profile: "succeeding" | "struggling") => {
    if (!lessonId || busy) return;
    setBusy(profile);
    setNotice(null);
    try {
      const res = await fetch(`${API}/${lessonId}/autoplay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(body.error?.message ?? "Auto-play could not run.");
        return;
      }
      setNotice(`Synthetic ${profile} learner stopped: ${body.stoppedBecause}.`);
      await loadLesson(lessonId);
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setLessonId(null);
    setSession(null);
    setTrace(null);
    setNotice(null);
    router.replace("/dev/open-topic");
  };

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <span className="px-2.5 py-1 rounded-full bg-purple-600 text-white text-2xs font-black uppercase tracking-wider">
            Developer preview
          </span>
          <h1 className="text-2xl font-extrabold text-ink">Open-topic teaching</h1>
          <p className="text-sm text-muted font-medium max-w-3xl">
            Runs a lesson on any Class 6–8 maths or science topic as a synthetic learner. No student
            account or student data is involved. Lessons here are generated previews: practice only,
            unreviewed, and never evidence of mastery.
          </p>
        </header>

        <div
          data-testid="provider-readiness"
          className={`p-4 rounded-2xl border text-sm font-bold ${
            readiness?.ready && !readiness.isMock
              ? "bg-teal-500/10 border-teal-500/30 text-teal-950"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950"
          }`}
        >
          {!readiness
            ? "Checking the model provider…"
            : !readiness.ready
              ? `Live generation is not available. Missing: ${readiness.missing.join(", ")}.`
              : readiness.isMock
                ? "MOCK provider in use. This checks the wiring only and is not a demonstration of a real model."
                : `Live provider ready: ${readiness.provider}, model ${readiness.model}.`}
        </div>

        <section className="p-6 bg-surface rounded-3xl border border-line space-y-4">
          <form
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setClarify(null);
              void start();
            }}
          >
            <label className="flex-1 space-y-1">
              <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
                Topic
              </span>
              <input
                type="text"
                data-testid="preview-topic-input"
                value={topic}
                maxLength={120}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Any school maths or science topic"
                className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink font-bold text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
                Class
              </span>
              <select
                data-testid="preview-level"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink font-bold text-sm"
              >
                {[6, 7, 8].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              data-testid="preview-start"
              disabled={busy !== null || topic.trim().length < 2}
              className="px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold cursor-pointer disabled:opacity-40"
            >
              {busy === "start" ? "Generating…" : "Start new lesson"}
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-2xs font-bold text-muted">
            <span>Examples:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setTopic(example)}
                className="px-2.5 py-1 rounded-lg bg-surface-2 border border-line text-ink cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>

          {clarify && (
            <div data-testid="preview-clarify" className="p-4 bg-surface-2 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-ink">{clarify.question}</p>
              <div className="flex flex-wrap gap-2">
                {clarify.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void start(option)}
                    className="px-4 py-2 bg-surface border border-line rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
          {notice && (
            <div
              data-testid="preview-notice"
              role="status"
              className="p-3 bg-surface-2 border border-line rounded-xl text-xs font-bold text-ink"
            >
              {notice}
            </div>
          )}
        </section>

        {lessonId && (
          <section className="p-4 bg-surface rounded-3xl border border-line flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-muted" data-testid="preview-lesson-id">
              Stored lesson: {lessonId}
            </span>
            <button
              type="button"
              data-testid="autoplay-succeeding"
              disabled={busy !== null}
              onClick={() => void autoplay("succeeding")}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {busy === "succeeding" ? "Playing…" : "Auto-play succeeding learner"}
            </button>
            <button
              type="button"
              data-testid="autoplay-struggling"
              disabled={busy !== null}
              onClick={() => void autoplay("struggling")}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {busy === "struggling" ? "Playing…" : "Auto-play struggling learner"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 bg-surface-2 border border-line rounded-xl text-xs font-bold cursor-pointer"
            >
              Close lesson
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div
            data-testid="preview-player"
            className="rounded-3xl overflow-hidden border border-line"
          >
            {session && lessonId ? (
              <LessonPlayer
                key={`${lessonId}-${playerVersion}`}
                initialData={session}
                endpointBase={API}
                exitHref="/dev/open-topic"
                onProgress={() => void loadTrace(lessonId)}
              />
            ) : (
              <p className="p-8 text-sm text-muted font-medium bg-surface">
                Start a lesson to play it here as the synthetic learner.
              </p>
            )}
          </div>

          <aside
            data-testid="preview-trace"
            className="p-6 bg-surface rounded-3xl border border-line space-y-4"
          >
            <h2 className="text-base font-extrabold text-ink">Decision trace</h2>
            {!trace ? (
              <p className="text-sm text-muted font-medium">No lesson loaded.</p>
            ) : (
              <>
                <dl className="text-xs text-ink space-y-1">
                  <div>
                    <dt className="inline font-extrabold">Lesson: </dt>
                    <dd className="inline">
                      {trace.title} (Class {trace.level})
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-extrabold">Learning goal: </dt>
                    <dd className="inline">{trace.learningGoal}</dd>
                  </div>
                  <div data-testid="trace-content-basis">
                    <dt className="inline font-extrabold">Content basis: </dt>
                    <dd className="inline">
                      {trace.contentStatus.basis}; sources supplied:{" "}
                      {trace.contentStatus.sources.map((s) => s.title).join("; ") || "none"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-extrabold">Generated by: </dt>
                    <dd className="inline">
                      {trace.generator.provider} / {trace.generator.model}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-extrabold">
                      Proposed by the model (not verified):{" "}
                    </dt>
                    <dd className="inline">
                      prerequisites: {trace.modelProposed.prerequisites.join("; ") || "none"}.
                      Suspected misconceptions:{" "}
                      {trace.modelProposed.misconceptions.join("; ") || "none"}.
                    </dd>
                  </div>
                  {trace.awaitingNextStep && (
                    <div className="font-extrabold text-amber-900">
                      Waiting: the next step could not be prepared. Use Try again in the player.
                    </div>
                  )}
                </dl>
                <ol className="space-y-2">
                  {trace.steps.map((step) => (
                    <li
                      key={step.seq}
                      data-testid={`open-trace-step-${step.seq}`}
                      className="p-3 rounded-xl border border-line bg-surface-2/60 text-xs space-y-1"
                    >
                      <div className="font-extrabold text-ink">
                        {step.seq}. {step.action} / {step.role} / {step.origin}: {step.title}
                      </div>
                      <div className="text-muted">
                        Envelope: {step.eligibleActions.join(", ")}
                        {step.lessonStage ? ` · stage: ${step.lessonStage}` : ""}
                      </div>
                      {step.question && (
                        <div>
                          Question: {step.question} Key: {step.answerKey} (
                          {step.answerVerification ?? "n/a"}
                          {step.assistance ? `, ${step.assistance} practice` : ""})
                        </div>
                      )}
                      {step.idealInteraction && (
                        <div>Ideal interaction not available: {step.idealInteraction}</div>
                      )}
                      {step.modelRationale && (
                        <div className="text-muted">Model rationale: {step.modelRationale}</div>
                      )}
                      {step.isCorrect !== null && (
                        <div className="font-bold">
                          Learner answered {step.learnerAnswer}:{" "}
                          {step.isCorrect ? "correct" : "not yet"} (practice feedback, not evidence)
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
