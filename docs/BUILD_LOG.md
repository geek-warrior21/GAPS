# Gaps V0.1 Build Log

## Phase 0 — Planning & Scaffold (2026-11-12)

### 1. Environment Inspection & Tooling Resolution

- Workspace initially contained `.git` (`main`, `1b7e8cf`), `README.md`, `AGENTS.md`, `GAPS_V0.1_SPEC.md`, and `Gaps_MVP_V0.1_Product_Spec_and_Build_Handbook.docx`.
- Initial host check: `node v26.7.0` (global default), `npm 11.19.0`, `git`, `brew`. Missing at start: `pnpm`, `docker`, `docker compose`, `psql`, and Node 22.x.
- **Node 22.x pin (project-only):** Added `.nvmrc` (`22.23.5`), `.node-version` (`22.23.5`), `.npmrc` (`engine-strict=true`), `package.json` `"engines": { "node": "^22.0.0", "pnpm": ">=10.0.0" }`, and `"devEngines.runtime"` (`node 22.23.5` via `pnpm runtime set -D -y node 22`). `pnpm exec node -v` runs `v22.23.5`; host global `node -v` remains `v26.7.0` untouched.
- **pnpm:** Installed `pnpm@12.18.0` globally via `npm install -g pnpm`.
- **Docker / Compose (macOS):** Installed `docker@29.9.3`, `docker-compose@5.7.1`, `colima@0.10.3` (with `lima@2.3.0`) via Homebrew, configured `~/.docker/config.json` `cliPluginsExtraDirs` to `/opt/homebrew/lib/docker/cli-plugins`, and booted `colima start` (`vz` driver). First `colima start` attempt stalled at 70% image download and was cancelled; second `colima start --verbose` resumed from cache and completed (`INFO[0312] done`).

### 2. Built

- **Docs & Rules:** Copied `GAPS_V0.1_SPEC.md` verbatim to `docs/SPEC.md` (keeping `GAPS_V0.1_SPEC.md` intact) and `AGENTS.md` to `CLAUDE.md`; wrote `docs/BUILD_PLAN.md` (Phases 0–9, under two pages) and `docs/BUILD_LOG.md`.
- **Monorepo & Tooling:** `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.node-version`, `.npmrc`, `tsconfig.base.json` (TypeScript 5.9.3 strict + `noUncheckedIndexedAccess`), `eslint.config.mjs` (ESLint 9 + `@typescript-eslint/no-explicit-any: "error"` + `no-console: "error"`), `.prettierrc`, `.prettierignore`, `.gitignore`, `.env.example`, `docker-compose.yml` (Postgres 16 with `pg_isready` healthcheck), `vitest.config.ts`.
- **Root Environment Loading:** Added `loadRootEnv()` / `parseEnvContent()` in `packages/db/src/env.ts` (precedence: shell env > root `.env.local` > root `.env`) wired into `packages/db` (`getSqlClient`, `checkDatabaseHealth`), `apps/web/next.config.ts`, and `apps/web/server/health.ts` so `DATABASE_URL` and flags in root `.env.local` work regardless of workspace package CWD.
- **Packages (Phase 0 scaffolds):**
  - `packages/contracts`: `ErrorResponseSchema` and `HealthResponseSchema` (Zod v4) + unit tests.
  - `packages/domain`: pure TS placeholder exporting `POLICY_VERSION="rules-1.0"` and `VERIFIER_VERSION="verify-1.0"` + unit test (no Phase 1 domain logic).
  - `packages/content`: Phase 0 scaffold (`CONTENT_SCAFFOLD_PHASE=0`); `content:check` and `content:preview` exit `1` as Phase 2 deliverables (no no-op pass).
  - `packages/db`: `getSqlClient()`, `closeSqlClients()`, `checkDatabaseHealth()` (`SELECT 1` via `postgres`), `loadRootEnv()` + unit tests; `db:migrate`/`db:seed`/`db:reset` exit `1` until Phase 3.
  - `packages/ai`: `readAiEnv()`, `getLlmHealthStatus()`, `isAiRuntimeEnabled()` defaulting to `LLM_PROVIDER=disabled` and `AI_ZDR_CONFIRMED=false` + unit tests.
