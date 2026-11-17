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

---

## Phase 1: Review 3 — Shared Guard Predicates & Authoritative Belief Transitions (`2026-11-13`)

Addressing the two remaining review findings following commit `73ebfb3`:

### 1. Built & Refactored

1. **Shared Guard Validation Across Normal Decisions, Guard Calls & Fallbacks (`packages/domain/src/policy/l3.ts`):**
   - Extracted and shared explicit predicates:
     - `isEligibleWeakPrerequisite(b: Belief)`: checks `b.status === "not_assessed" || b.status === "needs_support" || b.status === "developing"`.
     - `findWeakPrerequisite(prereqs: readonly Belief[])`: selects the first eligible weak prerequisite.
     - `isValidPrerequisiteRoute(ctx: DecisionContext, targetConceptId?: ConceptId)`: verifies `!ctx.session.prereqRouteTaken`, that `targetConceptId` is provided, belongs to `ctx.prerequisiteBeliefs`, and is an eligible weak prerequisite.
     - `isValidRetrievalReview(ctx: DecisionContext, targetConceptId?: ConceptId)`: verifies `ctx.reviewDue === true`, `ctx.dueReviewConceptId` is defined, and `targetConceptId === ctx.dueReviewConceptId`.
   - Direct `guardDecision`:
     - If `ctx.reviewDue === true` and `!ctx.dueReviewConceptId`, fails closed immediately by throwing `TypeError("dueReviewConceptId is required when reviewDue is true")`, matching `decideNextAction` even when candidate supplies a `conceptId`.
     - `RETRIEVAL_REVIEW`: validated using `isValidRetrievalReview`.
     - `REVIEW_PREREQUISITE`: validated using `isValidPrerequisiteRoute` (rejects demonstrated/retained prerequisites and rejects when `prereqRouteTaken === true`).
   - `tryCreateFallback`:
     - `RETRIEVAL_REVIEW`: validated using `isValidRetrievalReview(ctx, ctx.dueReviewConceptId)`.
     - `REVIEW_PREREQUISITE`: checks `!ctx.session.prereqRouteTaken` and requires `findWeakPrerequisite(ctx.prerequisiteBeliefs)`. If only `REVIEW_PREREQUISITE` is allowed and preconditions fail, `buildFallback` fails closed with `RangeError`.

2. **Authoritative Transition Evidence in Comeback Cards (`packages/domain/src/belief.ts`, `packages/domain/src/comeback.ts`):**
   - Removed the separate rolling-window approximation from `buildComebackCard`.
   - Added `replayTransitions(conceptId, attempts, ctx)` to `packages/domain/src/belief.ts`:
     - Chronologically steps through `beliefReducer` directly, capturing authoritative transitions to `"demonstrated"` and `"retained"`.
     - Tracks exact qualifying supporting attempt IDs (`okL4`) and 4-attempt window (`l4`) at the moment of demonstration qualification.
     - When demoted to `"needs_support"`, resets the active demonstration.
     - When re-demonstrated following demotion, records the fresh qualifying demonstration transition.
     - When transitioned to `"retained"`, captures `retentionAttemptId` while preserving the supporting attempts from the active demonstration.
   - `buildComebackCard`:
     - Replays history up to `achievedAt` through `replayTransitions`.
     - Uses `transitions.retentionTransition?.demonstration ?? transitions.currentDemonstration` for authoritative supporting attempts.
     - Exactly resolves sequence `I, I, C(T1), C(T1), C(T1), I(T1), C(T2), C(T2)`: demonstration occurs at attempt 8, citing attempts 5, 7, 8 (not 4, 5, 7).
     - Preserves original demonstration citations across intervening practice and warm-up attempts before retention review.
     - Correctly cites the new qualifying attempts on demotion followed by re-demonstration.

3. **Rational Trichotomy Object.is Hardening (`packages/domain/src/rational.test.ts`):**
   - Normalized `-0` vs `+0` in property test trichotomy assertion `expect(ab).toBe(-ba === 0 ? 0 : -ba)` to avoid `Object.is(+0, -0)` failure during randomized fast-check runs.

### 2. Regression Tests & Results

Failing regressions were added in `packages/domain/src/regressions.test.ts` prior to fixing:

- `Issue 1a`: `guardDecision` with `reviewDue=true` and no `dueReviewConceptId` throws `TypeError` even with candidate `conceptId`.
- `Issue 1b`: `guardDecision` rejects `REVIEW_PREREQUISITE` if target is demonstrated or if `prereqRouteTaken=true`, falling back or failing closed when only `REVIEW_PREREQUISITE` is allowed.
- `Issue 2a`: Sequence `I, I, C(T1), C(T1), C(T1), I(T1), C(T2), C(T2)` with 2 reviewed templates achieves demonstration at attempt 8, citing attempts 5, 7, 8 (not 4, 5, 7).
- `Issue 2b`: Retention card preserves original demonstration citations even after intervening practice.
- `Issue 2c`: Demotion followed by re-demonstration cites the fresh re-demonstration attempts (8, 9, 10), not old pre-demotion attempts.

**Reproduction:** 4/5 new tests failed on the previous codebase.
**Post-fix:** All 26 test files and 160 tests pass.

### 3. Verification & Coverage Results

- **`pnpm verify` (Node `v22.23.5`):** exit `0`:
  - `pnpm typecheck`: 6/6 workspace packages passed.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm format:check`: passed.
  - `pnpm test`: **26 test files, 160 tests passed**.
  - `pnpm build`: Next.js 16.4.6 Turbopack standalone build passed.
- **`pnpm test:coverage` (`packages/domain/src/**/*.ts`):** exit `0` — **95.88% lines** (statements `96.09%`, branches `89.69%`, functions `98.58%`), with every single module >= 91.33% line coverage (lowest is `l3.ts` at `91.33%`, `ids.ts` at `93.10%`, `l1.ts` at `94.73%`).
- **PostgreSQL 16 & Live Health Check:** `pnpm db:up` healthy (`gaps-postgres`), `GET /api/v1/health` returned HTTP `200` with `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.

---

## 2026-11-14 — Phase 2: Fractions Curriculum, Templates, Explanations and Content Validation

### Built

- **Fractions Curriculum Definitions (`packages/content`):**
  - Chapters: 3 chapters (A: Meet the fractions, B: Fraction operations, C: Fractions in the world) per SPEC §22.
  - Concepts: All 14 concepts (`MATH-FRAC-PART` through `MATH-FRAC-WORD`) with descriptions, grade bands (6–8), student-facing titles, and topological order (1–14).
  - Prerequisite Edges: All 18 prerequisite edges defining the fractions DAG.
  - Misconceptions: All 15 catalogued misconceptions (`MC-PART-RATIO` through `MC-DEC-DIGITS`) with student feedback and teacher notes.
  - Explanations: 14 concepts × 3 routes (`picture`, `everyday`, `steps`) <= 90 words with Class 6 Indian contexts.
- **Templates & Question Generators:**
  - 42 authored question templates across all 14 concepts (exactly 3 per concept, exceeding >= 40 requirement).
  - Marked `review: { status: "draft" }` for development.
  - Generates prompts, inputs (`number`, `fraction`, `mixed`, `decimal`, `comparison`, `choice`), answer specs, hint rungs (3 rungs), visual specs (`fraction_bar`, `number_line`, `area_model`), and worked examples.
- **Validation & CLI Tooling (`content:check` & `content:preview`):**
  - `packages/content/src/check.ts`: 500 seeds tested per template (21,000 generated items). Verified graph acyclicity via Kahn's algorithm, topological ordering, distinct items (>= 20 per template), well-formed answers, no misconception collision/answer equality, and zero hint leaks.
  - `packages/content/src/preview.ts`: CLI for inspecting rendered items with prompts, answers, misconceptions, and hint rungs.
  - Root `package.json`: Integrated `content:check` as a mandatory commit gate in `pnpm verify`.

### Verification Results

- `pnpm verify`: 100% green (typecheck, lint, format:check, content:check, test, build).
- `pnpm content:check`: 42 templates verified across 500 seeds each — 0 errors.
- Tests: 26 files passed, 170 tests passed.
- PostgreSQL 16 & Live Health Check: `pnpm db:up` healthy, `GET /api/v1/health` HTTP 200 with `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.

### Assumptions

- Templates marked `status: "draft"` in development without fabricating educator review signatures, per SPEC §10 & §22.
- Hint rungs guide methods and steps without leaking unstated factors or answers.

---

## 2026-11-14 — Phase 3: Database Schema, Migrations, Seed Data, Replay, and Principal Repositories

### Built

- **Drizzle PostgreSQL Schema (`packages/db/src/schema.ts`):**
  - Implemented all 30 PostgreSQL tables from SPEC §18:
    - Organizations, Cohorts, Users, Teacher Cohorts, Consent Records, Auth Sessions, Feature Flags.
    - Chapters, Concepts, Concept Edges, Misconceptions, Templates, Item Instances.
    - Learning Sessions, Attempts, Events, Concept Beliefs, Student State, Decision Traces.
    - Review Schedule, Quests, Boss Battles, Sparks Ledger, Comeback Cards, Solve Threads, Solve Messages.
    - Flags, LLM Calls, Audit Log, Deletion Requests.
  - Foreign key cascades configured on student deletion (`onDelete: "cascade"`).
  - Enforced unique partial indexes (active consent `where revoked_at IS NULL`, due reviews `where status = 'due'`).
  - Generated initial Drizzle SQL migration `packages/db/migrations/0000_robust_zzzax.sql`.
- **Database Tools & Scripts:**
  - `packages/db/src/migrate.ts`: programmatic migration runner applying Drizzle migrations to PostgreSQL 16.
  - `packages/db/src/content-sync.ts`: idempotent synchronization of all chapters, concepts, DAG edges, misconceptions, and templates from `@gaps/content`.
  - `packages/db/src/crypto.ts`: secure PIN and password hashing/verification using `scrypt`.
  - `packages/db/src/seed.ts`: seeded demo org (Delhi Public Model School), cohort 7A (join code `DEMO7A`), users (`meera`, `kabir`, `aarav`, `teacher@demo.gaps`, `admin@demo.gaps`), student states, Meera's historical session demonstrating `MATH-FRAC-EQUIV`, retention review due, daily quest, and feature flags. Verified idempotency.
  - `packages/db/src/reset.ts`: drops schemas, applies migrations, syncs content, and seeds database.
  - `packages/db/src/replay.ts`: reevaluates stored student attempts against authoritative domain logic (`replayBeliefs`) and verifies zero mismatches with stored projections.
- **Principal-Scoped Repositories (`packages/db/src/repos/`):**
  - `content.ts`: queries curriculum chapters, concepts, edges, templates, and provides idempotent `findOrCreateItemInstance`.
  - `student.ts`: `createStudentRepo(studentId)` scoping all queries and mutations to the authenticated student, enforcing attempt idempotency via `(sessionId, clientAttemptId)`, session abandonment, spark awards, and active consent checks.
  - `teacher.ts`: `createTeacherRepo(teacherId)` scoping access strictly to assigned cohorts (`teacher_cohorts`), roster views, student progress, flags, and consent recording/revocation.
  - `admin.ts`: `createAdminRepo(adminId)` managing cohorts, assignments, feature flags, audit logs, and cascading student deletion requests.

### Verification Results

- `pnpm verify`: 100% green across typecheck, lint, format:check, content:check, db:migrate, db:seed, unit/integration tests, and Next.js standalone build.
- Tests: 28 files passed, 182 tests passed.
- Replay Verification: `verifyStudentReplay` passed on seeded student Meera across all 14 concepts with 0 mismatches.
- PostgreSQL 16: Container `gaps-postgres` healthy; live health check `GET /api/v1/health` HTTP 200 with `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.

### Assumptions

- Seed data creates cohort 7A with join code `DEMO7A`, student Meera with PIN `333333`, Kabir with PIN `444444`, Aarav with PIN `121212`, teacher with `teacher@demo.gaps`, and admin with `admin@demo.gaps`.
- Unassessed concepts in `concept_beliefs` default to status `not_assessed`.
- `pnpm db:migrate && pnpm db:seed` added as a mandatory commit gate in `pnpm verify` per Phase 3 requirements.

---

