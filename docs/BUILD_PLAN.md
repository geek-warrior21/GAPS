# Gaps V0.1 Build Plan (Phases 0–9)

Baseline: `docs/SPEC.md` (copied from `GAPS_V0.1_SPEC.md`) and `AGENTS.md`. Precedence: `§10, §12 > §14–27 > §7–13 > §1–6`.
Commit gates (CEO/CTO clarification): every commit requires `pnpm verify` and all checks applicable to implemented functionality (`Phase 0+`: install, typecheck, lint, tests, build, real Postgres health check; `Phase 2+`: `content:check` inside `pnpm verify`; `Phase 3+`: `db:migrate` & `db:seed`; `Phase 6+`: mobile + desktop Playwright `test:e2e`). Unimplemented checks remain explicitly unavailable (never fake passes), meaningful tests are added alongside earlier work, and no safety invariant or release gate is waived. AI stays `LLM_PROVIDER=disabled` by default.

## Phase 0 — Scaffold

- **Files:** `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.node-version`, `.npmrc`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `.env.example`, `docker-compose.yml`, `vitest.config.ts`, `CLAUDE.md`, `docs/{SPEC.md,BUILD_PLAN.md,BUILD_LOG.md}`, workspace scaffolds in `packages/{contracts,domain,content,db,ai}`, and `apps/web/{next.config.ts,postcss.config.mjs,messages/en.json,server/log.ts,server/env.ts,app/globals.css,app/layout.tsx,app/page.tsx,app/api/v1/health/route.ts}`.
- **Exit checks:** `pnpm install`, `pnpm verify` (typecheck, lint, format:check, unit tests, Next.js standalone build), `pnpm db:up`, and `GET /api/v1/health` returning `200` with `db: "ok"`, `llm: "disabled"`.

## Phase 1 — Domain Core (`packages/domain`, no I/O)

- **Files:** `packages/domain/src/{rational.ts,parse.ts,verify.ts,misconceptions.ts,belief.ts,quickcheck.ts,sparks.ts,comeback.ts,rng.ts,ids.ts}`, `policy/{l1.ts,l2.ts,l3.ts}`, and colocated `*.test.ts` (including 40 golden L3 decision scenarios and fast-check property tests); `packages/contracts/src/{step.ts,domain.ts}`.
- **Exit checks:** `pnpm verify`; Vitest unit + property tests covering Rational field laws, ≥ 60 parser inputs, every verifier kind/form, belief transitions/demotions/7-day retention boundary, and 40 golden L3 scenarios; `packages/domain` line coverage ≥ 90%.

## Phase 2 — Curated Content (`packages/content`)

- **Files:** `packages/content/src/{chapters.ts,concepts.ts,edges.ts,misconceptions.ts,check.ts,preview.ts}`, `explanations/<conceptId>.ts` (14 concepts × 3 routes ≤ 90 words), and `templates/<conceptId>/*.ts` (≥ 40 templates, difficulty 1–3, ≥ 3 per concept except 2 for `NUM-HCF`/`NUM-LCM`, all `review.status: "draft"` until educator sign-off).
- **Exit checks:** `pnpm verify`; `pnpm content:check` passes 500 seeds/template (≥ 20 distinct items, no answer/misconception collision, hint leak check, reading level ≤ 14 words/sentence, acyclic DAG); `pnpm content:preview` works. **Human checkpoint:** Education lead previews 20 items, hints, and explanations.

## Phase 3 — Data Layer (`packages/db`)

- **Files:** `packages/db/src/{schema.ts,client.ts,seed.ts,demo-seed.ts,replay.ts}`, `migrations/`, and principal-scoped repositories in `packages/db/src/repos/{student.ts,teacher.ts,content.ts,admin.ts}` (unscoped queries isolated to `admin.ts`).
- **Exit checks:** `pnpm verify`; `pnpm db:reset && pnpm db:migrate && pnpm db:seed` from empty Postgres; second `pnpm db:seed` is idempotent; replay test rebuilds `concept_beliefs` from `attempts` and matches stored rows.

## Phase 4 — Identity, Roles & Consent