- **Next.js App (`apps/web`):** `next.config.ts` (`output: "standalone"`), Tailwind CSS v4 (`globals.css` with §23 tokens and `tabular-nums`), self-hosted `@fontsource/nunito` (400/700/800), `messages/en.json`, `server/log.ts` (JSON logger redacting secrets/PINs/free text), `server/health.ts`, `app/api/v1/health/route.ts`, `app/page.tsx`, `components/HealthStatusCard.tsx`.

### 3. Assumptions & Specification Conflicts

1. **Conflict: `AGENTS.md` every-commit commands vs `docs/SPEC.md §24` phased build:** `AGENTS.md` requires `pnpm db:migrate && pnpm db:seed`, `pnpm verify` (commented as including `content:check`), and `pnpm test:e2e` before every commit, while §24 schedules `content:check` for Phase 2, `db:migrate`/`db:seed` for Phase 3, and `test:e2e` for Phase 6. Per spec precedence (`§14–27` build phases) and the instruction not to introduce no-op checks, Phase 0 `pnpm verify` runs `typecheck`, `lint`, `format:check`, `test`, and `build`; `content:check`, `db:migrate`, `db:seed`, `db:reset`, and `test:e2e` exit `1` until their target phases. No git commit has been created yet.
2. **`docs/SPEC.md` vs `GAPS_V0.1_SPEC.md`:** Copied `GAPS_V0.1_SPEC.md` to `docs/SPEC.md` per §14 while preserving root `GAPS_V0.1_SPEC.md`.
3. **`/api/v1/health` vs `/health`:** Implemented `/api/v1/health` per §7/§13/§20 ("All endpoints live under `/api/v1`") and §24 Build; treated `/health` in §20/§24 Exit checks as shorthand.
4. **Health JSON & status codes:** Used `status: "ok" | "degraded"`, `db: "ok" | "error"`, `version: "0.1.0"` returning HTTP `200` (`db: "ok"`) or HTTP `503` (`db: "error"`).
5. **Tooling pins:** Pinned `typescript@5.9.3` (per §16 TypeScript 5 and `typescript-eslint <6.1.0`) and `eslint@9.39.5` (per `eslint-plugin-react <=9.x`). Bundled `@fontsource/nunito` for zero-network self-hosted fonts.
6. **Health wait on `db:up`:** Added `--wait` to `docker compose up -d --wait postgres` so `pnpm db:up` waits for `pg_isready` health before returning.

### 4. Phase 0 Checks & Results

- **Runtime check:** `pnpm exec node -v` → `v22.23.5`; `pnpm -v` → `12.18.0`; host global `node -v` → `v26.7.0`.
- **`pnpm install`:** exit `0` (`Done in 5ms`, `devEngines.runtime` node `22.23.5` active).
- **`pnpm db:up`:** exit `0` (`Container gaps-postgres Healthy`, image `postgres:16-alpine`). `docker exec gaps-postgres psql -U gaps -d gaps -c "SELECT version();"` → `PostgreSQL 16.15 on aarch64-unknown-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit`.
- **Root `.env.local` loading (with `env -u DATABASE_URL`):**
  - `@gaps/db` `checkDatabaseHealth()` (`SELECT 1`): exit `0`, `{"ok":true,"latencyMs":24}`.
  - Live `apps/web` (`pnpm --filter @gaps/web start -p 3100`): `GET /` → HTTP `200`; `GET /api/v1/health` → HTTP `200` `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.
- **`pnpm verify` (under Node `v22.23.5`):** exit `0`:
  - `pnpm typecheck`: 6/6 workspace projects passed.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm format:check`: passed.
  - `pnpm test` (`vitest run`): 8 test files, 19 tests passed.
  - `pnpm build`: Next.js 16.4.6 Turbopack standalone build passed with 0 warnings.
- **Honest unimplemented phase gates:** `pnpm content:check` exits `1` (Phase 2), `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` exit `1` (Phase 3), `pnpm test:e2e` exits `1` (Phase 6).

### 5. Status & CEO/CTO Commit-Gate Decision

