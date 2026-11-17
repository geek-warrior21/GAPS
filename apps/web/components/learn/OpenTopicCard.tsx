"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenLessonResponse } from "@gaps/contracts";
import messages from "@/messages/en.json";

const t = messages.openTopic;
const LEVELS = [6, 7, 8] as const;

/**
 * Entry point for learning a topic in the learner's own words. The server
 * decides what happens: an authored lesson, a generated preview, one
 * clarification question, or a plain reason it cannot start.
 */
export function OpenTopicCard() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(6);
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState<{ text: string; retryable: boolean } | null>(null);
  const [clarify, setClarify] = useState<{ question: string; options: string[] } | null>(null);

  const start = async (clarification?: string) => {
    if (topic.trim().length < 2 || isStarting) return;
    setIsStarting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/open-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, ...(clarification ? { clarification } : {}) }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage({ text: body.error?.message || t.genericError, retryable: false });
        return;
      }
      const result: OpenLessonResponse = await res.json();
      if (result.status === "ready") {
        router.push(`/lesson/${result.lessonId}`);
        return;
      }
      if (result.status === "needs_clarification") {
        setClarify({ question: result.question, options: result.options });
        return;
      }
      setClarify(null);
      setMessage({ text: result.message, retryable: result.retryable });
    } catch {
      setMessage({ text: t.genericError, retryable: true });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section
      data-testid="open-topic-card"
      className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-extrabold text-ink">{t.heading}</h2>
        <p className="text-xs sm:text-sm text-muted font-medium">{t.description}</p>
      </div>

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
            {t.topicLabel}
          </span>
          <input
            type="text"
            data-testid="open-topic-input"
            value={topic}
            maxLength={120}
            onChange={(e) => {
              setTopic(e.target.value);
              setClarify(null);
            }}
            placeholder={t.topicPlaceholder}
            className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink font-bold text-sm focus:outline-hidden focus:border-primary"
          />
        </label>
        <label className="space-y-1">
          <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
            {t.levelLabel}
          </span>
          <select
            data-testid="open-topic-level"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value) as (typeof LEVELS)[number])}
            className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink font-bold text-sm"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          data-testid="open-topic-start"
          disabled={isStarting || topic.trim().length < 2}
          className="px-6 py-3 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
        >
          {isStarting ? t.starting : t.start}
        </button>
      </form>

      {clarify && (
        <div
          data-testid="open-topic-clarify"
          className="p-4 bg-surface-2/60 rounded-2xl border border-line space-y-3"
        >
          <div className="text-2xs font-extrabold text-muted uppercase tracking-wider">
            {t.clarifyHeading}
          </div>
          <p className="text-sm font-bold text-ink">{clarify.question}</p>
          <div className="flex flex-wrap gap-2">
            {clarify.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={isStarting}
                onClick={() => void start(option)}
                className="px-4 py-2 bg-surface hover:bg-surface-2 text-ink border border-line rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div
          data-testid="open-topic-message"
          role="status"
          className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-950 rounded-2xl text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3"
        >
          <span>{message.text}</span>
          {message.retryable && (
            <button
              type="button"
              disabled={isStarting}
              onClick={() => void start()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {t.retry}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