## 2026-11-14 — Phase 4: Identity, Auth, Roles, Roster Management, and Consent Gating

### Built

- **Contracts & Schemas (`packages/contracts/src/auth.ts`):**
  - Zod schemas for student login (`joinCode`, `username`, `pin`, `deviceKind`), staff login (`email`, `password`, `totp`), profile DTO, consent scopes (`core_learning`, `ai_free_text`, `research_use`), consent recording, adding students, and PIN reset.
- **Session Management (`apps/web/server/auth/session.ts`):**
  - 32-byte cryptographically secure random session tokens.
  - SHA-256 token hashing stored in `auth_sessions`.
  - Expiry: 8 hours for shared device; 30 days for personal device.
  - Asynchronous `lastSeenAt` tracking; revocation via `revokedAt`.
  - Resolution of full `Principal` with active consents and cohort context.
- **Authentication Services (`apps/web/server/auth/service.ts`):**
  - `loginStudent`: cohort lookup by joinCode (case-insensitive), username lookup, PIN verification via `verifyPin`, lockout at 10 consecutive failed logins (423), recovery on successful login, and session cookie generation (`gaps_session`).
  - `loginStaff`: staff lookup by email (case-insensitive), password verification via `verifyPassword`, lockout at 5 failed attempts (423), and session cookie generation.
  - `logoutUser`: session revocation and `Set-Cookie` expiration header.
- **Guard & Consent Gating (`apps/web/server/auth/guard.ts`):**
  - Session token extraction from HTTP cookie or `Authorization: Bearer <token>`.
  - Role-based authorization (`requirePrincipal`) enforcing role permissions.
  - `requireCoreConsent`: enforces SPEC §17 invariant that students without `core_learning` consent cannot start learning sessions (HTTP 403 `CONSENT_REQUIRED`).
- **Auth & Roster API Routes (`apps/web/app/api/v1/`):**
  - `POST /api/v1/auth/student-login`: student login returning profile and HTTP-only cookie.
  - `POST /api/v1/auth/staff-login`: staff login returning profile and HTTP-only cookie.
  - `POST /api/v1/auth/logout`: session revocation.
  - `GET /api/v1/me`: current authenticated user profile and active consents.
  - `GET /api/v1/cohorts/[cohortId]/roster`: cohort roster with consent flags, sparks total, and demonstrated concept counts (teacher/admin only).
  - `POST /api/v1/cohorts/[cohortId]/students`: teacher/admin creates student with hashed PIN, initializing `student_state` (status: `pending_consent`).
  - `POST /api/v1/students/[studentId]/consent`: records paper or digital consent, promoting status to `active` upon `core_learning` consent grant.
  - `POST /api/v1/students/[studentId]/reset-pin`: teacher/admin resets student PIN and clears lockouts.

### Verification Results