- **Phase 0 spec exit checks (`§24`):** All Phase 0 checks (`install`, `typecheck`, `lint`, `test`, `build`, `pnpm db:up`, and `GET /api/v1/health` HTTP `200` with `db: "ok"` and `llm: "disabled"`) passed.
- **CEO/CTO commit-gate clarification recorded (in `AGENTS.md`, `CLAUDE.md`, `docs/BUILD_PLAN.md`, `docs/BUILD_LOG.md`):**
  - Every commit requires `pnpm verify` and all checks applicable to implemented functionality.
  - Phase 0 onward: install, typecheck, lint, tests, build, and real PostgreSQL health checks.
  - Phase 2 onward: `content:check` becomes mandatory inside `pnpm verify`.
  - Phase 3 onward: migration and seed checks become mandatory.
  - Phase 6 onward: mobile and desktop Playwright checks become mandatory.
  - Add meaningful tests alongside earlier functionality when applicable; unimplemented checks remain explicitly unavailable (exit non-zero, never fake passes); no safety invariant or final release requirement is waived.
- **Phase 0 closed and committed** as `"phase 0: scaffold"` prior to Phase 1.

---

## Phase 1: Domain Core (`2026-11-12`)

### 1. Built

- **`packages/domain/src/` (pure deterministic TypeScript, zero Node/browser I/O):**
  - `types.ts`: Canonical frozen constants (`POLICY_VERSION = "rules-1.0"`, `VERIFIER_VERSION = "verify-1.0"`), all 14 `CONCEPT_IDS`, 15 `MISCONCEPTION_IDS`, 12 `TEACHING_ACTIONS`, `Rational`, `RichText`, `VisualSpec`, `AnswerSpec`, `Parsed`, `CheckedAttempt`, `Belief`, `DecisionContext`, and `DecisionResult` (matching SPEC §8, §9, §19, §20, §22, Appendix A).
  - `rng.ts` & `ids.ts`: Deterministic Mulberry32 PRNG (`createRng`), FNV-1a string seeder (`hashStringToSeed`), and pure Crockford Base32 prefixed ULID generator/validator (`makeUlid`, `makeId`, `isValidPrefixedId`) for all 12 prefixes (`usr_`, `stu_`, `coh_`, `ses_`, `att_`, `evt_`, `dec_`, `itm_`, `qst_`, `bos_`, `slv_`, `flg_`).
  - `rational.ts`: Exact BigInt reduced `Rational` (`d > 0`, `gcd(|n|, d) === 1`), `gcd`, `lcm`, `add`, `sub`, `mul`, `div`, `neg`, `abs`, `cmp`, `eq`, `isInteger`, `toMixed`, `fromDecimalString`, and `format`.
  - `parse.ts`: SPEC §19.1 Unicode normalization (`−`→`-`, `÷`/`⁄`→`/`, whitespace collapse, single trailing period trim) and strict grammar parser (`integer`, `fraction`, `mixed`, `decimal`, `comparison`, `choice`, `order`), returning `null` for malformed/over-long/division-by-zero inputs.
  - `misconceptions.ts` & `verify.ts`: Full 15-entry misconception catalog (`MC-*`), exact single-match / zero-on-ambiguity matcher (`matchMisconception`), and `verify` across all `AnswerSpec` kinds × rational forms (`any`, `simplest`, `mixed`, `improper`), `not_simplified`, and `formatMismatch`.
  - `belief.ts`: Pure replayable `beliefReducer`, `replayBeliefs`, `createInitialBeliefState`, `toPublicBelief`, and read-time staleness (`computeEffectiveReliability`), enforcing `unparseable`/`not_simplified` non-evidence, `assisted > 0` non-promotion (`I2`), 6d23h vs 7d retention boundary, review scheduling (`+2d` warmup, `+7d` retention, `+1d` retry), and demotion/cancellation.
  - `policy/l1.ts`, `quickcheck.ts`, `policy/l2.ts`: Topological 14-concept strand DAG, `GRADE_ENTRY` (`6→PART`, `7→EQUIV`, `8→ADDUNLIKE`), `focusConcept`, 5-item Quick Check traversal, Learn session review-first opener, `targetDifficulty`, `selectTemplate`, `drawFreshSeed`, deterministic IST `(studentId, istDate)` Daily Quest (3–5 items), Boss Battle unlock (`ceil(n/2)`), 8-item weighted Boss composer, and `evaluateBossBattle` (`>= 6/8`).
  - `policy/l3.ts`: Deterministic `decideNextAction` (`R1_HINT_REQUESTED`–`R14_KEEP_GOING` + `R0_DEFAULT`) and `guardDecision` enforcing `allowedActions`, hint rungs, difficulty bounds, and `reviewDue` preconditions.
  - `sparks.ts` & `comeback.ts`: Idempotent Sparks calculator (`+10`/`+5`/`+30`/`+50`/`+20`/`+10`/`+40`, daily cap `300`, milestones `[100, 250, 500, 1000, 2000]`), UTC→IST (`UTC+05:30`) date conversion, Mon–Sun weekly rhythm, and `buildComebackCard` (`>= 24h` eligibility, factual attempt citations).
