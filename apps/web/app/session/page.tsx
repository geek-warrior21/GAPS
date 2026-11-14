"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LearningSessionDto, StartSessionResponse, StepDto } from "@gaps/contracts";
import type { ConceptId } from "@gaps/domain";
import { SessionPlayer } from "@/components/session/SessionPlayer";
import { Header } from "@/components/common/Header";

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conceptId = searchParams.get("conceptId") as ConceptId | null;
  const modeParam = (searchParams.get("mode") || "learn") as "learn" | "review";

  const [session, setSession] = useState<LearningSessionDto | null>(null);
  const [initialStep, setInitialStep] = useState<StepDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConsentPending, setIsConsentPending] = useState(false);

  useEffect(() => {
    async function startSession() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/v1/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: modeParam,
            focusConceptId: conceptId ?? undefined,
            budgetS: 900,
          }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          if (errData.error?.code === "CONSENT_REQUIRED") {
            setIsConsentPending(true);
            setIsLoading(false);
            return;
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Could not start learning session");
        }

        const data: StartSessionResponse = await res.json();
        setSession(data.session);
        setInitialStep(data.initialStep);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error starting session");
      } finally {
        setIsLoading(false);
      }
    }

    startSession();
  }, [router, conceptId, modeParam]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted">Preparing your personalised session…</p>
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
            <h2 className="text-2xl font-extrabold text-ink">Consent Needed</h2>
            <p className="text-sm text-text leading-relaxed">
              Your teacher is still setting things up for your account. Ask your teacher about
              returning your Gaps parent consent form!
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="w-full py-3 bg-surface-2 hover:bg-line text-ink font-bold rounded-xl text-sm transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !session || !initialStep) {
    return (
      <div className="min-h-screen bg-surface-2 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface rounded-3xl border border-line shadow-sm text-center space-y-4">
            <p className="text-sm font-bold text-ink">{error || "Unable to start session"}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="flex-1 py-2.5 bg-surface-2 hover:bg-line text-ink font-bold rounded-xl text-sm"
              >
                Go Home
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <SessionPlayer
          session={session}
          initialStep={initialStep}
          onSessionComplete={() => router.push("/home")}
          onExit={() => router.push("/home")}
        />
      </main>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