- **Files:** `packages/contracts/src/{auth.ts,admin.ts}`, `apps/web/server/auth/{session.ts,password.ts,totp.ts,guard.ts,origin.ts}`, `apps/web/app/api/v1/auth/*`, `apps/web/app/api/v1/me/route.ts`, `apps/web/app/api/v1/admin/{orgs,cohorts,consents,students}/*`, and auth UI pages `(auth)/{login,staff-login}`.
- **Exit checks:** `pnpm verify`; role × endpoint authorization matrix tests (404 on cross-principal IDs), PIN brute-force 10-attempt lockout (423), Origin CSRF check, `pending_consent` gating, and immediate consent revocation enforcement.

## Phase 5 — Learning Engine & APIs

- **Files:** `packages/contracts/src/{session.ts,play.ts,gapmap.ts}`, `apps/web/server/{guard/policy-guard.ts,session-engine/*,services/{quest,boss,sparks,comeback,review}.ts,read-models/*,jobs/scheduler.ts}`, and route handlers for `/home`, `/quick-check`, `/concepts`, `/gapmap`, `/sessions/*`, `/quests/*`, `/bosses/*`, `/comeback-cards/*`, `/profile`.
- **Exit checks:** `pnpm verify`; API integration tests for S1–S6, S9–S16; ItemView redaction test (I9: no answers/seeds pre-resolution); 10× parallel `clientAttemptId` idempotency test; stale `stepSeq` 409 test; transactional rollback test.

## Phase 6 — Student UI & PWA

- **Files:** `apps/web/app/(student)/{home,learn,learn/[conceptId],play,play/quest,play/boss/[chapterId],gapmap,solve,profile,session/[sessionId]}/page.tsx`, `components/{ui/*,math/{Frac,AnswerPad,MathText}.tsx,visuals/{FractionBar,NumberLine,AreaModel}.tsx,gapmap/GapMapSvg.tsx,game/*}`, `app/manifest.ts`, `public/sw.js` (app-shell cache only), and `apps/web/e2e/student.spec.ts`.
- **Exit checks:** `pnpm verify`; Playwright E2E for ★ scenarios (S1, S2, S4, S12, S16) on mobile (390×844) & desktop (1280×800); `@axe-core/playwright` zero serious/critical violations; Lighthouse mobile ≥ 85 on lesson page. **Human checkpoint:** Full phone first-session walkthrough.

## Phase 7 — AI Features (`packages/ai` & Solve With Me)

- **Files:** `packages/ai/src/{provider.ts,openai.ts,mock.ts,disabled.ts,gateway.ts,guard.ts,scrub.ts,budget.ts,prompts/{explain.ts,solve-parse.ts,solve-turn.ts}}`, `apps/web/app/api/v1/solve/*`, `apps/web/server/services/solve.ts`, and `apps/web/e2e/solve.spec.ts`.
- **Exit checks:** `pnpm verify`; mock-provider fault suite (`leaks_answer`, `timeout`, `invalid_json`, `refused`, `moderation_flagged`, `off_topic`, `too_long`); PII scrub capture assertion (I5); S7/S8 tests (zero model calls without `ai_free_text` + `AI_ZDR_CONFIRMED` + class flag + kill switch off); full E2E green with `LLM_PROVIDER=disabled`.

## Phase 8 — Adult Surfaces (Teacher & Staff Console)

- **Files:** `apps/web/app/(teacher)/teacher/{classes/[cohortId],flags}/page.tsx`, `(staff)/console/{page.tsx,schools,cohorts/[id],cohorts/[id]/cards,consents,flags,metrics,content,settings}`, `app/api/v1/teacher/*`, `app/api/v1/admin/{feature-flags,metrics,export,flags,content}/*`, erasure job, and `apps/web/e2e/adult.spec.ts`.
- **Exit checks:** `pnpm verify`; E2E roster import → A4 login cards → student session → teacher Class Overview & CSV export; hard-deletion cascade test (S15) with content-free audit row; `research_use`-only export test; metrics fixture test.

## Phase 9 — Hardening, Ops & Release Readiness

- **Files:** `Dockerfile`, `Caddyfile`, `scripts/{load-test.ts,backup.sh,restore.sh}`, `docs/{RUNBOOK.md,THREAT_MODEL.md}`, updated `README.md`, rate-limit & security header hardening, and fault-injection tests.
- **Exit checks:** `pnpm verify && pnpm test:e2e && pnpm content:check` all green; `pnpm load-test --users 50` shows deterministic loop p95 ≤ 800 ms; backup/restore drill passes into fresh DB; `PRODUCTION` serves only `review.status === "reviewed"`. **Human checkpoint:** Acceptance suite & release gates G1–G6 review.