- **`packages/contracts/src/`:**
  - `domain.ts`, `step.ts`, `domain.test.ts`, re-exported from `index.ts`: Zod v4 schemas mirroring `Belief`, `CheckedAttempt`, `DecisionContext`, `DecisionResult`, `RichText`, `VisualSpec`, `Step`, and `.strict()` `ItemViewSchema` rejecting leaked `answer`/`seed`/`misconceptions` (`I9`).
- **Tooling / Test Harness:**
  - Added `fast-check@4.10.2` (root `devDependency`) for `Rational` property tests.
  - Configured `thresholds: { lines: 90 }` in `vitest.config.ts`.

### 2. Checks & Results

- **Domain Purity Scan (`packages/domain/src`):** zero `node:*`, `fs`, `path`, `http`, `https`, `net`, `child_process`, `crypto`, `os`, or `process` imports (`PURE_DOMAIN_OK`).
- **`pnpm verify` (under Node `v22.23.5`):** exit `0`:
  - `pnpm typecheck`: 6/6 workspace packages passed.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm format:check`: passed.
  - `pnpm test` (`vitest run`): **23 test files, 135 tests passed**, including:
    - `rational.test.ts`: field laws, invariants, ordering (`fast-check`), `toMixed`, `fromDecimalString`, `format`.
    - `parse.test.ts`: 60+ table-driven cases across integers, fractions, mixed numbers, decimals, comparisons, order lists, choice IDs, Unicode normalization, and malformed inputs.
    - `verify.test.ts` & `misconceptions.test.ts`: all `AnswerSpec` kinds × forms, `formatMismatch`, single vs ambiguous misconception suppression.
    - `belief.test.ts`: all §9 transitions, `6d23h` vs `7d` retention, assisted non-promotion (`I2`), demotion + review cancellation, 30d staleness, deterministic out-of-order replay.
    - `policy/l1.test.ts`, `quickcheck.test.ts`, `policy/l2.test.ts`, `sparks.test.ts`, `comeback.test.ts`.
    - `policy/l3.golden.test.ts`: **40 golden decision scenarios (`G01`–`G40`) passed**, explicitly marked `educatorReviewStatus: "pending"`.
  - `pnpm build`: Next.js 16.4.6 Turbopack standalone build passed.
- **`pnpm test:coverage` (`packages/domain/src/**/*.ts`):** exit `0` — **96.29% lines** (`96.48%` statements, `89.17%` branches, `98.4%` functions), exceeding the `>= 90%` threshold across every module.
- **PostgreSQL 16 + Live Health Check:** `pnpm db:up` (`gaps-postgres` healthy) + `pnpm --filter @gaps/web start -p 3102` -> `GET /api/v1/health` returned **HTTP 200** `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.
- **Unimplemented Phase Gates (kept non-zero):** `pnpm content:check` (Phase 2), `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` (Phase 3), `pnpm test:e2e` (Phase 6).

### 3. Assumptions, Conflicts & Decisions Requiring Review

