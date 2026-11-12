"use client";

import { useState } from "react";
import { HealthResponseSchema, type HealthResponse } from "@gaps/contracts";
import messages from "@/messages/en.json";

interface HealthStatusCardProps {
  readonly initialHealth: HealthResponse;
}

export function HealthStatusCard({ initialHealth }: HealthStatusCardProps) {
  const [health, setHealth] = useState<HealthResponse>(initialHealth);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function refreshHealth(): Promise<void> {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/v1/health", { cache: "no-store" });
      const data: unknown = await response.json();
      const parsed = HealthResponseSchema.safeParse(data);
      if (parsed.success) {
        setHealth(parsed.data);
      } else {
        setFetchError(messages.health.statusLabels.error);
      }
    } catch {
      setFetchError(messages.health.statusLabels.error);
    } finally {
      setLoading(false);
    }
  }

  const isHealthy = health.status === "ok" && health.db === "ok";
  const statusText = fetchError
    ? fetchError
    : isHealthy
      ? messages.health.statusLabels.ok
      : messages.health.statusLabels.degraded;

  return (
    <section
      aria-labelledby="health-heading"
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="health-heading" className="text-lg font-extrabold text-[var(--ink)]">
            {messages.health.title}
          </h2>
          <p className="text-sm text-[var(--muted)]">{messages.health.endpointLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshHealth()}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] cursor-pointer rounded-[var(--radius-control)] bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--primary-ink)] disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? messages.health.checking : messages.health.refreshButton}
        </button>
      </div>

      <div aria-live="polite" className="mt-4">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
            isHealthy ? "bg-[#e7f5f3] text-[var(--teal)]" : "bg-[#fef4e4] text-[var(--primary-ink)]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${
              isHealthy ? "bg-[var(--teal)]" : "bg-[var(--accent)]"
            }`}
          />
          <span>{statusText}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <dt className="text-xs font-bold text-[var(--muted)]">
              {messages.health.fields.status}
            </dt>
            <dd className="tabular-nums mt-1 text-base font-extrabold text-[var(--ink)]">
              {health.status}
            </dd>
          </div>
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <dt className="text-xs font-bold text-[var(--muted)]">{messages.health.fields.db}</dt>
            <dd className="tabular-nums mt-1 text-base font-extrabold text-[var(--ink)]">
              {health.db}
            </dd>
          </div>
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <dt className="text-xs font-bold text-[var(--muted)]">{messages.health.fields.llm}</dt>
            <dd className="tabular-nums mt-1 text-base font-extrabold text-[var(--ink)]">
              {health.llm}
            </dd>
          </div>
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <dt className="text-xs font-bold text-[var(--muted)]">
              {messages.health.fields.version}
            </dt>
            <dd className="tabular-nums mt-1 text-base font-extrabold text-[var(--ink)]">
              {health.version}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
