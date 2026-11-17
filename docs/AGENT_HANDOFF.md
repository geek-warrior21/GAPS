# Current engineering handoff

## Ownership and transfer status

- Updated: 2026-11-16, Asia/Kolkata.
- **Status: RELEASED.** Clau stopped editing when this archive was packaged and
  stays idle until Gyan explicitly returns ownership.
- **Outgoing agent: Clau** (Gyan's friend's device, alias `friend-mac`).
- **Incoming agent: Gem.**
- Transfer method: ZIP handoff (see AGENT_WORKFLOW.md). Git is not required.
- **This archive: `GAPS-clau-003-handoff.zip`**, a complete source snapshot. It
  replaces `GAPS-clau-002-handoff.zip`. The application source is identical; only
  documentation changed (this handoff, the demo guide, the manifest). It was
  produced after release, at the device owner's request, to add the runtime
  problems found in a read-only review. No source file was edited.
- **Incoming snapshot (what Clau last had acknowledged): `GAPS-clau-001.zip`**,
  SHA-256 `ffeb6e5dba4149a20255ca48ecb728c53aabf8bf0d80358cdd0b175e6f172576`.
  Everything after it is in this archive and has not been acknowledged by Gyan.
- Lineage: Gem `e62b296` → Clau commit `05c1ecca4dc0bbded5c2b88f380611aeff58dc7f`
  → `GAPS-clau-001.zip` → `GAPS-clau-002.zip` → `GAPS-clau-002-handoff.zip` → this
  archive. The application source in all three of the last is the same.
- File manifest with per-file SHA-256: `docs/handoff/GAPS-clau-003-handoff-MANIFEST.txt`.
  The archive's own SHA-256 is in a `.sha256` file beside it and in the delivery
  message; it cannot be stored inside the archive.
- **2026-11-17 update:** Gyan authorized committing this snapshot and pushing it
  to `origin` on the branch `codex/clau-teaching-engine` (not `main`). The
  snapshot's application source is committed on top of `05c1ecc` and pushed there.
  Nothing is merged into `main` or deployed, and neither is authorized. Clau
  remains released; this was a one-off publish, not a return of ownership.
- `pnpm verify` before that commit: run 1 had 4 dev-server browser failures and
  run 2 had 1 (pages aborted or stuck while `next dev` compiled on first use).
  Run 3 passed fully (397 unit tests, 54/54 Playwright). The dev-server browser
  tests are flaky on a cold start; treat that as a known infrastructure issue.

## Product direction (preserve this)

**Open-topic teaching for Class 6–8 maths and science.** A learner enters any
topic in their own words; the model plans a short interactive opening, then
adapts each next activity to the learner's responses. The model composes existing
tested activity components by supplying configuration. It never generates
widgets, markup or code. Approved sources are used when available; otherwise the
lesson is a labelled generated preview. A new topic needs no authored lesson,
enum entry, page or engine change. See SPEC Appendix G.

**General learning beyond school maths and science is deferred.** Do not widen scope.

Unchanged rules: the server controls assessment and progression; participation,
assisted answers, probes and model output never establish mastery; generated
practice feedback is kept apart from verified mastery; production serves only
reviewed content; real-student model calls stay behind the consent controls.

## Was live model generation exercised? No.

No provider credentials were available on Clau's device at any point. No real
model has generated a lesson, and no real model has been observed changing a
teaching sequence. `pnpm demo:open-topic` exits 2 (blocked). Every open-topic
result below comes from the mock provider or scripted test doubles, which prove
wiring only. **Open-topic teaching is integration-complete and
demonstration-blocked. Do not report it as demonstrated.**

## Completed changes (all in this archive)