- **`Belief` vs `BeliefState`:** Appendix A `Belief` omits internal attempt history and `lastEvidenceAt`, whereas §19.4 reduces over `b.history` and computes read-time 30-day staleness. Implemented `Belief` strictly matching Appendix A and extended it internally as `BeliefState` (`history`, `lastEvidenceAt`, `lastEffects`) with `toPublicBelief()` stripping internal history cleanly.
- **`orderList` comma spacing:** §19.1 grammar specifies `fraction ("," fraction){1,5}`; accepted optional whitespace after `,` so `"1/4, 2/4, 3/4"` parses alongside `"1/4,2/4,3/4"`.
- **Direct `SPEC` L3 wording for `R4_NOT_SIMPLIFIED` & `R11_SECOND_MISS`:** `R4_NOT_SIMPLIFIED` maps to `ASK_CLARIFICATION` with `params: { askSimplify: true }` (per §19.2 / §25 `G09` no-evidence semantics); `R11_SECOND_MISS` emits primary action `WORKED_EXAMPLE` with L2 session engine serving `GUIDED_PRACTICE` after the worked example step is acknowledged.
- **Pending Educator Review (no fabricated sign-off):** All 40 golden decision scenarios (`G01`–`G40` in `packages/domain/src/policy/l3.golden.test.ts`) are marked `educatorReviewStatus: "pending"` pending education-lead review.

### 4. Follow-ups

- Present `G01`–`G40` golden scenarios for education-lead sign-off alongside Phase 2 content review.
- Proceed to Phase 2 (`packages/content` 14 concepts, ≥ 40 templates, explanations, `content:check`, `content:preview` CLI) when instructed.

---

## Phase 1: Review Corrections (`2026-11-13`)

### 1. Built & Corrected

Addressing five CEO/CTO review findings for Phase 1:

1. **Policy Guard (`packages/domain/src/policy/l3.ts`):**
   - Fallback action selection now strictly respects `ctx.allowedActions`: prefers `INDEPENDENT_PRACTICE` if present, otherwise chooses `ctx.allowedActions[0]`. Never returns an action outside `allowedActions`.
   - Explicitly rejects empty `allowedActions` by throwing `RangeError("Cannot authorize execution: allowedActions is empty")` in both `guardDecision` and `decideNextAction`, refusing to authorize execution.
2. **R13 & Review Routing (`packages/domain/src/policy/l3.ts`, `packages/domain/src/types.ts`):**
   - Added `justBecameDemonstrated?: boolean` and `dueReviewConceptId?: ConceptId` to `DecisionContext`.
   - Rule 13 now requires explicit transition signal (`ctx.justBecameDemonstrated === true || ctx.session.justBecameDemonstrated === true`). Concepts with `belief.status === "demonstrated"` where `justBecameDemonstrated` is not set fall through to Rule 14 (`INDEPENDENT_PRACTICE`).
   - Rule 13 routes retrieval practice to `ctx.dueReviewConceptId ?? ctx.focusConceptId`, ensuring due reviews target the actual due concept.
3. **Comeback Evidence and Copy (`packages/domain/src/comeback.ts`, `apps/web/messages/en.json`):**
   - `buildComebackCard` now returns pure structured data (`ComebackCardData`):
     - Cites qualifying demonstration evidence (`okL4`, up to 4 attempt IDs with distinct templates/items).
     - Consistent counts and citations: `presentCorrect === presentAttemptIds.length`.
     - Detects multi-day spans (`spansMultipleDays`) and selects `messageKey: "comeback.singleDay" | "comeback.multiDay" | "comeback.retention"`.
     - Supports retention citations with `retentionAttemptId`.
   - Student copy resides in `apps/web/messages/en.json` with date-neutral wording when evidence spans days (e.g. `"You worked through this over several days"` instead of labeling historical attempts as `"today"`).
   - Formatter helper `formatComebackMessage(card, template?)` handles string rendering cleanly.
4. **Boss Completion (`packages/domain/src/policy/l2.ts`):**
   - Boss battle length invariant enforced: `BOSS_BATTLE_ITEM_COUNT = 8`.
   - Incomplete battles (`outcomes.length < 8`) never declare victory (`defeated: false`).
   - Out-of-bounds outcome lengths (`outcomes.length > 8`) or incomplete submissions when `requireComplete: true` throw `RangeError`.
5. **Contracts & ID Validation (`packages/contracts/src/domain.ts`, `packages/contracts/src/step.ts`):**
   - Replaced loose prefix checks with full 30-character prefixed ULID schemas (`att_`, `stu_`, `ses_`, `itm_`, `dec_`, `qst_`, `bos_` followed by 26 Crockford Base32 characters: `^[0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz]{26}$`).
   - Validates RFC 4122 UUID v4 for `clientAttemptId` via `ClientAttemptIdSchema`.
   - Updated test fixtures across all domain and contract suites with valid ULIDs and UUID v4s.

