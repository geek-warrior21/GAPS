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