Detail for each is in docs/BUILD_LOG.md (the last five entries are Clau's).

1. **Teaching engine drives real sessions; advancement follows the belief
   reducer.** Engine-driven lessons `lesson-maths-frac-part-adaptive` and
   `lesson-sci-circuits-adaptive`; authored item bank; shared sequencer; decision
   traces; two correct answers move a learner on within a lesson but only the
   reducer's `demonstrated` status advances an objective. (Committed as `05c1ecc`.)
2. **Adaptive lessons are the default Learn entry** for parts of a whole and
   simple circuits; fixed lessons keep their URLs and resume. One lesson button
   per topic. (In `GAPS-clau-001.zip`.)
3. **Developer tools protected**: `/dev/*` pages and `/api/v1/dev/*` are 404 in
   production and unless `DEV_TOOLS_ENABLED=true`, then staff admin only.
   (In `GAPS-clau-001.zip`.)
4. **Content review metadata, enforced**: status, version and provenance on
   lessons, item-bank items, authored teaching content; production refuses
   anything unreviewed, including practice templates. Nothing is marked reviewed.
   (In `GAPS-clau-001.zip`.)
5. **Server-graded checks**: lesson answers are no longer sent to the browser.
6. **Open-topic teaching** (after `GAPS-clau-001.zip`): topic resolution, model
   engine with prompts and one corrected retry, server validation of generated
   activities, exact arithmetic check of numeric answer keys, pure lesson state
   machine, persisted sessions with refresh/retry/pause, content-status labels,
   consent gateway for student model calls, protected developer preview at
   `/dev/open-topic` run as a synthetic learner, demo runner, SPEC Appendix G.

## Unfinished work

1. **Live demonstration of open-topic teaching** on photosynthesis, states of
   matter and negative numbers with a real model. Blocked only on credentials.
2. **Prompt and validation tuning.** The prompts in
   `apps/web/server/open-topic/engine.ts` and the guards in `validation.ts` have
   never met real model output. Expect rejections, timeouts and weak content on
   first contact.
3. **No factual check of generated content.** The server cannot tell whether an
   explanation is true or a multiple-choice key is right. Only numeric keys given
   with an arithmetic expression are recomputed.
4. **Thin component catalogue.** Two simulations (fraction strip, circuit). Most
   generated lessons are explanation, prediction and questions.
5. **Student-facing any-topic entry** exists (`POST /api/v1/open-lessons`, Learn
   box) but is off by default pending a release decision (SPEC G.12, G.13).
6. **No staff sign-in screen**: the developer preview is reached by signing in
   through the API (see the demo guide).
7. Not started: educator review workflow or UI; putting the tutor and Solve With
   Me behind the consent gateway; "coming soon" states for Home, Play, quests and
   bosses in production; cleanup of synthetic-learner lessons.
8. All authored content still awaits genuine educator review, so a production
   deployment serves no lessons and no practice: 4 fixed lessons, 2 engine-driven
   lesson definitions, authored teaching activities for 2 objectives, 16 assessed
   items and 2 probes, 42 practice templates.

## Known failures

- No automated check fails on this tree. The runtime problems in the next section
  are real defects that the current tests do not catch.
- `pnpm demo:open-topic` exits 2 by design when no provider is configured.
- `pnpm db:up` fails on Clau's device because Docker is not installed (device
  limitation, not a code fault).
- Not a failure but a risk: the developer-server browser tests depend on Next.js
  dev-mode compile times; they passed on every recorded run, with retry loops
  around first interactions.

## Known runtime problems (read-only review, 2026-11-16)

Found after packaging by a full read-only review: four area reviews plus direct
probes against the local database and a browser. None is fixed. Tick each box
when fixed and add a test that would have caught it.

"Reproduced" means it was run and observed. "Traced" means the code path was read
end to end and spot-checked but not executed. `engine.ts` is
`apps/web/server/session/engine.ts`. Most of these are in the practice engine and
predate Clau's work; R7–R9, R12 and R33 are in or exposed by Clau's lesson code.

### Critical: learner progress is computed wrongly

- [ ] **R1 (reproduced).** Correct practice answers are stored with a misconception
      id, so two correct answers set "needs support". Parts of a whole, number line,
      `<`/`>` comparison answers, decimals starting `0.`.
      `packages/domain/src/misconception-tracker.ts:46`, `engine.ts:842`.
- [ ] **R2 (reproduced).** Practice can never reach "demonstrated" and demotes an
      objective that is: one correct practice answer reset a lesson-demonstrated
      objective to "developing". `engine.ts:899` gives every past attempt the current
      item's template id. Each demote-then-redemonstrate cycle can re-award the +20
      mastery Sparks.