### 2. Regression Tests & Results

Two dedicated regression test suites reproduce and guard against all five findings:

- `packages/domain/src/regressions.test.ts`:
  - F1a: Fallback never returns action outside `allowedActions`.
  - F1b: Empty `allowedActions` throws `RangeError` without authorizing execution.
  - F2a: R13 triggers only when `justBecameDemonstrated: true`, falls through to R14 when false.
  - F2b: R13 routes retrieval to `dueReviewConceptId` when specified on a different concept.
  - F3: Comeback card cites qualifying evidence, handles multi-day learning, retention, and C,I,C,C sequences with date-neutral copy.
  - F4: Boss completion requires all 8 items before declaring victory and rejects invalid result lengths.
- `packages/contracts/src/regressions.test.ts`:
  - F5: Rejects malformed IDs (`att_01`, `uuid-1`, invalid Base32) and accepts full 30-char prefixed ULIDs and UUID v4.

**Initial reproduction failure:** Before fixes were applied, running both suites produced 5/5 targeted failures as expected.
**Post-fix verification:** Both suites pass completely (7/7 tests passed).

### 3. Golden Scenario Updates & Rationale

Updated golden scenarios in `packages/domain/src/policy/l3.golden.test.ts`:

- **G08:** Updated to set `justBecameDemonstrated: true` and `dueReviewConceptId: "MATH-FRAC-PART"` so Rule 13 routes retrieval practice to the actual due concept.
- **G31 & G32:** Updated with `justBecameDemonstrated: true` to explicitly indicate the transition to demonstrated status that qualifies for Rule 13 retrieval practice.
- All golden scenarios retain `educatorReviewStatus: "pending"`; no educator sign-off was fabricated.

### 4. Verification & Coverage Results

- **`pnpm verify` (Node `v22.23.5`):** exit `0`:
  - `pnpm typecheck`: 6/6 packages passed.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm format:check`: passed.
  - `pnpm test`: **25 test files, 143 tests passed**.
  - `pnpm build`: Next.js 16.4.6 Turbopack build passed.
- **`pnpm test:coverage` (`packages/domain/src/**/*.ts`):** exit `0` — **96.21% lines** (statements `96.41%`, branches `89.38%`, functions `97.74%`), with every single file `>= 91%` (lowest is `comeback.ts` at `94.00%`).
- **PostgreSQL 16 & Live Health Check:** `pnpm db:up` healthy (`gaps-postgres`), `GET /api/v1/health` returned HTTP `200` with `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.

---

## Phase 1: Review Corrections 2 (`2026-11-14`)

### 1. Built & Corrected

Addressing six second-round CEO/CTO review findings for Phase 1:

1. **Fallback Precondition Validation & Fail Closed (`packages/domain/src/policy/l3.ts`):**
   - Implemented `tryCreateFallback` to validate preconditions and construct required parameters per action (e.g. `RETRIEVAL_REVIEW` requires `reviewDue` and `dueReviewConceptId`; `REVIEW_PREREQUISITE` requires a weak prerequisite concept).
   - In `buildFallback`: Tries `INDEPENDENT_PRACTICE` first if allowed, then iterates over `ctx.allowedActions`. If no allowed action can produce a valid fallback meeting preconditions and parameter constraints, fails closed by throwing `RangeError("Cannot authorize execution: no valid fallback action in allowedActions")`.
2. **Boss Completion Requires Eight Resolved Outcomes (`packages/domain/src/policy/l2.ts`):**
   - Enforced that only `"correct"` and `"incorrect"` count as resolved item outcomes.
   - Six correct plus `unparseable` and `not_simplified` yields `resolvedCount === 6 < 8`, resulting in `completed: false` and `defeated: false`.
   - Rejecting incomplete battle results when `requireComplete: true` throws `RangeError`.
3. **Require `dueReviewConceptId` When `reviewDue=true` (`packages/domain/src/policy/l3.ts`, `packages/contracts/src/domain.ts`):**
   - In `packages/domain/src/policy/l3.ts`: `decideNextAction` and `guardDecision` immediately throw `TypeError("dueReviewConceptId is required when reviewDue is true")` if `reviewDue === true` and `dueReviewConceptId` is missing. Never silently substitutes `focusConceptId`.
   - In `packages/contracts/src/domain.ts`: Refined `DecisionContextSchema` to reject contexts where `reviewDue === true` and `dueReviewConceptId` is omitted.