- `pnpm verify`: 100% green across typecheck, lint, format:check, content:check, db:migrate, db:seed, unit/integration tests, and Next.js standalone build.
- Tests: **30 test files, 198 tests passed**.
- Auth Tests (`apps/web/server/auth.test.ts` & `auth.routes.test.ts`): 16 tests covering student login, staff login, lockout, session revocation, consent gating, and student management lifecycle.
- PostgreSQL 16: Container `gaps-postgres` healthy; health check `GET /api/v1/health` HTTP 200 `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.

### Assumptions

- Seeded student Meera has active `core_learning` consent; seeded student Kabir starts with `pending_consent` (no active consent) to verify consent gating.
- Lockout threshold: 10 failed attempts for students, 5 for staff, locking for 15 minutes.

---

## 2026-11-14 — Phase 5: Learning Session Engine, Attempt Processing, Quests, GapMap, and Review Scheduling

### Built

- **Contracts (`packages/contracts/src/session.ts`):**
  - Zod schemas for SessionMode (`learn`, `review`, `quest`, `boss`, `quick_check`, `solve_followup`).
  - Request/Response schemas for start session (`StartSessionRequestSchema`, `StartSessionResponseSchema`).
  - Attempt submission (`SubmitAttemptRequestSchema`, `SubmitAttemptResponseSchema`) with UUID v4 validation on `clientAttemptId`.
  - Help request (`RequestHelpRequestSchema`, `RequestHelpResponseSchema`) supporting 3 hint rungs, worked examples, and 3 explanation routes (`picture`, `everyday`, `steps`).
  - Home dashboard (`HomeDashboardResponseSchema`) and Daily Quest (`QuestDtoSchema`, `QuestSlotSchema`).
  - GapMap response (`GapMapResponseSchema`, `GapMapConceptNodeSchema`).
- **Learning Engine (`apps/web/server/session/engine.ts`):**
  - Session lifecycle: enforces invariant of 1 active learning session per student by abandoning previous active sessions.
  - Step generation from templates: client-safe `ItemViewDto` omitting answers and misconceptions (INVARIANT §10).
  - Exact grading: BigInt Rational arithmetic via `@gaps/domain` `verify(answerSpec, rawAnswer, misconceptions)`.
  - Two-try rule: incorrect first tries offer a second try (`feedback_then_retry` with friendly feedback "not yet!", never "wrong" or "failed", INVARIANT §9).
  - Attempt idempotency: deduplicates by `clientAttemptId` and returns cached attempt response.
  - Authoritative belief updates: replays stored evidence through `@gaps/domain` `replayTransitions` upon resolved attempts.
  - Sparks ledger: awards +2 sparks on first-try-correct, +20 sparks on newly demonstrated concepts.
  - Review scheduling: schedules +2d warmup review and +7d retention review on demonstration.
  - Comeback Card: triggers milestone card if demonstrated after `firstNeedsSupportAt`.
  - Daily Quest: generates or retrieves today's 3-slot quest (review, target, challenge) using Asia/Kolkata date.
  - Home Dashboard & GapMap: computes student status across all 14 concepts and prerequisite edges.
- **Learning API Routes (`apps/web/app/api/v1/`):**
  - `POST /api/v1/sessions/start`: starts learning session (enforces core consent).
  - `GET /api/v1/sessions/[sessionId]`: fetches session state and current step.
  - `POST /api/v1/sessions/[sessionId]/attempt`: submits and grades attempt.
  - `POST /api/v1/sessions/[sessionId]/help`: requests hint, worked example, or explanation.
  - `GET /api/v1/home`: returns student profile, daily quest, due reviews, and focus concept.
  - `GET /api/v1/gapmap`: returns strand graph with all 14 concepts, statuses, and prerequisites.
  - `GET /api/v1/quests/today`: returns daily quest progress.
- **Tests (`apps/web/server/session.test.ts`):**
  - 11 comprehensive tests validating answer sanitization, 1-active-session invariant, two-try rule, student-friendly copy, attempt idempotency, BigInt grading, Sparks awards, 3 hint rungs, worked examples, explanations, consent gating, and HTTP API handlers.

### Verification Results

- `pnpm verify`: 100% green across typecheck, lint, format:check, content:check, db:migrate, db:seed, unit/integration tests, and Next.js standalone build.
- Tests: **31 test files, 209 tests passed**.
- PostgreSQL 16: Container `gaps-postgres` healthy; all session and attempt APIs verified.

### Assumptions

- Client-safe `ItemViewDto` strictly omits `templateId`, `answer`, and `misconceptions`.
- First-try incorrect attempts transition to `feedback_then_retry` step containing the item view and friendly copy.
- BigInt values in answer specifications and parsed values are recursively serialized to strings for Postgres `jsonb` columns, and hydrated to BigInts upon retrieval.

---

## 2026-11-14 — Phase 6: Student UI, AnswerPad, Visual Models, GapMap, and Playwright E2E Suite

### Built

- **Math & Visual UI Components (`apps/web/components/`):**
  - `RichTextViewer.tsx`: Renders rich text AST elements (`text`, `frac` as vertical stacked fraction numerator/denominator, `mixed`, `math`, `blank`).
  - `AnswerPad.tsx`: Complete virtual keypad for Class 6–8 students with digits 0–9, fraction slash `/`, mixed numbers `w n/d`, decimal `.`, negative `-`, comparison buttons (`<`, `=`, `>`), backspace, clear, check answer button, and multiple-choice options with live mathematical expression rendering.
  - `VisualViewer.tsx`: Responsive SVG visual models matching SPEC §8:
    - `fraction_bar`: shaded and unshaded partitions with segment numerator/denominator labels.
    - `number_line`: axis line, whole number marks, subdivision tick marks with fraction labels, jump arcs, and point indicators.
    - `area_model`: 2D partitioned grid models.
  - `QuestCard.tsx`: Daily Quest component displaying today's 3 quest slots (review, target, challenge), completion checkmarks, progress bar, and +10 Sparks bonus badge.
  - `GapMap.tsx`: Interactive SVG and card-based knowledge graph for all 14 curriculum concepts across Chapters A, B, and C with status badges (`retained`, `demonstrated`, `developing`, `needs_support`, `not_assessed`), summary statistics, and click-to-open evidence drawer showing why the status was assigned, independent attempt counts, measurement reliability, and prerequisites.
  - `SessionPlayer.tsx`: Active learning player container with progress dots, question prompt, visual model viewer, AnswerPad, 3-rung hint ladder, worked example drawer, 3-route explanation drawer (`picture`, `everyday`, `steps`), gentle "not yet!" feedback banners (INVARIANT §9 & §10), and session completion celebration card.
  - `Header.tsx`: Global student header displaying Gaps branding, student display name, Sparks pill, and sign-out button.
- **Application Pages (`apps/web/app/`):**
  - `login/page.tsx`: Student login interface with class join code, username, 6-digit PIN, device selector (`personal`/`shared`), and quick demo student buttons (`Meera`, `Kabir`, `Aarav`).
  - `home/page.tsx`: Student dashboard integrating Header, Continue Learning target action, Daily Quest widget, due review alert banner, and interactive GapMap with evidence inspection.
  - `session/page.tsx`: Learning session page that starts session via `/api/v1/sessions/start`, mounts `SessionPlayer`, handles consent gating blocks, and connects attempt submissions and hint requests.
  - `page.tsx`: Updated root landing page with direct launch buttons into `/login` and `/home`.
- **E2E Test Suite & Infrastructure (`apps/web/e2e/`, `apps/web/playwright.config.ts`):**
  - Configured Playwright with standalone server (`PORT=3100 node .next/standalone/apps/web/server.js`) and auto-copy of `.next/static` to standalone directory.
  - Projects: Desktop Chrome and Mobile Chrome (Pixel 7).
  - `e2e/student-journey.spec.ts`:
    - **S1 (Home & GapMap):** Student login as Meera (`DEMO7A / meera / 333333`), lands on `/home`, verifies Daily Quest, Continue Learning card, GapMap with 14 skills, opens concept evidence drawer ("Why this status?", "Measurement reliability"), and closes modal.
    - **S2 (Session Loop & Gentle Copy):** Student login as Aarav (`DEMO7A / aarav / 121212`), launches `/session`, verifies AnswerPad, inputs incorrect answer `9`, verifies "not yet!" feedback without negative wording ("wrong", "failed"), tests hint ladder rung 1, and tests worked example drawer.
    - **S3 (Consent Gating):** Student login as Kabir (`DEMO7A / kabir / 444444`), attempts to start learning session, verifies blocked by consent gate with helpful message directing student to parent consent form.
- **Verification Gate Integration:**
  - Added `pnpm test:e2e` to `package.json` `"verify"` script, satisfying Phase 6 onward requirement for automated Playwright execution.

### Verification Results

- `pnpm verify`: 100% passed (typecheck, lint, format:check, content:check, db:migrate, db:seed, vitest unit tests, standalone build, and Playwright E2E tests).
- E2E Tests: **6 tests passed across Desktop Chrome and Mobile Chrome (3.5s)**.
- Vitest Unit Tests: **31 test files, 209 tests passed**.
- Real PostgreSQL 16 health check: `GET /api/v1/health` returned HTTP 200 `{"status":"ok","db":"ok","llm":"disabled","version":"0.1.0"}`.
- Next.js build: Turbopack standalone compilation in 730ms.

### Assumptions

- Standalone Next.js server serves static assets after copying `.next/static` into `.next/standalone/apps/web/.next/static`.
- Cookie security flag is relaxed in non-HTTPS testing mode when `PLAYWRIGHT_TEST=1` is set.
- Meera (`DEMO7A / meera / 333333`) serves as the primary demo inspection account; Aarav (`DEMO7A / aarav / 121212`) practices active attempts; Kabir (`DEMO7A / kabir / 444444`) tests parent consent gating.

---

## 2026-11-14 — Phase 7: Adaptive Learning Intelligence, Diagnostic Engine, Misconception Detection & Remediation

### Built

- **Workstream A: Diagnostic Assessment Engine (`packages/domain/src/diagnostic.ts`):**
  - `createDiagnostic`: Initializes diagnostic probe at grade entry point (`Grade 6 -> MATH-FRAC-PART`, `Grade 7 -> MATH-FRAC-EQUIV`, `Grade 8 -> MATH-FRAC-ADDUNLIKE`), skipping concepts with existing sufficient evidence.
  - `stepDiagnostic`: Adaptive DAG traversal:
    - On correct response: advances downstream along topological order to assess higher-level skills.
    - On incorrect response: steps back to unassessed foundational prerequisite to identify root knowledge gaps.
    - Bounded by max items (default 7 items) and terminates gracefully when frontier is resolved.
  - `projectDiagnosticBeliefs`: Computes student knowledge gap map (`gaps` -> `needs_support`, `strengths` -> `developing`, untested -> `not_assessed`) with measurement reliability.
  - Persists diagnostic session state in `session.counters.diagnosticState` for interrupted session recovery.
  - On diagnostic completion: updates `concept_beliefs`, sets `studentState.focusConceptId` and `startConceptId` to `recommendedStartConceptId`, and marks session completed.

- **Workstream B: Misconception Detection & Confidence Tracking (`packages/domain/src/misconception-tracker.ts`):**
  - `detectMisconception`: Multi-candidate pattern matching combining explicit template predictions and domain arithmetic heuristics (`detectHeuristicMisconceptions`).
  - Strict evidence accumulation and confidence tiers:
    - 1 evidence: `low` (hypothesis, never treated as definitive proof).
    - 2 occurrences: `medium` (recurring pattern identified).
    - 3+ occurrences: `high` (systematic misconception confirmed).
    - Returns `unclassified` for unrecognized errors.
  - `reconcileActiveMisconceptions`:
    - Clears active misconceptions upon independent success.
    - Promotes to `activeMisconceptionIds` in `concept_beliefs` when recurring (`medium` or `high`).

- **Workstream C: Adaptive Activity Selector (`packages/domain/src/policy/adaptive-selector.ts`):**
  - `selectAdaptiveActivity`: Next-activity decision engine accounting for current belief status, prerequisite readiness, recent attempt history, active misconceptions, and template exposure history (filtering out the last 3 templates).
  - Target difficulty calibration (difficulty 1 for struggle/scaffolding, difficulty 2 for standard practice, difficulty 3 for challenge/high mastery).
  - Selects teaching actions: `INDEPENDENT_PRACTICE`, `REVIEW_PREREQUISITE`, `EXPLAIN`, `WORKED_EXAMPLE`, `RETRIEVAL_REVIEW`, and `ADVANCE`.

- **Workstream D: Targeted Pedagogical Remediation (`packages/domain/src/policy/adaptive-selector.ts`, `apps/web/server/session/engine.ts`):**
  - `getRemediationRouteForMisconception`: Maps specific misconceptions to pedagogical routes:
    - Spatial and denominator misconceptions (e.g. `MC-ADD-ACROSS`, `MC-PART-RATIO`, `MC-BIGGER-DENOM`) -> `picture` route with SVG visual models (fraction bars, number lines, area models).
    - Algorithmic and procedural misconceptions (e.g. `MC-EQUIV-ADDITIVE`, `MC-MIXED-ADD-PARTS`, `MC-SUB-ACROSS`) -> `steps` route.
    - Conceptual meaning misconceptions -> `everyday` route.
  - Escalation ladder: first struggle triggers targeted `EXPLAIN` with visual models; repeated struggle escalates to `WORKED_EXAMPLE`.
  - INVARIANT §3 strictly preserved: viewing explanations and worked examples awards 0 sparks and never promotes mastery status.

- **Workstream E & F: Student Experience Integration & API (`apps/web/`):**
  - `SessionPlayer.tsx`:
    - Full support for `kind: "explanation"` steps rendering visual models, explanation body, route badge, and "I understand! Try a question →" action.
    - Full support for `kind: "worked_example"` steps rendering step-by-step breakdown and final result.
    - Misconception tips in feedback banners offering helpful guidance (never "wrong" or "failed", per INVARIANT §9 & §10).
  - API endpoint: `POST /api/v1/sessions/[sessionId]/advance` to smoothly transition from remediation steps to follow-up practice items.
  - `home/page.tsx`: Added "Take Diagnostic Check" action alongside "Continue Learning" to launch grade-level diagnostic assessment.
  - `session/page.tsx`: Added `mode: "diagnostic"` support.
  - Interrupted session recovery: `GET /sessions/{id}` seamlessly resumes active sessions (both learn and diagnostic).

- **Testing Suite:**
  - `packages/domain/src/diagnostic.test.ts`: 6 unit tests for diagnostic initialization, DAG traversal, step back, and belief projection.
  - `packages/domain/src/misconception-tracker.test.ts`: 6 unit tests for template matching, heuristic detection, evidence accumulation, and reconciliation.
  - `packages/domain/src/policy/adaptive-selector.test.ts`: 7 unit tests covering all adaptive activity decisions.
  - `apps/web/server/session.test.ts`: 13 comprehensive integration tests including end-to-end diagnostic session and adaptive remediation with advance step.
  - `apps/web/e2e/student-journey.spec.ts`: Scenario S4 testing diagnostic launch, DAG adaptation, and question rendering in Playwright (both desktop and mobile).

### Verification Results

- `pnpm verify`: 100% green exit code 0.
- Unit & integration tests: **34 test files, 230 tests passed**.
- Playwright E2E: **8 tests passed across Desktop and Mobile Chromium**.
- Content validation: `content:check` verified 42 templates across 500 seeds each.
- Database: PostgreSQL 16 verified healthy; migrations and seeds idempotent.
- Next.js build: Standalone production build compiled successfully.

## 14 Nov 2026 — Phase 8: Context-Aware AI Maths Tutor

**Commit Goal:** Implement a context-aware, curriculum-grounded AI maths tutor that understands student learning situations and guides reasoning without leaking answers, complete with progressive disclosure, visual model integration, deterministic fallback when LLM is disabled, and full session-scoped persistence.

### Built in this Milestone

- **Workstream A: Server-Side Tutor Context Engine (`apps/web/server/tutor/context.ts`):**
  - Implemented `TutorContextBuilder` (`buildTutorContext`) strictly scoped to authenticated student and active session.
  - Minimal context assembly: current concept, prerequisite hierarchy from `EDGES`, weak prerequisites, active question metadata, forbidden canonical answer strings (for leak prevention), recent attempt history, active misconceptions, curriculum explanations (`EXPLANATIONS`), current belief estimate, and revealed hints count.
  - Defense in depth: untrusted student input is fenced within `<student_text>` to prevent prompt injection.

- **Workstream B & F: Conversational Tutor & UI Panel (`apps/web/components/session/TutorPanel.tsx`, `SessionPlayer.tsx`):**
  - Responsive, non-intrusive collapsible drawer integrated into `SessionPlayer.tsx`.
  - Distinguishes tutor guidance clearly from independent answer submission on the AnswerPad.
  - Quick action chips for high-frequency student intents:
    - `💡 Give me a hint` (progressive hint disclosure)
    - `❓ Why was I not yet?` (misconception-aware clarification shown after incorrect attempts)
    - `🔄 Explain differently` (cycles everyday/picture/step explanations)
    - `🖼️ Show visual` (displays structured visual models like fraction bars and number lines)
    - `📖 Show example` (worked examples with alternate numbers)
  - Free-text input field with remaining turns badge (enforcing 10 turns per session limit).
  - Inline rendering of visual models inside tutor message bubbles via `VisualViewer`.

- **Workstream C: LLM Provider Abstraction (`packages/ai`):**
  - Defined `LLMProvider` interface in `packages/ai/src/types.ts` supporting `generate<T>` with Zod schema validation and `moderate(text)` per SPEC §21.
  - `OpenAiProvider`: Server-side only, configurable model (`LLM_MODEL_TUTOR`), endpoint (`OPENAI_BASE_URL`), timeout handling via `AbortSignal`, and structured JSON mode.
  - `MockProvider`: Deterministic responses with explicit fault injection modes (`leaks_answer`, `timeout`, `error`, `refused`, `invalid_json`, `moderation_flagged`, `too_long`, `off_topic`).
  - `DisabledProvider`: Fallback provider returning `{ ok: false, reason: "disabled" }`.
  - Provider factory `getLlmProvider()` instantiating based on `readAiEnv()`.

- **Workstream D & E: Pedagogical Response Policy & Deterministic Fallback (`apps/web/server/tutor/policy.ts`, `service.ts`):**
  - Progressive hint ladder: small nudge (Hint 1) -> targeted step (Hint 2) -> near-complete step (Hint 3) -> worked example.
  - Misconception remediation: automatically surfaces `studentFeedback` from `MISCONCEPTIONS` in `@gaps/content`.
  - Visual models: dynamically supplies validated `VisualSpecDto` structures.
  - Deterministic fallback: when `LLM_PROVIDER=disabled` or generation fails/leaks, curriculum content answers student queries without breaking the session loop.
  - Invariant §3 strictly preserved: tutor interactions NEVER award sparks, mutate beliefs, or change quest status.

- **Workstream G & H: Safety, Privacy, Cost Controls & Persistence:**
  - `scrubPii`: Strips email addresses, Indian & international phone numbers, URLs, and school roster names with `[removed]`.
  - `checkAnswerLeak`: Scans tutor messages for numeric tokens and fractions matching the question's canonical answer; rejects leaks before reaching the student.
  - Word count guard: limits responses to <= 90 words.
  - Session-level turn limits: max 10 assistant turns per learning session.
  - Audit logging: records metadata to `llm_calls` table without storing student prompt text or model output.
  - Persistence & Idempotency: conversation history preserved in `session.counters.tutorMessages`; duplicate submissions with the same `clientMessageId` return cached replies without incrementing counters.

- **Contracts & Routing (`packages/contracts/src/tutor.ts`, `apps/web/app/api/v1/sessions/[sessionId]/tutor/route.ts`):**
  - `TutorMessageSchema`, `TutorRequestSchema`, `TutorResponseSchema`, `TutorHistoryResponseSchema`.
  - Authenticated `GET` and `POST` route handlers enforcing core consent and student session ownership.

- **Testing Suite:**
  - `packages/ai/src/guards.test.ts`: 10 unit tests for PII scrubbing, word counting, and answer leak detection.
  - `packages/ai/src/providers.test.ts`: 8 unit tests for provider implementations and fault modes.
  - `apps/web/server/tutor.test.ts`: 10 comprehensive integration tests for context builder, progressive hints, misconception clarification, visual model returns, off-topic redirection, idempotency, student isolation, API routes, and Invariant §3 verification.
  - `apps/web/e2e/student-journey.spec.ts`: Playwright test scenario S5 verifying student tutor panel interaction, quick actions, free-text reasoning, and subsequent independent submission on desktop and mobile viewports.

### Verification Results

- `pnpm verify`: 100% green exit code 0.
- Unit & integration tests: **37 test files, 258 tests passed**.
- Playwright E2E: **10 tests passed across Desktop and Mobile Chromium**.
- Content validation: `content:check` verified 42 templates across 500 seeds each.
- Database: PostgreSQL 16 verified healthy; migrations and seeds idempotent.
- Next.js build: Standalone production build compiled successfully.

---

## Phase 9: Complete Student Journeys & Server-Side Assistance Gating (2026-11-14)

**Commit Goal:** Deliver complete end-to-end student learning journeys (Home, Learn, Play, GapMap, Solve With Me, Boss Battles, Daily Quests, Quick Check onboarding, Comeback Cards, and Active Session resume) with server-side assistance derivation and full Playwright E2E test coverage with `LLM_PROVIDER=disabled`.

### Built in this Milestone

1. **Server-Side Assistance Tracking & Invariant §3 Enforcement:**
   - Server-side tracking in `apps/web/server/tutor/service.ts` and `apps/web/server/session/engine.ts`: whenever a tutor hint, visual model, explanation, or worked example is accessed, the current item in the session is permanently marked assisted (`itemAssistance[itemId] >= 2`).
   - `processSessionAttempt` derives `assistanceLevel` directly from stored session counters/events, preventing client tampering.
   - Verified that assisted attempts cannot promote concept mastery (Invariant §3), page refresh preserves assisted status, and unassisted fresh items count as independent.

2. **Student Navigation & Layout (`Header.tsx`):**
   - Universal navigation links across desktop and mobile: `Home` (`/home`), `Learn` (`/learn`), `Play` (`/play`), `GapMap` (`/gapmap`), and `Solve With Me` (`/solve`).
   - Active route highlighting, student avatar, Sparks counter badge, and sign-out button.

3. **Chapter & Concept Browsing (`apps/web/app/learn/page.tsx`):**
   - Full curriculum browsing covering 3 chapters (Chapter A: "Meet the fractions", Chapter B: "Fraction operations", Chapter C: "Fractions in the world") and 14 concepts in topological order.
   - Distinctive status badges ("Not explored yet", "Let's work on this", "Getting there", "You can do this", "Locked in").
   - Direct launch of practice sessions for any concept.

4. **Play & Challenges (`apps/web/app/play/page.tsx`):**
   - Daily Quest card integration with progress tracking across quest slots.
   - Three Chapter Boss Battles:
     - Chapter A Boss: "The Equal Splitter" (unlocks at 4 of 7 concepts).
     - Chapter B Boss: "The Cross Multiplier" (unlocks at 3 of 5 concepts).
     - Chapter C Boss: "The Real-World Riddle" (unlocks at 1 of 2 concepts).
   - Boss session configuration: 8 items, difficulty 2, no hints (`help: []`), 1 try per item, finished award +10 sparks, win award +40 sparks ($\ge 6/8$ correct). Attempts never promote mastery.

5. **Daily Quest Completion & Sparks Idempotency:**
   - `startDailyQuestSession` starts or advances sessions bound to quest slots.
   - Completing all quest slots idempotently awards +20 sparks on `(questId, "quest")`, preserved after refresh.

6. **Onboarding & Session Continuity (`apps/web/app/home/page.tsx`):**
   - Optional 5-question Quick Check onboarding (`/api/v1/quick-check`) and "Just start learning" shortcut for new students.
   - Active session reconnect/resume banner ("Session in Progress") with 1-click continuation.
   - Celebration banner for earned Comeback Cards with dismiss action (`/api/v1/comeback-cards/[cardId]/seen`).

7. **AI-Off Guided "Solve With Me" (`apps/web/app/solve/page.tsx`, `initSolveWithMe`):**
   - Deterministic conceptual matching for common fraction questions and 6 interactive presets.
   - Surfaces structured visual models (fraction bars, number lines, division) and worked examples without invoking external LLMs.
   - Direct "Try one like it →" action initiating targeted practice on the matching concept.

8. **Session Completion Summary (`SessionPlayer.tsx`):**
   - Comprehensive end-of-session summary rendering items resolved, accuracy, Sparks earned, concepts practiced, and next recommended actions.

### Test Coverage & Verification

- **Vitest Unit & Integration Tests:** **39 test files, 266 tests passing** (100% pass rate).
- **Playwright E2E Tests (`apps/web/e2e/student-journey.spec.ts`):** **10 test scenarios, 20 test runs passing** across Desktop Chrome and Mobile Chrome (Pixel 7):
  - S1: Student login as Meera, reaches home dashboard, sees Quest & GapMap
  - S2: Active session loop with two-try rule, gentle copy, and teaching support
  - S3: Consent gating blocks student missing core consent (Kabir)
  - S4: Diagnostic assessment launches, adapts, and presents diagnostic items
  - S5: Interactive AI Maths Tutor provides progressive disclosure and concept guidance
  - S6: Navigation across Home, Learn, Play, GapMap, and Solve With Me
  - S7: Chapter and concept browsing on Learn page and launching concept practice
  - S8: Play page displays Daily Quest and Chapter Boss unlock rules
  - S9: AI-off Solve With Me guided mode provides visual models and Try One Like It
  - S10: Home page displays active session resume banner
- **Full Verification Gate (`pnpm verify`):** Passed cleanly (typecheck, lint, format:check, content:check, db:migrate, db:seed, unit tests, build, and test:e2e).

---

## Phase 10: Dynamic Teaching Vertical Slice (Maths & Science) (2026-11-15)

**Commit Goal:** Deliver the dynamic teaching vertical slice supporting versioned multi-step lesson activities for Mathematics and Science, interactive simulations (Fraction Strip & Circuit Simulator), predictive observation loops, guided practice, independent verification, and configurable topic expansion with `LLM_PROVIDER=disabled`.

### Built in this Milestone

1. **Versioned Lesson Format & Schemas (`packages/contracts/src/lesson.ts`):**
   - Defined `LessonPlanSchema` (version `"1.0"`) supporting `subject` (`"maths" | "science"`), `level` (Class 1–12), `topicId`, learning objectives, and at least 2 activities.
   - Discriminated union of 5 activity types:
     - `intro`: Headline, rich conceptual body, hook question.
     - `interactive_manipulation`: Interactive simulation workbench.
     - `predict_and_observe`: Scientific hypothesis selection, observation reveal, and live simulation verification.
     - `guided_practice`: Goal-directed manipulation against target criteria with immediate feedback.
     - `independent_check`: Multiple-choice or open input assessment with rationale.
   - Schemas for simulations: `FractionStripSimulationSchema` and `CircuitSimulationSchema`.
   - Contract test suite (`packages/contracts/src/lesson.test.ts`): 5 tests passing.

2. **Authoring & Curriculum Registry (`packages/content/src/lessons/`):**
   - Registered Class 6 Curriculum Topics for Mathematics and Science (`registry.ts`).
   - Lesson 1 (`lesson-maths-frac-part-1`): "Fractions: Fair Shares & Parts of a Whole" (5 activities).
   - Lesson 2 (`lesson-sci-circuits-1`): "Electric Current & Simple Circuits" (5 activities).
   - Lesson 3 (`lesson-sci-conductors-1`): "Conductors & Insulators: Testing Materials" (3 activities) validating zero-code configuration addition.

3. **Pluggable Lesson Planner (`apps/web/server/lesson/planner.ts`):**
   - Defined `LessonPlanner` interface with `AuthoredLessonPlanner` (static authoring) and `LlmLessonPlanner` (external AI generation with strict Zod validation).
   - Graceful fallback to subject defaults when LLM generation fails or `LLM_PROVIDER=disabled`.

4. **Lesson Session Engine & Service (`apps/web/server/lesson/service.ts`):**
   - End-to-end session lifecycle (`startOrResumeLessonSession`, `getLessonSession`, `submitLessonActivityResponse`).
   - Rule F.1 / Invariant §3 enforcement: Interactive manipulations and predictions log to the `events` table but never mutate `concept_beliefs`.
   - Idempotent Sparks award: +15 sparks awarded on `(session.id, "lesson")` upon completing the final activity.
   - Full progress persistence across page reloads (`currentActivityIndex`, `completedActivities`, `activityResponses`).
   - Integration test suite (`apps/web/server/lesson.test.ts`): 6 integration tests passing.

5. **Shared Activity Renderer & Widgets (`apps/web/components/lesson/`):**
   - `FractionStripWidget.tsx`: Interactive fraction bar with dynamic slice controls (1–16 parts), interactive toggle shading, target indicator, and fraction values.
   - `CircuitSimulatorWidget.tsx`: Interactive circuit simulator with Battery, animated switch lever, bulb filament glow, electron current loop animation, and test conductive objects (copper key vs rubber eraser).
   - `LessonActivityRenderer.tsx`: Shared renderer executing all 5 activity types.
   - `LessonPlayer.tsx`: Main lesson player with progress indicator, activity steps, feedback cards, and completion celebration.
   - Page route at `/lesson/[lessonId]` (`apps/web/app/lesson/[lessonId]/page.tsx`).

6. **Curriculum Navigation & Subject Switcher (`apps/web/app/learn/page.tsx`):**
   - Added Subject switcher for Class 6: `📐 Mathematics` and `⚡ Science`.
   - Highlights featured interactive lessons alongside existing practice chapters.

7. **E2E Test Coverage (`apps/web/e2e/student-journey.spec.ts`):**
   - Added S11: Science dynamic lesson with interactive circuit simulator, prediction, and Sparks.
   - Added S12: Mathematics dynamic lesson with fraction strip manipulation, reload resume, and verification.
   - Added S13: Purely configured topic (Conductors & Insulators) runs through shared activity renderer.

### Test Coverage & Verification

- **Vitest Unit & Integration Tests:** **41 test files, 277 tests passing** (100% pass rate).
- **Playwright E2E Tests:** **13 scenarios, 26 test runs passing** across Desktop Chrome and Mobile Chrome.
- **Full Verification Gate (`pnpm verify`):** Passed cleanly (typecheck, lint, format:check, content:check, db:migrate, db:seed, unit tests, build, and test:e2e).

## Phase 10 — Adaptive Teaching Loop & Remediation Intelligence (2026-11-15)

### 1. Scope & Objective

Implement an evidence-driven adaptive loop through the shared lesson engine for Mathematics (Fractions) and Science (Circuits):

- Detect misunderstandings on predictions or checks and branch into targeted explanations and relevant interactive activities.
- Provide a fresh follow-up question checking the exact same objective.
- Enable successful independent responses to resume linear progression while directing continued difficulty to a clear, supportive stopping point.
- Persist branch decisions and assistance status across page reloads/reconnects.
- Strictly uphold Invariant §3 and Rule F.1: Exploration, completion, or single correct responses never alter concept beliefs or fabricate mastery.

### 2. Built

1. **Contracts & Schemas (`packages/contracts/src/lesson.ts`):**
   - Added `stopping_point` activity type and `StoppingPointConfigSchema` (`headline`, `body`, `recommendation`, `keyTakeaways`).
   - Added `RemediationBranchSchema` and recursive `LessonActivitySchema` (`branchId`, `triggerCondition`, `targetedExplanation`, `remediationActivity`, `followUpCheck`, `stoppingPoint`).
   - Added `ActiveBranchStageSchema` (`"remediation_activity" | "followup_check" | "stopping_point"`) and `ActiveBranchStateSchema`.
   - Extended `LessonSessionResponse` and `LessonRespondResponse` with `activeActivity`, `activeBranch`, and `assistanceStatus`.
   - Contract test suite: added validation tests for adaptive remediation branches and stopping points (`packages/contracts/src/lesson.test.ts`).

2. **Authored Curriculum Remediation (`packages/content/src/lessons/`):**
   - **Maths (`lesson-maths-frac-part-1`):** Attached adaptive remediation branch to `act_3_predict`:
     - Targeted explanation clarifying denominator as the count of total equal pieces in one whole.
     - Remediation activity (`act_3_remediation_sim`): Interactive 4-part partition strip.
     - Fresh follow-up check (`act_3_remediation_fresh_check`): Meera eating 1 quarter of a roti (evaluates to `1/4`).
     - Supportive stopping point (`act_3_stopping_point`): "Pause & Reflect: Parts of a Whole" with key takeaways on counting total parts first.
   - **Science (`lesson-sci-circuits-1`):** Attached adaptive remediation branch to `act_3_predict`:
     - Targeted explanation explaining why electrons cannot cross the open switch air gap.
     - Remediation activity (`act_3_remediation_sim`): Interactive sandbox focusing on the air gap.
     - Fresh follow-up check (`act_3_remediation_fresh_check`): Disconnecting wire from terminal (bulb stays dark).
     - Supportive stopping point (`act_3_stopping_point`): "Pause & Reflect: Circuit Loops" reviewing closed-loop rules.

3. **Adaptive Lesson Engine Service (`apps/web/server/lesson/service.ts`):**
   - Implemented `resolveActiveActivity` mapping `activeBranch.stage` to `remediationActivity`, `followUpCheck`, or `stoppingPoint`.
   - Updated `startOrResumeLessonSession` and `getLessonSession` to restore active branch activities and assistance state on session resume/reload.
   - Enhanced `submitLessonActivityResponse`:
     - On incorrect attempt on an activity with authored remediation: triggers branch, logs `lesson_branch_triggered`, records `assistanceStatus = "assisted"`, and returns `remediationActivity` without incrementing `currentActivityIndex`.
     - Stage 1 (`remediation_activity`): logs `lesson_remediation_activity_explored` and advances branch to `followup_check`.
     - Stage 2 (`followup_check`): logs `lesson_remediation_check`. If correct, records `assistanceStatus = "remediated"`, clears `activeBranch`, and advances to next main activity. If incorrect, records `assistanceStatus = "needs_support"` and transitions to `stopping_point`.
     - Stage 3 (`stopping_point`): logs `lesson_stopping_point_acknowledged`, clears `activeBranch`, and advances to the next activity with scaffolded support.

4. **Adaptive UI & Activity Renderer (`apps/web/components/lesson/`):**
   - `LessonActivityRenderer.tsx`: Added renderer for `stopping_point` with reflection card, key takeaways bullet list, recommendation panel, and acknowledgment button. Updated `independent_check` action button labels.
   - `LessonPlayer.tsx`: Renders `activeActivity` dynamically, displays "Adaptive Support" status badge in header, provides real-time guidance banner, and tracks active branch step.

5. **Testing & Verification:**
   - `apps/web/server/lesson.test.ts`: Added 5 comprehensive integration tests covering:
     - Maths struggling-student path (incorrect prediction -> remediation sim -> incorrect fresh check -> stopping point -> completion).
     - Maths successful-student path after remediation (incorrect prediction -> remediation sim -> correct fresh check -> progression).
     - Science struggling-student path (open switch misconception -> air gap remediation -> incorrect fresh check -> stopping point).
     - Science successful-student path after air gap remediation.
     - Refresh recovery verification at each branch stage.
     - Audit proving structured evidence recording in `events` and non-fabrication of `concept_beliefs` mastery.
   - `apps/web/e2e/student-journey.spec.ts`: Added Playwright E2E scenarios S14 (Maths adaptive loop with refresh recovery) and S15 (Science adaptive loop with successful resolution).

### 3. Learner Model Evidence Status & Remaining Gap

- **Current Status:**
  - Every interaction in the adaptive lesson loop is captured as an immutable event in PostgreSQL (`events` table) with structured metadata: `lesson_prediction_submitted`, `lesson_branch_triggered`, `lesson_remediation_activity_explored`, `lesson_remediation_check`, `lesson_stopping_point_acknowledged`, `lesson_guided_practice`, and `lesson_independent_check`.
  - Invariant §3 & Rule F.1 are strictly preserved: Interactive exploration, lesson completion, and single check answers NEVER promote `concept_beliefs` to mastery.
- **Remaining Gap:**
  - In Gaps V0.1, concept mastery promotion is governed by the pure domain `beliefReducer` evaluating independent multi-template practice attempts (`attempts` table) with strict demonstration windows (e.g. 3 consecutive correct across >= 2 reviewed templates).
  - Lesson independent checks currently log evidence to `events` rather than emitting formal curriculum `attempt` records. To feed lesson checks directly into the learner model's `pMastery`, lesson assessment items will need to be bound to registered template IDs or converted to formative evidence inputs in the belief reducer pipeline.

### 4. Verification Results

- **`pnpm typecheck`:** 6/6 workspace projects passed.
- **`pnpm lint`:** 0 errors, 0 warnings.
- **`pnpm format:check`:** All files match Prettier code style.
- **`pnpm content:check`:** 42 templates verified across 500 seeds each (acyclic, distinct >= 20, zero hint leaks).
- **`pnpm test` (`vitest`):** 41 test files, 283 tests passed (100% pass rate).
- **Line coverage:** `packages/domain` line coverage >= 93.7%.
- **`pnpm test:e2e` (`playwright`):** 15 scenarios, 30 tests passed across Desktop Chrome and Mobile Chrome.

## Cross-Session Lesson Evidence Routing & Next Action on Return (2026-11-15)

### 1. Built

1. **Assessed Objectives to Stable Concept IDs (`packages/content/`, `packages/contracts/`, `packages/domain/`):**
   - Maths: Mapped to stable `MATH-FRAC-PART`.
   - Science: Defined stable concept IDs `SCI-ELEC-CIRCUITS` and `SCI-ELEC-CONDUCTORS` in `CONCEPT_IDS` (`packages/domain/src/types.ts`) and `ConceptIdSchema` (`packages/contracts/src/domain.ts`).
   - Created `packages/content/src/science.ts` exporting `SCIENCE_CHAPTERS` (`SCI-ELEC`) and `SCIENCE_CONCEPTS` (`SCI-ELEC-CIRCUITS`, `SCI-ELEC-CONDUCTORS`), synced via `packages/db/src/content-sync.ts`.
   - Added 3-route explanations (picture, everyday, steps) for `SCI-ELEC-CIRCUITS` and `SCI-ELEC-CONDUCTORS` in `packages/content/src/explanations.ts`.
   - Wired `conceptId` into lesson configurations in `sci-circuits.ts`, `sci-conductors.ts`, and `maths-frac-part.ts`.

2. **Authoritative Learner Model Pipeline Integration (`apps/web/server/lesson/service.ts`):**
   - Implemented `recordLessonAssessment`:
     - Checks idempotency on `(sessionId, clientAttemptId)`.
     - Calls `findOrCreateItemInstance` ensuring valid `item_instances` with stable `templateId` and `conceptId`.
     - Calls `studentRepo.recordAttempt` preserving question identity, template identity, answer correctness, timestamp, and server-determined assistance level.
     - Runs authoritative `replayTransitions` from pure domain `beliefReducer` across all student attempts for the concept.
     - Calls `studentRepo.upsertConceptBelief` to persist verified `status`, `pMastery`, `attemptsCount`, and `history`.
     - Awards +20 mastery Sparks if belief status newly reaches `"demonstrated"`.

3. **Mastery Rules & Assistance Integrity:**
   - Reconciled colloquial "3 consecutive correct" with authoritative SPEC §9 & `packages/domain/src/belief.ts`: requires in last 4 independent attempts $\ge 3$ correct, latest 2 correct, spanning $\ge 3$ distinct items, $\ge 2$ distinct templates (if available), and `assistance = 0`.
   - Remediation follow-up checks (`stage === "followup_check"`) are explicitly recorded with `assistanceLevel = 1` (assisted learning). They never enter independent evidence and cannot establish mastery.
   - Independent checks (`act_5_check`) are evaluated with `assistanceLevel = 0`.

4. **Stopping Point "Save & Finish for Now" & Continued Practice:**
   - Enhanced `stopping_point` activity renderer with two distinct choices:
     - "Save & Finish for Now": sets `stoppingPointSaved: true` and redirects smoothly to `/learn`.
     - "Acknowledge & Continue": clears branch and allows continued practice.
   - Resuming a saved stopping point returns the student directly to their saved stopping point with state intact.

5. **Evidence-Based Next Action on Return (`/api/v1/curriculum/next-action`):**
   - Implemented deterministic explicit recommendation rules:
     - `revisit_unresolved`: struggling student who paused at a stopping point or ended with `needs_support`.
     - `fresh_check`: student who succeeded in supported remediation (`remediated`) but hasn't demonstrated independent mastery yet.
     - `continue_next_objective`: student who has demonstrated mastery.
     - `start_objective`: default starting path.
   - Surfaced responsive Next Action card on `/learn` with one-click direct jump back into the appropriate lesson or check.

6. **End-to-End Tests & Verification:**
   - Added 5 integration tests in `apps/web/server/lesson.test.ts` (Tests 12–16) verifying:
     - Struggling student pauses at stopping point, saves & finishes, sees `revisit_unresolved` on return, and reliably resumes.
     - Supported remediation success does not establish mastery (`assistanceLevel = 1`).
     - Sufficient independent evidence (3 correct across 2 templates) promotes belief to `demonstrated`, awards +20 Sparks, and suggests `continue_next_objective`.
     - Duplicate submissions with identical `clientAttemptId` do not double-count.
     - Both Maths and Science work through the shared learner model pipeline.
   - Added Playwright E2E Scenario S16 in `apps/web/e2e/student-journey.spec.ts`.

### 2. Verification Results

- **`pnpm typecheck`:** 6/6 workspace packages passed cleanly (0 errors).
- **`pnpm lint`:** 0 errors, 0 warnings.
- **`pnpm format:check`:** All files match Prettier code style.
- **`pnpm content:check`:** 42 templates verified across 500 seeds each.
- **`pnpm db:migrate && pnpm db:seed`:** Migrations and seed data applied cleanly.
- **`pnpm test` (`vitest`):** 41 test files, 288 tests passed (100% pass rate).
- **Line coverage:** `packages/domain` line coverage >= 93.7% (exceeds >= 90% requirement).
- **`pnpm test:e2e` (`playwright`):** 16 scenarios, 32 tests passed across Desktop Chrome and Mobile Chrome.
- **`pnpm verify`:** All gates passed cleanly.

---

## 2026-11-15 — Model-Planned Teaching Preview, Multi-Stage Validation, and Science Mastery Demonstration

### 1. Built

1. **Science Evidence Threshold via UI Lessons:**
   - Authored distinct assessment templates and items for Science:
     - `tpl_sci_circuits_continuity`: Item 1 (`itm_sci_circuits_continuity_1`, loop continuity) in `lesson-sci-circuits-1`, and Item 2 (`itm_sci_circuits_continuity_2`, open switch air gap) in `lesson-sci-circuits-mastery`.
     - `tpl_sci_circuits_breaks`: Item 3 (`itm_sci_circuits_breaks_1`, circuit break detection) in `lesson-sci-circuits-mastery`.
   - Wired deterministic seed calculation in `recordLessonAssessment` to avoid database unique constraint collisions on `(templateId, templateVersion, seed)`.
   - Enabled students to progress from introductory simulation to mastery assessment across 2 templates, reaching the authoritative evidence threshold ($\ge 3$ distinct items, $\ge 2$ templates, 0 assistance) to achieve `demonstrated` status, record a `mastery_demonstrated` event, award +20 Sparks to `sparks_ledger`, and update the Next Milestone to Conductors & Insulators.

2. **Developer-Only Lesson-Planning Preview (`/dev/lesson-planner`):**
   - Built a developer-only lesson generation interface for Class 6 Maths and Science objectives:
     - Objectives supported: `MATH-FRAC-PART`, `MATH-FRAC-EQUIV`, `SCI-ELEC-CIRCUITS`, `SCI-ELEC-CONDUCTORS`.
     - Synthetic learner profiles: `new_learner`, `struggling` (with named misconceptions: `REVERSAL`, `WHOLE_PART_CONFUSION`, `AIR_GAP`, `CURRENT_CONSUMPTION`), and `ready_for_challenge`.
   - Curated Source Pack (`apps/web/server/lesson/planner-source-pack.ts`):
     - Pedagogical objectives, prerequisite chains, grounded domain metaphors, and strict simulation parameter bounds.
     - Formal activity catalogue defining schemas and parameters for all 5 activity types (`concept_intro`, `interactive_simulation`, `predict_and_observe`, `guided_challenge`, `independent_check`).
   - Multi-Stage Validation Architecture (`apps/web/server/lesson/planner-validator.ts`):
     - Stage 1: Structural Zod schema validation (`schemaValid`).
     - Stage 2: Factual and simulation integrity validation (`factualValid`), strictly validating parameter bounds (parts $\le 12$, shaded $\le$ parts, valid switch/conductor states, valid answer choices, single correct choice).
     - Stage 3: Pedagogical match validation (`pedagogicalMatch`), verifying that struggling profiles include tailored remediation addressing the specific misconception, and challenge profiles offer multi-step rigor without unnecessary hand-holding.
     - Strict separation: schema validation alone is never presented as factual validation.
   - Live Sandboxed Lesson Player:
     - Sandboxed mode in `<LessonPlayer isPreview={true} />` using client-side deterministic response evaluator `evaluatePreviewActivityResponse`.
     - Complete testbed isolated from production student DB tables.
   - Fallback Guarantee:
     - When `LLM_PROVIDER=disabled` or during provider failures/timeouts, `LlmLessonPlanner` transparently falls back to authored lesson configurations, recording audit metadata (`model`, `latencyMs`, `validationOutcome`, `fallbackReason`) without logging student PII.

3. **Automated Testing & E2E Acceptance:**
   - Added unit and integration tests (Tests 17–20) in `apps/web/server/lesson.test.ts`:
     - Test 17: Science evidence threshold achieved through authored UI lessons.
     - Test 18: Multi-stage validator correctly distinguishes structural schema validity from factual & simulation integrity.
     - Test 19: Planner outputs materially distinct lesson sequences for struggling vs challenge profiles.
     - Test 20: Planner fallback guarantees authored lesson when LLM fails or is disabled without logging student PII.
   - Added Playwright E2E Scenarios (S17 & S18) in `apps/web/e2e/student-journey.spec.ts`:
     - S17: Science student completes Circuit Simulator, takes Mastery Assessment across 2 templates, and demonstrates mastery (+20 Sparks and Next Milestone advancement).
     - S18: Developer opens `/dev/lesson-planner`, selects profile and objective, generates plan, inspects multi-stage validation badges, and interacts with preview player.
   - Seeded test students `rohan` (Desktop) and `priya` (Mobile) with automated test-evidence isolation to ensure deterministic E2E runs.

### 2. Verification Results

- **`pnpm typecheck`:** 6/6 workspace packages passed cleanly (0 errors).
- **`pnpm lint`:** 0 errors, 0 warnings.
- **`pnpm format:check`:** All files match Prettier code style.
- **`pnpm content:check`:** 42 templates verified across 500 seeds each.
- **`pnpm db:migrate && pnpm db:seed`:** Migrations and seed data applied cleanly.
- **`pnpm test` (`vitest`):** 41 test files, 292 tests passed (100% pass rate).
- **Line coverage:** `packages/domain` line coverage >= 93.7%.
- **`pnpm test:e2e` (`playwright`):** 18 scenarios, 36 tests passed across Desktop Chrome and Mobile Chrome.
- **`pnpm verify`:** All gates passed cleanly.

### 3. Assumptions & Limitations

- **LLM Provider Isolation:** The project remains in `LLM_PROVIDER=disabled` mode by default. The preview planner safely executes in fallback mode using curated high-fidelity profile fixtures matching the exact versioned lesson schema.
- **Student Data Isolation:** The developer preview generates transient plans that execute entirely in-memory and do not create rows in `learning_sessions`, `attempts`, or `concept_beliefs`.
- **Factual Validation Scope:** The factual validator enforces domain-specific simulation invariants (e.g., maximum initial partition count $\le 12$, shaded parts $\le$ total parts, valid switch and conductor states). Additional complex mathematical domain verification will expand as new activity types are introduced.

---

## 2026-11-16 — Next-Step Adaptive Teaching Engine, Server Policy Envelope, and Visible Comparison

### 1. Built

1. **Shared Teaching Decision Interface & Schema (`packages/contracts`, `apps/web/server/teaching/types.ts`):**
   - Defined `LessonTeachingActionSchema` with supported actions: `explain`, `demonstrate`, `explore`, `guided_practice`, `independent_check`, `revisit_prerequisite`, `advance`, `pause`.
   - Defined `TeachingDecisionInputSchema` accepting: current objective, prerequisites, recent assessed responses with assistance levels and error metadata, previously delivered activities, curated reviewed source material, available activity types, and remediation cycle counts.
   - Defined `TeachingDecisionOutputSchema` delivering: next teaching action, validated `LessonActivity` configuration, `TeachingDecisionEvidence` (rationale, eligible actions, inferred misconception, ambiguity flag), next assessment target, and audit telemetry.
   - Defined `TeachingDecisionTraceEntrySchema` and `TeachingEngineTraceResponseSchema` for developer comparisons.

2. **Policy Separation from Model Suggestions (`TeachingPolicyEngine` in `apps/web/server/teaching/policy.ts`):**
   - Server-Authoritative Envelope: Server determines eligible actions and transition prerequisites; model/authored engines can only select and configure activities within those strict bounds.
   - Mastery Gating: Strict invariant that models cannot declare mastery or trigger progression; `advance` is eligible _only_ when the student has demonstrated $\ge 2$ consecutive distinct correct unassisted items on the objective.
   - Ambiguous vs Definite Misconceptions: Implemented `evaluateErrorMisconception`. Definite misconceptions (`REVERSAL`, `WHOLE_PART_CONFUSION`, `AIR_GAP`, `CURRENT_CONSUMPTION`) trigger targeted interventions; ambiguous or unclassified errors trigger diagnostic probes (`independent_check` with targeted diagnostic choices). Definite misconceptions are never inferred from ambiguous errors.
   - Bounded Remediation: Policy tracks remediation cycles. If a student encounters repeated difficulty ($\ge 2$ remediation cycles), the server policy forces `eligibleActions = ["pause"]` with a genuine save-and-pause stopping point and takeaway summary.

3. **Authored Deterministic Decision Engine (`AuthoredTeachingDecisionEngine` in `apps/web/server/teaching/authored-engine.ts`):**
   - Fully deterministic implementation of `TeachingDecisionEngine` requiring zero external network or AI provider calls.
   - Supports Class 6 Fractions (`MATH-FRAC-PART`) and Circuits (`SCI-ELEC-CIRCUITS`).
   - Implements targeted interventions:
     - Numerator/denominator confusion (`REVERSAL`) -> targeted fraction manipulation lab.
     - Continued confusion -> alternative explanation ("Denominator Down Rule") or simpler visual tasks.
     - Open switch air gap misconception (`AIR_GAP`) -> targeted circuit experiment contrasting open switches against conductors.
     - Ambiguous errors -> 2-choice diagnostic check.
     - Bounded difficulty -> pause activity with key takeaways and reassuring "not yet" student copy.

4. **Model Teaching Decision Engine & AI Gateway (`LlmTeachingDecisionEngine` in `apps/web/server/teaching/llm-engine.ts`):**
   - AI Gateway Integration: Adheres strictly to `isAiRuntimeEnabled()`, PII scrubbing via `scrubPii`, and zero student PII sent to LLM.
   - Verification Pipeline: Verifies model output against Zod schema, checks that chosen action is strictly within server-allowed `eligibleActions`, and runs factual simulation parameter bounds (`validateActivityFactualRules`).
   - Tags output with `unverifiedExplanatoryProse: true` to prevent unreviewed model prose from masquerading as verified content.
   - Deterministic Fallback: Automatically falls back to `AuthoredTeachingDecisionEngine` for the _same_ objective on any provider failure, timeout, schema violation, or disabled provider setting.

5. **Session Durability & Refresh Recovery (`apps/web/server/lesson/service.ts`):**
   - Enhanced lesson session state persistence: saves `counters.activeActivity` at every branch transition and activity completion in `learning_sessions.counters`.
   - On refresh, resume, or reconnect, `startOrResumeLessonSession` reads `activeActivity` from persisted session state, preventing activity re-generation or premature advancement.
   - Preserves assistance provenance across reload and grading.

6. **Visible Comparison Trace UI (`/dev/lesson-planner`):**
   - Built a developer-only side-by-side comparison dashboard outside the student interface (`tab-view-teaching-trace`):
     - Compares two synthetic learners through the **same starting objective**:
       - Learner A (Struggling): Initial Exploration → Misconception Error (`REVERSAL`/`AIR_GAP`) → Targeted Manipulation Lab → Ambiguous Error → Diagnostic Probe Check → Continued Difficulty → Alternative Explanation → Bounded Remediation Pause.
       - Learner B (Succeeding): Initial Exploration → Unassisted Check 1 (Correct) → Distinct Unassisted Check 2 (Correct) → Server-Authorized Advance.
     - Displays server envelope badges, rationale, misconception tags, diagnostic badges, and interactive "Preview Activity" buttons mounting each step in the sandboxed preview player.

7. **Automated Testing & E2E Acceptance:**
   - Added unit test suite `apps/web/server/teaching.test.ts` (16 passing tests):
     - Tests policy bounds, mastery gating, ambiguous error handling, bounded remediation loop capping at pause, authored paths for fractions & circuits, LLM validation & fallback, and synthetic comparison traces.
   - Added Playwright Scenario S19 in `apps/web/e2e/student-journey.spec.ts`:
     - Verifies side-by-side teaching trace comparison in `/dev/lesson-planner`, tab navigation, server envelope enforcement, misconception detection, ambiguous diagnostic probe activation, pause boundary, and live step activity preview.

### 2. Verification Results

- **`pnpm typecheck`:** All 6 workspace packages passed cleanly (0 errors).
- **`pnpm lint`:** 0 errors, 0 warnings across all packages.
- **`pnpm format:check`:** All files match Prettier code style.
- **`pnpm content:check`:** 42 templates verified across 500 seeds each (all acyclic, $\ge 20$ distinct items).
- **`pnpm db:migrate && pnpm db:seed`:** Database migrations and seeded demo cohort applied idempotently.
- **`pnpm test` (`vitest`):** 42 test files, 308 tests passed (100% pass rate).
- **`pnpm test:e2e` (`playwright`):** 19 scenarios, 38 tests passed across Desktop Chrome and Mobile Chrome.
- **`pnpm verify`:** All commit gates passed cleanly end-to-end.

### 3. Assumptions & Limitations

- **Authoritative Server Envelope:** The LLM is restricted to selecting and configuring activities within the server's pre-computed `eligibleActions`. It cannot declare mastery or modify learner beliefs.
- **Fallback Policy:** With `LLM_PROVIDER=disabled` (the project default), the system runs completely deterministically using `AuthoredTeachingDecisionEngine`, providing full curriculum coverage for fractions and circuits without external dependencies.
- **Explanatory Prose Tagging:** Model-generated explanations are explicitly marked with `unverifiedExplanatoryProse: true` so the client UI and audit logs differentiate between deterministically verified simulation rules and unvetted generative prose.

---

## 2026-11-16 — Teaching Engine Drives Persisted Sessions; Advancement Reconciled with the Belief Reducer (Clau)

Starting point: `e62b296561550d62a9f70f2ebdc8525b47040aae` (Gem's handoff commit), branch
`codex/clau-teaching-engine`. Baseline `pnpm verify` on a fresh device passed before any change:
308 unit/integration tests (42 files), 38 browser tests, 42 templates in `content:check`.

### 1. Findings on the two acceptance questions

- **A. The engine did not drive real sessions.** `apps/web/server/teaching/*` was imported only by the
  two `/api/v1/dev/teaching-engine/*` routes and the comparison. `lesson/service.ts` walked a fixed
  authored plan; the saved `activeActivity` came from that plan, not from a decision.
- **B. Advancement bypassed the belief reducer.** `TeachingPolicyEngine` made `advance` eligible after
  two consecutive unassisted correct answers on two activity ids, and the authored `advance` activity
  told the learner "Mastery Demonstrated". The canonical rule (SPEC §9 / §19.4) needs 3 of the last 4
  independent attempts correct, the latest 2 correct, on 3 distinct items across 2 templates. The
  authored engine also issued the same question under new ids (`itm_maths_check_<step>`), so "distinct
  items" were not distinct. The two never met only because the engine was not wired to real sessions.

### 2. Built

1. **Reconciled policy (`teaching/policy.ts`, `TEACHING_POLICY_VERSION = "teaching-rules-1.1"`).**
   - The two-answer rule is kept as a within-lesson signal (`lessonStage:
"ready_for_demonstration_check"`): guided practice stops being eligible and a further independent
     check follows. It never advances the objective.
   - `advance` is eligible only when `objectiveStatus` (new input, the belief reducer's stored
     status) is `demonstrated` or `retained`. With no status supplied, `advance` is never eligible.
     The policy does not restate or change the reducer's thresholds; `packages/domain` is untouched.
   - Teaching steps are now sequenced from delivered activities (first check after the opening
     exploration; guided task after a targeted exploration; supported check after support; a
     walkthrough when the learner continues after a pause), so real sessions cannot loop on one action.
   - Diagnostic probes are asked at most once per lesson, never count toward a streak, and a missed
     probe is treated as a conceptual gap. Remediation stays bounded at 2 cycles, then `pause`.
   - When no unused authored check remains and the objective is not demonstrated, the lesson closes
     without advancing (`lessonStage: "consolidating"`).
2. **Authored item bank (`teaching/item-bank.ts`, `adaptive-items-1.0`).** 8 distinct assessed
   questions across 2 templates plus 1 diagnostic probe for each of `MATH-FRAC-PART` and
   `SCI-ELEC-CIRCUITS`. Distractors carry teaching-level misconception tags; untagged distractors are
   ambiguous and trigger the probe. Only `PART_RATIO` maps to a canonical id (`MC-PART-RATIO`) and is
   written to `attempts.misconception_id`.
3. **Sequencer (`teaching/sequencer.ts`).** Pure step logic shared by real sessions and the developer
   comparison: builds the decision input, calls the engine, enforces the server envelope, fixes the
   assistance level at delivery, grades responses. Any engine exception, out-of-envelope action,
   schema/type/factual failure falls back to the authored decision for the same objective. Assessed
   questions, `advance` and `pause` always use authored content, whichever engine chose the action.
4. **Persisted engine-driven sessions (`teaching/adaptive-session.ts`, `teaching/adaptive-lessons.ts`).**
   Lessons `lesson-maths-frac-part-adaptive` and `lesson-sci-circuits-adaptive` run through the existing
   lesson endpoints, `learning_sessions` (mode `lesson`) and player. Each decided step is stored with
   its full activity snapshot, assistance level, policy/engine/item-bank versions and decision evidence
   before it is returned; start and respond write the session, attempt, belief, events and a
   `decision_traces` row in one transaction. Refresh returns the stored step. A resubmitted step returns
   the stored result; the attempt key is one per step (`att_<session>_s<seq>`); concurrent submissions
   are resolved by the unique attempt key plus a guarded step-count update. Beliefs change only through
   `recordLessonAssessment` and the belief reducer. Diagnostic probes and teaching steps are events only.
5. **Server-graded checks (Non-negotiable 8).** Lesson responses previously contained every check's
   `correctAnswer`, and the player graded locally. Student-facing activities are now redacted
   (`lesson/redact.ts`, `serverGraded: true`) for adaptive AND fixed authored lessons; the player
   submits first and shows the server's verdict. The developer preview keeps local grading.
6. **Developer trace.** `decision_traces` (previously unused) now holds one row per real-session
   decision via new principal-scoped repo methods `recordDecisionTrace` / `listDecisionTraces`. The
   `/dev/lesson-planner` comparison replays the same sequencer with the real belief reducer and shows
   belief status, lesson stage, assistance level and the synthetic answer for every step.
7. **Entry points.** "Step-by-Step Lesson" buttons on Learn for fractions and circuits. The next-action
   banner returns a learner to their adaptive session when that is where they paused.

### 3. Verification Results (this device, local PostgreSQL 16.16, `LLM_PROVIDER=disabled`)

- **`pnpm verify`:** passed end to end on the final code.
- **`pnpm typecheck` / `pnpm lint` / `pnpm format:check`:** clean.
- **`pnpm content:check`:** 42 templates verified across 500 seeds each.
- **`pnpm db:migrate && pnpm db:seed`:** applied cleanly. No new migration.
- **`pnpm test`:** 43 files, 330 tests passed (was 42 / 308).
  - `apps/web/server/adaptive-lesson.test.ts` (new, 16 tests): succeeding and struggling journeys in
    both subjects against PostgreSQL, refresh/retry/concurrency, assistance provenance, invalid
    answers, student scoping, returning learners, engine failure / disabled provider / rogue engine,
    corrupt state, fixed-lesson redaction, participation-is-not-evidence.
  - `apps/web/server/teaching.test.ts`: 22 tests (was 16).
- **`pnpm test:e2e`:** 23 scenarios, 46 tests passed on Desktop Chrome and Mobile Chrome (was 19 / 38).
  New S20–S23 drive the adaptive lessons in the browser for both learners in both subjects.

### 4. Tests changed, and why

- `teaching.test.ts` "authorizes advance when student demonstrates sufficient independent evidence"
  asserted `advance` after two correct answers. That is the behaviour acceptance question B asked to
  reconcile. It is replaced by tests asserting that two answers do NOT advance, that advance requires
  the reducer's status, and that a missing status never advances.
- The two comparison tests and browser scenario S19 asserted step positions of the old hand-scripted
  trace (advance at step 3). They now assert the full real sequence (advance at step 5 for the
  succeeding learner, after three distinct unassisted checks; nine steps ending in pause for the
  struggling learner).
- Four `Submit & Continue` clicks in S14–S17 became `check-continue-button`, because fixed lessons are
  now graded on the server before the learner continues. No assertion was removed.

### 5. Assumptions

- Engine-driven lessons were added as two new lesson ids beside Gem's fixed lessons instead of
  replacing them, because replacing them would rewrite the journeys Gem's S11–S17 verify. Which lesson
  Learn should default to is Gyan's decision.
- A check taken after support that followed the last assessed question is assisted (level 1), matching
  Gem's fixed-lesson rule. Teaching that opens a lesson before any question is not assistance.
- Diagnostic probes are not belief evidence (a 2-choice probe is too weak to count toward mastery).
- After a "not yet" answer the feedback names the idea to revisit and does not reveal the answer.
- `decision_traces.provider` stores the decision source (`authored`, `fallback`, `llm_suggested`).
- Real sessions use the authored engine only. The model engine is reachable in sessions only through
  the test-only `engine` option.

### 6. Limitations and follow-ups

- **No live-model verification.** Every result above is authored behaviour with the provider disabled.
  The fallback and envelope guards were tested with a failing engine, the disabled model engine and a
  hand-written rogue engine, not with a real provider.
- **Model engine not enabled for real sessions.** Non-negotiable 6 needs the student's `ai_free_text`
  scope and the class flag checked per request; no such gate exists in the tutor or lesson code today.
- **`/dev/lesson-planner` and `/api/v1/dev/*` have no authentication or environment gate** (existing).
  The step/compare/generate routes return authored activities including answers. Needs a decision
  before any pilot deployment.
- Only `MATH-FRAC-PART` and `SCI-ELEC-CIRCUITS` have item banks. The comparison now rejects other
  objectives (400 `UNSUPPORTED_OBJECTIVE`) instead of improvising checks.
- Item bank content has no `review.status`; Non-negotiable 10 (reviewed content in production) is not
  enforced for lessons, fixed or adaptive.
- `revisit_prerequisite` is never chosen: neither objective has a prerequisite in the bank.
- `predict_and_observe` activities still send `isExpected` (a prediction is participation, not an
  assessed item). Lesson UI strings remain hard-coded in components rather than `messages/en.json`.
- If the page is reloaded between "Submit Answer" and "Continue", the verdict text is not shown again;
  the stored result and next step are unaffected.

---

## 2026-11-16 — Adaptive Lessons as the Default Entry, Protected Developer Tools, Enforced Content Review (Clau)

Continues from `05c1ecca4dc0bbded5c2b88f380611aeff58dc7f`. Delivered as `GAPS-clau-001.zip` under the
ZIP handoff workflow (see AGENT_WORKFLOW.md); no commit, push, merge or deployment.

### 1. Built

1. **Engine-driven lessons are the primary Learn entry** for parts of a whole and simple circuits.
   - `getPrimaryLessonIdForTopic` picks the engine-driven lesson where one exists, else the topic's
     fixed lesson. `GET /api/v1/curriculum/topics` now returns, per topic, `entryLessonId`,
     `entryIsResume` and `lessonAvailable`; for a student it resumes their lesson in progress for that
     topic (fixed or engine-driven) instead of starting a second one.
   - Learn shows exactly one lesson button per topic ("Start Lesson" / "Continue Lesson"). The extra
     "Step-by-Step Lesson" and "Take Mastery Assessment" buttons and the developer link are gone.
   - Fixed lesson URLs and sessions are unchanged and still resume. Equivalent fractions and
     conductors keep their existing lessons.
   - Next-action recommendations return to the lesson in progress, else the primary lesson. The
     circuits "fresh check" now opens the engine-driven lesson rather than the fixed mastery lesson.
2. **Developer tools protected on the server** (`server/dev-tools.ts`, `server/runtime-policy.ts`).
   - `/dev/lesson-planner` is now a server component that renders the planner only when tools are
     enabled and the session cookie belongs to a staff admin; otherwise the normal 404 page.
   - All three `/api/v1/dev/*` routes call `requireDevTools`: 404 when disabled, 401 unauthenticated,
     403 for students and teachers.
   - Enabled means `NODE_ENV !== "production"` AND `DEV_TOOLS_ENABLED=true` (new variable, default
     off). Nothing enables them in production, including the browser-test flag.
3. **Enforceable lesson-content review metadata.**
   - `ContentReviewSchema` (status, version, authoredBy, reviewedBy, reviewedAt, notes). "reviewed"
     requires a named reviewer and time; "draft" must not carry them.
   - Review records on: the 4 fixed lessons, the 2 engine-driven lesson definitions, the authored
     teaching activities per objective (also the fallback for any other engine), and each of the 18
     item-bank items (`ITEM_REVIEW_RECORDS`, empty; every item falls back to draft).
   - Gate: `isContentServable`. Production refuses draft, missing, incomplete and retired records
     whatever `CONTENT_SERVE_DRAFTS` says. Outside production drafts are served unless
     `CONTENT_SERVE_DRAFTS=false`. The only production exception is the browser-test harness
     (`PLAYWRIGHT_TEST=1`, loopback `APP_BASE_URL`, `CONTENT_SERVE_DRAFTS=true`).
   - Enforced at lesson start, resume and every response for fixed and engine-driven lessons; in item
     selection (unservable items are excluded for every engine, and a check that is not a servable bank
     item is refused); and in lesson availability, which requires the definition, teaching content,
     probe and at least 3 items across 2 templates to be servable.
   - The same gate now applies to practice templates in `session/engine.ts`, which previously served
     drafts in every environment.
   - `content:check` validates lesson review records and prints how many lessons await review.
4. Lesson service errors now reach the client with their own status and code (they were all 500).
5. Real-student model calls stay off; a test asserts sessions use the authored engine even with the
   AI runtime switched on.

**Nothing was marked reviewed.** No educator has reviewed any of this content.

### 2. Verification Results (this device, PostgreSQL 16.16, `LLM_PROVIDER=disabled`)

- **`pnpm verify`:** passed on the final tree.
- **`pnpm test`:** 45 files, 355 tests (was 43 / 330). New: `content-and-dev-access.test.ts` (22),
  `packages/content/src/lessons/review.test.ts` (2), one added to `adaptive-lesson.test.ts`.
- **`pnpm test:e2e`:** 48 tests passed. 22 scenarios on Desktop and Mobile Chrome against the
  production build (44), plus 4 developer-tool tests against a development server with
  `DEV_TOOLS_ENABLED=true`.
- **`pnpm content:check`:** 42 templates; lessons: 0 reviewed, 4 awaiting review.
- **Manual check of the production build without the test flag** (with `CONTENT_SERVE_DRAFTS=true` and
  `DEV_TOOLS_ENABLED=true` set on purpose): all 6 lesson starts returned 404 `LESSON_NOT_AVAILABLE`;
  topics reported every lesson unavailable; the developer page and all 3 developer APIs returned 404
  for a staff admin, a student and an anonymous caller.

### 3. Browser journeys changed, and why

- S11, S12, S14, S15, S16 exercised the fixed lessons by clicking Learn. Learn now opens the
  engine-driven lesson, so they open the fixed lesson at its preserved URL. Their checks (grading,
  remediation, stopping point, save and resume, reload, Sparks) are unchanged. S12 also proves Learn
  shows "Continue Lesson" for a fixed lesson in progress and resumes it at the same activity.
- S17 follows the fresh-check recommendation from Learn into the engine-driven lesson and demonstrates
  mastery from one fixed-lesson answer plus two engine-driven answers across two templates.
- S20–S23 enter from Learn and assert there is one lesson per topic. S23 resumes through Learn.
- S18 and S19 moved to `e2e/dev-tools.spec.ts`: they need developer tools, which no longer exist in
  the production build. They sign in as staff admin. D1 and D2 (new) cover anonymous and student
  refusal there; S24 (new) covers refusal for everyone in the production build.

### 4. Assumptions

- "Production" is `NODE_ENV=production`. A locally built `pnpm start` therefore serves no lessons; the
  local demo is `pnpm dev`. The browser-test exception is deliberate and limited to loopback.
- A topic with a lesson in progress resumes it from Learn rather than offering the new lesson beside
  it; the engine-driven lesson becomes the entry once that session completes.
- `DEV_TOOLS_ENABLED` is the "explicit enablement". It is `false` in `.env.example`.
- Review version is per record and starts at 1; changing content should bump it and reset to draft.

### 5. Content that still needs genuine educator review

Until these are reviewed and recorded, production serves no lessons and no practice.

- Fixed lessons (4): `lesson-maths-frac-part-1`, `lesson-sci-circuits-1`,
  `lesson-sci-circuits-mastery`, `lesson-sci-conductors-1` (`packages/content/src/lessons/review.ts`).
- Engine-driven lesson definitions (2) (`apps/web/server/teaching/adaptive-lessons.ts`).
- Authored teaching activities for `MATH-FRAC-PART` and `SCI-ELEC-CIRCUITS`
  (`apps/web/server/teaching/authored-engine.ts`).
- Item bank: 16 assessed questions and 2 diagnostic probes, including each correct answer and
  misconception tag (`apps/web/server/teaching/item-bank.ts`).
- Practice templates: all 42 (`packages/content/src/templates`).

### 6. Remaining gaps

- No live model was exercised; model calls for real students remain disabled pending the per-student
  consent and class controls.
- The review gate checks that a record is complete, not that the named person reviewed it. Recording a
  review is a code change and should be made only with the educator's sign-off.
- Review records live in code, not the database; there is no review workflow or UI.
- Home, Play, quests and bosses were not given "coming soon" states: in production their practice
  requests now fail with a 404 message instead of serving drafts.
- Developer-tool browser tests need a development server on port 3101, which adds about 10 seconds
  to `pnpm test:e2e`.
- Developer-preview fixtures (`lesson/planner-fixtures.ts`) carry no review record; they are reachable
  only through the protected developer tools.

---

## 2026-11-16 — Open-Topic Teaching: Any Topic as an LLM-Composed Preview Lesson (Clau)

Continues from the tree delivered as `GAPS-clau-001.zip`. Delivered as `GAPS-clau-002.zip` under the
ZIP handoff workflow; no commit, push, merge or deployment. Implements SPEC Appendix G (new).

### 1. Live demonstration status: BLOCKED

No provider credentials exist on this device (`OPENAI_API_KEY` is empty and no key is set in the
shell). `pnpm demo:open-topic` therefore exits with "BLOCKED" and wrote no transcript. **Live
generation has not been demonstrated.** Everything below was verified with the mock provider and
scripted test doubles, which prove the wiring, validation, persistence and player, and nothing about
whether a real model produces good or correct lessons. With `LLM_PROVIDER=openai` and a key (or any
OpenAI-compatible endpoint via `OPENAI_BASE_URL`), the same command runs photosynthesis, states of
matter and negative numbers with succeeding and struggling synthetic learners and writes
`docs/demos/open-topic-live-demo.md`.

### 2. Built

1. **Entry.** Learn has a "Learn any maths or science topic" box (topic text, Class 6–8).
   `POST /api/v1/open-lessons` answers `ready`, `needs_clarification` or `unavailable`. A topic is a
   string: no file, enum entry, concept id or page is needed. New route, logged reason: the direction
   update requires topic entry, and the existing start route carries no body.
2. **Topic resolution (`open-topic/topics.ts`).** An authored lesson is opened only when every
   significant word of the request belongs to that lesson's vocabulary ("fractions", "simple
   circuits"); "equivalent fractions" is not redirected to parts of a whole. Approved source packs are
   matched the same way and reported with their own (draft) review status.
3. **Teaching intelligence (`open-topic/engine.ts`).** One call plans a 2–3 step opening (or asks
   one clarification, or declines as out of scope); later steps are requested one at a time with the
   learning goal, level, the lesson's history and outcomes, any sources, the activity catalogue and
   the server's eligible actions. The opening queue is dropped as soon as an answer is missed.
4. **Server envelope (`open-topic/machine.ts`).** Reuses `TeachingPolicyEngine` with no belief
   status, so `advance` can never be eligible. Every incorrect answer is treated as ambiguous (no
   verified misconception map exists), leading to one diagnostic probe, then teaching, then a
   supported check; two remediation cycles force a server-written pause. Three unassisted correct
   practice answers, or 14 steps, close the round with a server-written closing step.
5. **Validation (`open-topic/validation.ts`).** Schema; action inside the envelope; component type
   allowed for the action; simulations only where a tested one is relevant to the topic; guided
   practice only with a simulation and a reachable target; question shape and answer key; exact
   arithmetic re-computation of numeric keys (`open-topic/arithmetic.ts`, rationals, no eval); text
   limits; rejection of URLs, citation-like text, markup, promised interactions and harsh feedback;
   source ids limited to those supplied; curriculum identifiers stripped. One corrected retry, then
   the step fails.
6. **Sessions (`open-topic/session.ts`).** Stored in `learning_sessions` under `open-<sessionId>`;
   each accepted activity is stored before display; refresh returns it without a model call;
   responses are idempotent with a guarded write; the model is called outside any transaction; a
   provider failure saves the answer and marks the lesson as waiting, and reopening the lesson retries.
   Responses are `open_topic_step` events only: no attempts, no beliefs, no Sparks.
7. **Consent gateway (`ai/gateway.ts`).** The first enforcement of SPEC §21 step 1: runtime on, kill
   switch off, class `ai_enabled`, student `ai_free_text` consent not revoked, daily budget unspent,
   read fresh per call. Calls are logged to `llm_calls` and counted per student as `ai_model_call`
   events, metadata only.
8. **Content status.** `contentStatus` on every lesson response: `reviewed`, `authored_draft`,
   `source_grounded` or `model_knowledge`. The player shows a one-line "Generated preview" banner
   with the sources supplied (or none), marks check results as practice feedback, and ends with a
   practice-only screen without Sparks.
9. **Player.** Prediction activities work without a simulation; numeric answers; a "next step is not
   ready" card with retry and save-for-later.
10. **Production.** Generated previews are unreviewed content: not offered and not resumable where
    drafts may not be served.
11. `pnpm demo:open-topic` (live, synthetic learners) and `--dry-run-mock` (wiring check, labelled as
    not a demonstration). Mock provider gained clearly-labelled responses for the two new purposes.

### 3. Verification Results (this device, PostgreSQL 16.16)

- **`pnpm verify`:** passed on the final tree.
- **`pnpm test`:** 46 files, 393 tests (was 45 / 355). New `open-topic.test.ts` (38).
- **`pnpm test:e2e`:** 53 passed. 23 scenarios on Desktop and Mobile Chrome against the production
  build (46, AI off), and 7 on a development server (developer tools, and open-topic journeys O1–O3
  with the mock provider).
- **`pnpm demo:open-topic`:** exit 2, BLOCKED (no credentials). `--dry-run-mock`: 6 of 6 synthetic
  runs reached a closing step; the struggling runs diverged at step 4.

### 4. Assumptions

- "School level" is Class 6, 7 or 8 for now.
- Generated lessons award no Sparks and never touch the GapMap, including questions whose numeric key
  the server recomputed: the key is verified, the item's fit to an objective is not.
- The existing source packs count as "approved sources" but are themselves unreviewed drafts, and are
  shown as such.
- The demo runner does not require `AI_ZDR_CONFIRMED`, because synthetic learners involve no child's
  data. Student sessions do.
- The model's rationale and proposals are stored in the developer trace and never shown to students.

### 5. Remaining gaps

- **Live generation is undemonstrated** (see 1). Prompt quality, factual accuracy, age-appropriateness
  and how often real output passes validation are all unknown.
- Validation cannot judge whether an explanation is true or whether a multiple-choice key is right.
  Only numeric keys with an arithmetic expression are independently checked.
- The catalogue has two simulations. For most topics a generated lesson is explanation, prediction
  and questions. No number line, particle model or diagram component exists.
- The citation and capability guards are pattern lists and will have false positives and negatives.
- Provider moderation of the topic text is wired but only the OpenAI provider implements it.
- The tutor and Solve With Me still call the provider without the new consent gateway (existing gap);
  only open-topic lessons use it.
- No teacher or staff view of generated lessons, and no path for an educator to review and promote one.
- The per-student budget counts `ai_model_call` events because `llm_calls` has no student column.
- Open-topic browser journeys run on the development server only, since the production build serves
  no drafts outside the loopback test harness and runs with AI off.

---

## 2026-11-16 — Open-Topic Teaching Moved to the Protected Developer Preview (Clau)

Revises the previous entry after Gyan's brief for this task: implement open-topic teaching
"initially in the protected developer preview using synthetic learners". The earlier
`GAPS-clau-002.zip` exposed it to consenting students on Learn; that archive is superseded by the
reissued `GAPS-clau-002.zip`. Predecessor: `GAPS-clau-001.zip`, unchanged
(SHA-256 `ffeb6e5dba4149a20255ca48ecb728c53aabf8bf0d80358cdd0b175e6f172576`).

### 1. Changed

1. **Developer preview (`/dev/open-topic`, `server/open-topic/dev-preview.ts`).** Behind the
   developer-tools gate. A staff admin starts a lesson on any topic as a synthetic learner
   (`stu_synthetic_preview_learner`: locked, no class, no credential, no consent record). The lesson
   uses the same persisted session lifecycle as student lessons and plays in the same player. The
   page shows provider readiness (and says plainly when the mock is in use or what is missing), a
   scripted succeeding or struggling auto-play, and a decision trace with answer keys, key
   verification, eligible actions, the model's rationale and its proposals labelled as unverified.
2. **Six protected routes** under `/api/v1/dev/open-topic` (readiness, create, start, respond,
   autoplay, trace). Logged reason: the preview needs its own endpoints because the student lesson
   endpoints are student-only and scoped to the caller.
3. **Student entry off by default.** `OPEN_TOPIC_STUDENT_ENTRY` (new, default `false`, ignored in
   production) gates the Learn box and `POST /api/v1/open-lessons`. With it off, students see no
   any-topic entry and the route answers `preview_not_allowed`. The consent gateway is unchanged and
   still required when the entry is on.
4. **Demo runner** now prints and records PASS/FAIL checks per topic and exits 0, 1 or 2 (blocked).
5. `LessonPlayer` accepts an endpoint base and exit link so the preview can reuse it unchanged.

### 2. Results, reported separately

**Live-model tests: NOT RUN (blocked).** `pnpm demo:open-topic` exited 2: `LLM_PROVIDER` is
`disabled` and no API key is present on this device. No real model generated anything. Needed to
run: `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, optionally `OPENAI_BASE_URL` and `LLM_MODEL_TUTOR`.
Exact steps: `docs/demos/OPEN_TOPIC_DEMO.md`.

**Authored and fallback tests (no model): passed.**

- Authored lessons with the provider disabled, authored-engine fallback, content gates and developer
  access: `adaptive-lesson`, `teaching`, `lesson`, `content-and-dev-access` test files: 81 of 81.
- Open-topic failure and refusal paths (provider timeout/error/refusal/invalid output, rejected
  output after one retry, kill switch mid-lesson, no permission, production refusal): 9 of 9.
- Browser, production build with AI off: 46 of 46 (23 scenarios on Desktop and Mobile Chrome).

**Open-topic wiring tests with mock and scripted providers (not live): passed.**

- `open-topic.test.ts`: 42 of 42 (includes the 9 above and the developer-preview routes for every role).
- Browser, development server with the mock provider: 8 of 8 (D1, D2, S18, S19, P1 developer
  preview journey, O1–O3 student entry explicitly enabled).
- `pnpm demo:open-topic --dry-run-mock`: 12 of 12 wiring checks.

**Full gate:** `pnpm verify` passed: 397 unit/integration tests in 46 files, 54 browser tests.

### 3. Remaining gaps

As in the previous entry, plus: no staff sign-in screen exists, so the preview is reached by signing
in through the API (see the demo guide); synthetic-learner lessons accumulate in the database and
are not cleaned up; the mock provider remains selectable in the preview and is labelled, not blocked.