- [ ] **R3 (traced).** Finishing a diagnostic overwrites all 14 maths belief rows
      outside the belief reducer; untested objectives become "not assessed".
      `engine.ts:1111-1125`. Breaks non-negotiable 1.
- [ ] **R4 (traced).** Boss and diagnostic answers count as mastery evidence in later
      replays: the reducer never reads the attempt mode. `packages/domain/src/belief.ts`,
      `apps/web/server/lesson/service.ts` (recordLessonAssessment). Breaks non-negotiable 3.

### Critical: sessions are lost or duplicated

- [ ] **R5 (reproduced).** Starting any practice, quest, boss or quick check abandons
      an in-progress lesson. `abandonActiveSessions` has no mode filter:
      `packages/db/src/repos/student.ts:240`.
- [ ] **R6 (traced).** Home's "Resume Session" never resumes: it starts a new session
      and abandons the old one; for a lesson it creates a practice session with mode
      "lesson". `apps/web/app/home/page.tsx:171`, `apps/web/app/session/page.tsx:28`.
- [ ] **R7 (reproduced in a browser).** In development mode the lesson page sends two
      start requests and two sessions are created. After finishing, Learn shows
      "Continue Lesson" and reopens the leftover at step 1. Start is check-then-insert:
      `apps/web/app/lesson/[lessonId]/page.tsx:18`, `lesson/service.ts`,
      `teaching/adaptive-session.ts`. Development is the only mode that serves lessons today.
- [ ] **R8 (reproduced).** Lesson lookup windows are too small. Fixed lessons look at
      5 sessions (`lesson/service.ts`, `.limit(5)` in start and submit): the lesson is
      lost after 5 newer active lesson sessions and submit returns 404. Engine-driven
      lessons look at 20 (`teaching/adaptive-session.ts` findSession).
- [ ] **R9 (traced).** An abandoned open-topic lesson renders its last step as live;
      submitting gives a permanent 409 or loops on the same question.
      `apps/web/components/lesson/LessonPlayer.tsx` (activeActivity fallback),
      `apps/web/server/open-topic/session.ts`.

### Will break the live demo: fix before running it

- [ ] **R10 (traced).** `LLM_MODEL_TUTOR=` is empty in `.env.example`, and
      `packages/ai/src/factory.ts:21` uses `??`, so the provider is sent an empty
      model name and every call fails, while logs and the demo report say
      `gpt-4o-mini`. Workaround: set `LLM_MODEL_TUTOR` to a real model name.
- [ ] **R11 (traced).** Any HTTP 400 from the provider is reported as "refused" and
      nothing is logged. A model that rejects `max_tokens` or `temperature` fails
      silently. `packages/ai/src/providers/openai.ts:39-51`.
- [ ] **R12 (reproduced with the mock provider).** With an AI provider configured and
      `AI_ZDR_CONFIRMED=true`, every fixed-lesson start calls the lesson planner with
      no consent check; the generated plan replaces the authored lesson and its
      questions count as mastery evidence. Opening the conductors lesson returned the
      circuits lesson. `apps/web/server/lesson/planner.ts:99-215, 362`. Keep
      `AI_ZDR_CONFIRMED=false` until fixed.

### High: errors and data exposure

- [ ] **R13 (traced).** Every `EngineError` returns HTTP 500: `errorResponse` in
      `apps/web/server/api.ts` does not recognise it. Affects sessions start, attempt,
      help, advance, tutor, quest start, quick check, boss start, home.
- [ ] **R14 (reproduced).** 500 responses return the raw error message, including SQL
      and bound parameters, and nothing is logged. `apps/web/server/api.ts:36`. Seen
      on two simultaneous submissions of a fixed-lesson check.
- [ ] **R15 (traced).** Teachers and staff admins can read any student's GapMap and
      raw answers; no class or organisation check.
      `apps/web/app/api/v1/gapmap/route.ts:12`, `gapmap/[conceptId]/evidence/route.ts:14`.
      Staff admins are also not scoped to their organisation on cohort and student routes.
- [ ] **R16 (traced).** Two practice items expose the answer before resolution: the
      number-line marker (`packages/content/src/templates/numline.ts:75,143`) and the
      second bar of the missing-numerator item (`templates/equiv.ts:95`). Breaks
      non-negotiable 8.