4. **Preserve Original Demonstration Citations on Retention Cards (`packages/domain/src/comeback.ts`):**
   - Scans independent attempt history for the earliest qualifying 4-attempt demonstration window (`l4.length === 4 && okL4.length >= 3 && distinctTemplates >= 2`) following support entry.
   - Preserves original demonstration citations (`presentAttemptIds`) on retention cards even when intervening practice attempts or warm-up attempts exist between demonstration and retention review.
   - Records the retention review attempt ID strictly under `retentionAttemptId`.
5. **Pure Structured Comeback Card Data in Domain (`packages/domain/src/comeback.ts`, `apps/web/server/comeback.ts`):**
   - Removed hardcoded English copy templates (`COMEBACK_COPY_TEMPLATES`) and default `message` property/formatting from `packages/domain/src/comeback.ts`.
   - `buildComebackCard` outputs pure structured `ComebackCardData` (`messageKey`, `copyParams`, `presentAttemptIds`, `pastAttemptIds`, etc.).
   - Localized string formatting is handled through `apps/web/messages/en.json` via `renderComebackMessage` in `apps/web/server/comeback.ts`.
6. **Reject ULID Overflow Encodings in Domain and Contracts (`packages/domain/src/ids.ts`, `packages/contracts/src/domain.ts`):**
   - Enforced the 48-bit Crockford Base32 timestamp upper bound (`0..7` in the first position) in both `ULID_RE` (`/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i`) and `PrefixedUlidSchema`.
   - Rejects overflow ULIDs starting with `8`, `9`, or letters `A..Z` (e.g. `att_80000000000000000000000000`, `att_ZZZZZZZZZZZZZZZZZZZZZZZZZZ`) while accepting max valid `att_7ZZZZZZZZZZZZZZZZZZZZZZZZZ` and normal timestamped ULIDs.

### 2. Regression Tests & Results

New regression tests were added and verified to fail prior to applying fixes:

- `packages/domain/src/regressions.test.ts`:
  - `CR1`: Fails closed when no valid fallback exists in `allowedActions`.
  - `CR2`: Boss battle does not complete or defeat with 6 correct plus `unparseable` and `not_simplified`.
  - `CR3`: Requires `dueReviewConceptId` when `reviewDue=true` and never silently substitutes focus concept.
  - `CR4`: Preserves original demonstration citations on retention cards with intervening practice and warm-ups.
  - `CR5`: `ComebackCardData` in domain is pure structured data without hardcoded string templates.
  - `CR6`: Rejects ULID overflow encodings (first Crockford character > 7).
- `packages/contracts/src/regressions.test.ts`:
  - `CR3_contract`: `DecisionContextSchema` rejects `reviewDue=true` when `dueReviewConceptId` is missing.
  - `CR6_contract`: Rejects ULID overflow encodings in contract schemas.
- `apps/web/server/comeback.test.ts`:
  - Renders structured `ComebackCardData` using `apps/web/messages/en.json` templates.

**Initial reproduction failure:** All new regression tests failed as expected before fixes.
**Post-fix verification:** All 26 test files and 155 tests pass.

### 3. Verification & Coverage Results

- **`pnpm verify` (Node `v22.23.5`):** exit `0`:
  - `pnpm typecheck`: 6/6 packages passed.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm format:check`: passed.
  - `pnpm test`: **26 test files, 155 tests passed**.
  - `pnpm build`: Next.js 16.4.6 Turbopack standalone build passed.
- **`pnpm test:coverage` (`packages/domain/src/**/*.ts`):** exit `0` — **95.76% lines** (statements `96.00%`, branches `89.34%`, functions `98.54%`), with every single file >= 90.51% (lowest is `l3.ts` at `90.51%`, `misconceptions.ts` at `91.30%`, `ids.ts` at `93.10%`).
- **PostgreSQL 16 & Live Health Check:** `pnpm db:up` healthy (`gaps-postgres`), `GET /api/v1/health` returned HTTP `200` with `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.
