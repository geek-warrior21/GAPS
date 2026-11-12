# AGENTS.md — Gaps V0.1

You are building Gaps V0.1, an adaptive maths learning web app for Class 6–8 students
in Indian pilot schools. The full specification is docs/SPEC.md. Read all of it first.
Spec precedence when sections disagree:
  invariants + safety (§10, §12)  >  build specs (§14–27)  >  design (§7–13)  >  narrative (§1–6)

## Commands (phased commit gates)
Every commit requires `pnpm verify` and all checks applicable to implemented functionality:
- Phase 0 onward: `pnpm install`, `pnpm verify` (typecheck, lint, format:check, tests, build), `pnpm db:up` + real PostgreSQL health check (`GET /api/v1/health` 200 `db: "ok"`).
- Phase 2 onward: `pnpm content:check` becomes mandatory inside `pnpm verify`.
- Phase 3 onward: `pnpm db:migrate && pnpm db:seed` checks become mandatory.
- Phase 6 onward: `pnpm test:e2e` (mobile and desktop Playwright) checks become mandatory.
- Add meaningful tests alongside earlier functionality when applicable. Unimplemented checks must remain explicitly unavailable (exit non-zero), never return a fake pass. No safety invariant or final release requirement is waived.

pnpm install
pnpm db:up                      # Postgres 16 via docker compose
pnpm db:migrate && pnpm db:seed # Phase 3 onward
pnpm verify                     # typecheck + lint + format:check + tests + build (+ content:check from Phase 2)
pnpm test:e2e                   # Phase 6 onward: Playwright, mobile + desktop projects

## Repository map
apps/web             Next.js app: UI (app/), API route handlers (app/api/v1/), server modules (server/)
packages/domain      Pure TS: Rational, parser, verifier, belief reducer, L1/L2/L3 policy, sparks. No I/O.
packages/content     Concepts, edges, chapters, misconceptions, templates, explanations + content:check
packages/db          Drizzle schema, migrations, seed, principal-scoped repositories
packages/ai          LLM provider interface, openai/mock/disabled providers, prompts, guards, PII scrubber
packages/contracts   Zod schemas for every API request/response, shared by server and client
docs/                SPEC.md, BUILD_PLAN.md, BUILD_LOG.md, RUNBOOK.md, THREAT_MODEL.md

## Non-negotiables
1. Beliefs change only via the belief reducer in packages/domain over stored evidence.
2. Never grade with floating point: use Rational (BigInt). Never use eval or new Function.
3. Assisted attempts, AI output, boss results and clicks never promote mastery.
4. Every retryable write is idempotent (unique clientAttemptId per session; unique (sourceId, kind) for Sparks).
5. Every DB access in a request is scoped by the authenticated principal. Each new endpoint gets an
   authorization test for every role.
6. No personal data to any model. Only packages/ai calls models, only through the AI gateway, only when
   the student's ai_free_text scope, the class flag, AI_ZDR_CONFIRMED and the kill switch all allow it.
7. The app must work end to end with LLM_PROVIDER=disabled. Every AI feature has a pre-authored fallback.
8. Never send correct answers or misconception answers to the client before an item is resolved.
9. Student copy says "not yet", never "wrong" or "failed". No ranking, no streak loss, no timers.
10. In production, serve only templates with review.status === "reviewed".
11. Build only what the spec asks for. No extra features, routes or dependencies without a logged reason.

## Conventions
- TypeScript strict; no `any` (use unknown + Zod). ESM, named exports, small pure functions in domain.
- Validate every input at the boundary with packages/contracts schemas.
- Errors: { "error": { "code": "...", "message": "..." } } with the right HTTP status; no stack traces.
- IDs: prefixed ULIDs (usr_, stu_, coh_, ses_, att_, evt_, dec_, itm_, qst_, bos_, slv_, flg_).
- Time: store UTC timestamptz. "Today" for quests and weekly rhythm uses Asia/Kolkata.
- Logging: structured JSON through apps/web/server/log.ts. Never log PINs, passwords, tokens,
  TOTP secrets or student free text.
- UI strings live in apps/web/messages/en.json.
- Tests sit next to code (*.test.ts). packages/domain needs >= 90% line coverage.

## Workflow
- Follow SPEC §24 phase by phase. At each phase end: run the exit checks, commit
  "phase N: <summary>", and append to docs/BUILD_LOG.md: built / checks + results / assumptions / follow-ups.
- When the spec is silent, choose the simplest option consistent with it and log it under Assumptions.
  Do not stop to ask.
- Stop and report only if: a check still fails after 3 genuine attempts; two sections conflict beyond the
  precedence rule; or a change would weaken a non-negotiable.
- Never weaken, skip or delete a test to make a check pass.