- [ ] **R17 (traced).** Quick check, quest start, boss start and Solve With Me skip
      `requireCoreConsent`. Solve With Me ignores `cohorts.solve_enabled`, the
      `solve_enabled_global` flag and `FEATURE_SOLVE_WITH_ME`.

### High: practice player

- [ ] **R18 (traced).** Typing in the tutor box edits the learner's answer and Enter
      submits it: the answer pad listens on `window` without checking the target.
      `apps/web/components/math/AnswerPad.tsx:25-71`.
- [ ] **R19 (traced).** A retried answer gets a new `clientAttemptId` and counts twice
      (`components/session/SessionPlayer.tsx:87`). The server does not check the item
      is the session's current one and trusts the client's `tryNo` (`engine.ts:797, 849`).
      A retry of an attempt whose response was never cached is replayed twice.
- [ ] **R20 (traced).** Unparseable and not-simplified answers consume the question
      and count as misses, although the feedback says "try again". `engine.ts:849-856`.
- [ ] **R21 (traced).** Home's "Start Quest" starts a learn session, so the Daily
      Quest never progresses from Home. `apps/web/app/home/page.tsx:349`.
- [ ] **R22 (traced).** A tutor reply, and a help request, overwrite the whole
      `counters` blob from a stale read, undoing an answer submitted meanwhile.
      `apps/web/server/tutor/service.ts:258`, `engine.ts:1744`.

### Medium

- [ ] **R23 (traced).** Login lockout: the failure counter is not reset when a lock
      expires, so one wrong PIN re-locks; anyone can keep an account locked. Parallel
      requests bypass the counter. `apps/web/server/auth/service.ts:93-134`.
- [ ] **R24 (traced).** Sessions survive a PIN reset or lock; user status is never
      checked. Staff login accepts but ignores the one-time code.
      `apps/web/server/auth/session.ts:81`, `auth/service.ts:183`.
- [ ] **R25 (reproduced).** "Next objective: Equal pieces & equivalence" opens the
      parts-of-a-whole lesson and can never record equivalence evidence.
      `packages/content/src/lessons/registry.ts:27`.
- [ ] **R26 (traced).** Re-seeding fails with a foreign-key error once a demo student
      other than Meera has started a quest or boss. `packages/db/src/seed.ts:94`,
      `schema.ts:381, 397`. `pnpm verify` runs the seed.
- [ ] **R27 (traced).** Seed and reset have no guard; `SEED_DEMO` is never read. They
      run against whatever `DATABASE_URL` points at.
- [ ] **R28 (traced).** About a fifth of "write as an improper fraction" items mark
      the direct answer (for example `10/4`) as not simplified.
      `packages/content/src/templates/mixed.ts:85`, `packages/domain/src/verify.ts:49`.
- [ ] **R29 (traced).** Guided practice without a simulation cannot be passed; the
      fixed-lesson plan validator allows it. `LessonActivityRenderer.tsx:324`,
      `lesson/planner-validator.ts:89`.
- [ ] **R30 (traced).** Lesson and practice players do not recover from 401, 404 or
      409: they repeat the raw server message with no sign-in redirect or resync.
- [ ] **R31 (traced).** Learn shows no lesson buttons and no retry when the topics
      request fails. `apps/web/app/learn/page.tsx:127`.
- [ ] **R32 (traced).** A refresh while a check result is on screen loses it; on the
      final step it starts a new lesson. `LessonPlayer.tsx` (pendingResult).
- [ ] **R33 (traced).** Check-then-insert races return a raw 500: today's quest on
      concurrent Home loads, first use of a fixed item id by two students, a consent
      scope recorded twice.
- [ ] **R34 (traced).** `verifyStudentReplay` reports false mismatches (it counts
      unparseable attempts) and never checks science objectives.
      `packages/db/src/replay.ts:76-103`.

### Lower

- [ ] **R35.** A production build over plain HTTP drops the `Secure` session cookie,
      and `crypto.randomUUID` is unavailable there (tutor panel freezes).
      `COOKIE_INSECURE` is undocumented.
