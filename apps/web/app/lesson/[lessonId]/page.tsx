"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { LessonSessionResponse } from "@gaps/contracts";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.lessonId as string;
  const router = useRouter();

  const [sessionData, setSessionData] = useState<LessonSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;

    async function startLesson() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/lessons/${lessonId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Failed to load lesson session");
        }

        const data: LessonSessionResponse = await res.json();
        setSessionData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error initializing lesson");
      } finally {
        setIsLoading(false);
      }
    }

    startLesson();
  }, [lessonId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-ink">Preparing Interactive Lesson...</p>
          <p className="text-xs text-muted">Loading models, simulations, and challenges</p>
        </div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-surface rounded-3xl border border-line shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center text-xl mx-auto">
            ⚠️
          </div>
          <h2 className="text-lg font-extrabold text-ink">Lesson Could Not Load</h2>
          <p className="text-xs text-muted leading-relaxed font-medium">
            {error || "An error occurred while loading this lesson."}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Retry
            </button>
            <Link
              href="/learn"
              className="px-4 py-2 bg-surface-2 border border-line text-ink font-bold rounded-xl text-xs"
            >
              Back to Learn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <LessonPlayer initialData={sessionData} />;
}
