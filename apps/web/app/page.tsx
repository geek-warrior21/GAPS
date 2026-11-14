import { HealthStatusCard } from "@/components/HealthStatusCard";
import messages from "@/messages/en.json";
import { getHealthSnapshot } from "@/server/health";

export const dynamic = "force-dynamic";

type GapStateKey = "not_assessed" | "needs_support" | "developing" | "demonstrated" | "retained";

const STATE_STYLES: Record<GapStateKey, { swatchClass: string; badge: string }> = {
  not_assessed: {
    swatchClass: "border-2 border-dashed border-[#a9b4c2] bg-white text-[#5b6c80]",
    badge: "○",
  },
  needs_support: {
    swatchClass: "bg-[#f2a93b] text-[#152743]",
    badge: "◔",
  },
  developing: {
    swatchClass: "bg-[#8db8f0] text-[#152743]",
    badge: "◑",
  },
  demonstrated: {
    swatchClass: "bg-[#285bad] text-white",
    badge: "●",
  },
  retained: {
    swatchClass: "bg-[#248c7f] text-white",
    badge: "★",
  },
};

export default async function HomePage() {
  const healthSnapshot = await getHealthSnapshot();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-[#e8f0fb] px-3 py-1 text-xs font-extrabold text-[var(--primary-ink)]">
            {messages.phaseBanner.badge}
          </span>
          <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            LLM_PROVIDER={healthSnapshot.body.llm}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
          {messages.appName}
        </h1>
        <p className="mt-1 text-base font-bold text-[var(--primary)]">
          {messages.phaseBanner.title}
        </p>
        <p className="mt-2 text-base text-[var(--text)]">{messages.tagline}</p>
        <p className="mt-3 text-sm text-[var(--muted)]">{messages.phaseBanner.description}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/login"
            className="px-5 py-3 rounded-xl bg-primary text-white font-extrabold text-sm hover:bg-primary-ink active:scale-98 transition-all shadow-sm"
          >
            Launch Student Portal (Login) →
          </a>
          <a
            href="/home"
            className="px-5 py-3 rounded-xl bg-surface-2 border border-line text-ink font-bold text-sm hover:bg-line active:scale-98 transition-all"
          >
            Open Dashboard →
          </a>
        </div>
      </header>

      <HealthStatusCard initialHealth={healthSnapshot.body} />

      <section
        aria-labelledby="tokens-heading"
        className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
      >
        <h2 id="tokens-heading" className="text-lg font-extrabold text-[var(--ink)]">
          {messages.tokens.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{messages.tokens.description}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {messages.tokens.states.map((state) => {
            const key = state.key as GapStateKey;
            const style = STATE_STYLES[key];
            return (
              <li
                key={state.key}
                className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${style.swatchClass}`}
                >
                  {style.badge}
                </span>
                <div>
                  <div className="text-sm font-extrabold text-[var(--ink)]">{state.label}</div>
                  <div className="text-xs text-[var(--muted)]">{state.detail}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="guardrails-heading"
        className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
      >
        <h2 id="guardrails-heading" className="text-lg font-extrabold text-[var(--ink)]">
          {messages.guardrails.title}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--text)]">
          {messages.guardrails.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