- [ ] **R36.** No Origin check on any route, though SPEC lines 493 and 981 require one.
- [ ] **R37.** The provider timeout stops applying once headers arrive; moderation
      fails open. `packages/ai/src/providers/openai.ts`.
- [ ] **R38.** The tutor's answer-leak guard is inert for choice, decimal and
      comparison answers; PII scrubbing misses roster names.
      `apps/web/server/tutor/context.ts:69`.
- [ ] **R39.** Developer open-topic preview loads each new lesson twice and can keep a
      stale lesson id after browser Back. `app/dev/open-topic/OpenTopicPreviewClient.tsx`.
- [ ] **R40.** Database client: 2-second connect timeout with a 20-second idle close
      may fail on hosted PostgreSQL. `packages/db/src/client.ts:26`.
- [ ] **R41 (environment, reproduced).** With a stale `apps/web/.next/dev` cache every
      page on the development server reloaded about 25 times a second ("HMR hash
      mismatch"). Deleting `apps/web/.next/dev` fixes it.

### Checked and found sound

Schema matches the migration; all transactions use the transaction handle; exact
arithmetic and answer parsing are safe against bad input; developer tools and
drafts cannot be reached in production; session routes are scoped to the student;
engine-driven lessons ended cleanly for three awkward learner patterns.

## Checks actually run, and results

Run by Clau on this exact tree (local PostgreSQL 16.16, `LLM_PROVIDER=disabled`),
immediately before packaging:

- `pnpm verify`: **passed.** Typecheck, lint, format check; `content:check` (42
  templates; lessons 0 reviewed, 4 awaiting review); `db:migrate`; `db:seed`;
  397 unit/integration tests in 46 files; build; 54 browser tests (46 on the
  production build across Desktop and Mobile Chrome with AI off; 8 on a
  development server with the mock provider).

Run earlier on the same source, not repeated at packaging:

- `pnpm demo:open-topic`: exit 2, blocked. `--dry-run-mock`: 12 of 12 wiring checks.
- Manual check of the production build without the browser-test flag (done for
  `GAPS-clau-001.zip`): every lesson start 404, developer page and APIs 404 for
  admin, student and anonymous callers.

After packaging `GAPS-clau-002-handoff.zip`: the read-only review above. For this
archive only `pnpm format:check` was re-run (documentation-only change); the
manifest check confirmed every source file is unchanged since the `pnpm verify` run.

Never run: any live model; any deployed environment; `pnpm db:up` (no Docker).

Results by kind:

| Kind                                                  | Result                                     |
| ----------------------------------------------------- | ------------------------------------------ |
| Live-model tests                                      | Not run (blocked: no credentials)          |
| Authored lessons, authored fallback, gates (no model) | 81 of 81                                   |
| Open-topic failure and refusal paths (no model)       | 9 of 9                                     |
| Open-topic wiring with mock and scripted providers    | 42 of 42 unit; 8 of 8 browser (dev server) |
| Browser, production build, AI off                     | 46 of 46                                   |

## Exact next steps for Gem

1. **First task: establish the baseline.** Unpack into a NEW directory, verify
   the files against the manifest, run the setup below, then `pnpm verify`.
   Compare with the results above before editing anything. Record differences.
2. Read "Known runtime problems". Fix R10 and R11 first, and keep
   `AI_ZDR_CONFIRMED=false` (R12): otherwise the live demo fails or misleads.
3. Ask Gyan for provider credentials and the provider and model to use. Put them
   in `.env` (names below), **including a non-empty `LLM_MODEL_TUTOR`**. Do not
   commit them.
4. Run `pnpm demo:open-topic` and follow `docs/demos/OPEN_TOPIC_DEMO.md` part B.
   Read `docs/demos/open-topic-live-demo.md` critically: check the science and
   maths, not just the PASS lines.
5. Tune prompts and validation against what the real model returns. Keep every
   rejection rule that protects a non-negotiable; loosen only false positives.
6. Agree with Gyan the order for the rest of the runtime problems. Suggested:
   R1–R4 (wrong progress), then R5–R9 (lost sessions), then R13–R17.
7. Report live results separately from mock results, and say plainly if the
   demonstration is still incomplete.

## Setup commands

```sh
# Node 22.23.5 (.node-version), pnpm >= 10, PostgreSQL 16 on localhost:5432
pnpm install --frozen-lockfile
cp .env.example .env            # only if .env does not exist
# then set SESSION_SECRET to at least 32 random bytes, e.g. `openssl rand -hex 32`
pnpm db:up                      # needs Docker; or point DATABASE_URL at any PostgreSQL 16
pnpm exec playwright install chromium   # from apps/web
pnpm verify                     # typecheck, lint, format, content:check, migrate, seed, tests, build, e2e
pnpm dev                        # local demo; drafts are served only outside production
```

- **Migrations:** one, unchanged since Gem's work: `packages/db/migrations/0000_robust_zzzax.sql`.
  Clau added no migration. `pnpm db:migrate && pnpm db:seed` is part of `pnpm verify`.
- **Ports:** 3000 (`pnpm dev`), 3100 (browser tests, production build), 3101
  (browser tests, development server), 5432 (PostgreSQL).

## Environment variable names

`DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `LLM_PROVIDER`,
`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL_TUTOR`, `LLM_MODEL_PARSE`,
`LLM_TIMEOUT_MS`, `LLM_DAILY_CALLS_PER_STUDENT`, `LLM_PRICE_IN_PER_MTOK_INR`,
`LLM_PRICE_OUT_PER_MTOK_INR`, `AI_ZDR_CONFIRMED`, `FEATURE_SOLVE_WITH_ME`,
`CONTENT_SERVE_DRAFTS`, `SEED_DEMO`, `DEV_TOOLS_ENABLED`,
`OPEN_TOPIC_STUDENT_ENTRY`.

Added by Clau: `DEV_TOOLS_ENABLED` (default false; developer tools, never in
production) and `OPEN_TOPIC_STUDENT_ENTRY` (default false; student any-topic
entry, never in production). `CONTENT_SERVE_DRAFTS` is now enforced.
`OPENAI_BASE_URL` was already read by the provider but is not in `.env.example`.
Test-only: `PLAYWRIGHT_TEST` (set by the browser-test harness).

## Protections to keep

- Developer pages and routes: 404 in production and unless enabled; then staff
  admin only.
- The developer preview runs as a synthetic learner with no class, credential,
  consent record or personal data.
- Student model calls need all of: AI runtime on, kill switch off, class
  `ai_enabled`, `ai_free_text` consent not revoked, daily budget unspent.
- Generated lessons are labelled previews, practice only, record no attempts and
  never reach the belief reducer.
- Production serves only reviewed content. Do not mark content reviewed without
  a named educator's sign-off.

## Local-only state on Clau's device (NOT transferred)

- `.env` with a locally generated `SESSION_SECRET` (no API keys were ever set).
- The local PostgreSQL database: demo seed, test learners, synthetic-learner
  lessons, the browser-test class `AIDEV7`. Recreate with `pnpm db:migrate && pnpm db:seed`.
- Git history: the checkout's `.git`, branch `codex/clau-teaching-engine`, commit
  `05c1ecc`. All later work is uncommitted there and exists only in the archives.
- `node_modules`, `.next`, Playwright browsers and test output.
- Toolchain helper `~/.local/share/gaps-dev/` (Node 22.23.5, env script, database
  files) and Homebrew `postgresql@16`.
- Earlier archives in `~/Downloads`: `GAPS-clau-001.zip`, `GAPS-clau-002.zip`,
  and `GAPS-clau-002-superseded-student-entry.zip` (an earlier 002 that exposed
  open topics to students on Learn; superseded, safe to delete).

## Running services on Clau's device

- PostgreSQL 16 on `127.0.0.1:5432`, started by Clau, left running.
  Stop: `pg_ctl -D ~/.local/share/gaps-dev/pgdata stop`.
  Start: `pg_ctl -D ~/.local/share/gaps-dev/pgdata -l ~/.local/share/gaps-dev/pg.log -o "-p 5432 -c listen_addresses=127.0.0.1" start`.
  (`source ~/.local/share/gaps-dev/env.sh` first, to put `pg_ctl` on PATH.)
- Nothing else. No server is listening on ports 3000, 3100, 3101 or 3200.
