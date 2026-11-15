# Current engineering handoff

## Ownership and transfer status

- Updated: 2026-11-16, Asia/Kolkata.
- Status: ACTIVE. Clau holds ownership and has stopped editing at a verified local
  checkpoint. Not released: Gyan has not named a next owner.
- Active owner: Clau, on Gyan's friend's device (alias `friend-mac`).
- Previous owner: Gem, released at `e62b296561550d62a9f70f2ebdc8525b47040aae`.
- Task branch: `codex/clau-teaching-engine`, created from `e62b296` (which equals
  `origin/main` as fetched on 2026-11-16). `main` is untouched.
- Synchronization: the branch exists ONLY in this local checkout. Nothing has been
  pushed. Gem's earlier push of `main` is complete and is not a standing permission.
- Authorization needed from Gyan before any push, merge to `main`, or deployment.
- Checkout: `/Users/mdkaif/Downloads/GAPS-main`. It began as a source download without
  Git history; it was attached to the repository with `git init` + `git fetch` +
  `git reset --mixed e62b296`, which showed no differences from the handoff commit.

## Product direction

Gaps dynamically combines explanation, exploration and practice for school maths
and science, initially Class 6 demonstrations within a Class 6–8 product scope.
The server controls assessment and progression; engines (authored or model) may
only choose eligible teaching actions. Participation, assisted answers, diagnostic
probes and model output do not establish mastery. Appendix F in SPEC.md supersedes
the original maths-only frontend scope.

## Acceptance questions: answers

1. **Did the teaching engine drive real sessions?** No. At `e62b296` it was used only
   by the developer routes and comparison. It now drives persisted sessions for two
   lessons: `lesson-maths-frac-part-adaptive` and `lesson-sci-circuits-adaptive`.
2. **Did advancement respect the learner model?** No. The policy allowed `advance`
   after two correct answers, below the belief reducer's rule, and reused one question
   under new item ids. Now: two distinct unassisted correct answers only move the
   learner on within the lesson; `advance` requires the belief reducer's
   `demonstrated`/`retained` status. The reducer and its thresholds are unchanged.

Details, assumptions and the tests that changed are in the latest build-log entry.

## What changed (see `git diff e62b296..HEAD`)

- `apps/web/server/teaching/`: `policy.ts` (reconciled rules, `teaching-rules-1.1`),
  `item-bank.ts` (new), `sequencer.ts` (new), `adaptive-session.ts` (new),
  `adaptive-lessons.ts` (new), `authored-engine.ts` (item bank, consolidation copy,
  solvable fraction guided task), `compare.ts` (replays the real sequencer and reducer).
- `apps/web/server/lesson/`: `service.ts` (dispatch to adaptive lessons, redaction of
  fixed lessons, optional `misconceptionId`, next action resumes adaptive sessions),
  `redact.ts` (new).
- `apps/web/components/lesson/`: server-graded check flow, adaptive step label,
  closing-step buttons. `apps/web/app/learn/page.tsx`: two entry buttons.
  `apps/web/app/dev/lesson-planner/page.tsx`: evidence block per trace step.
- `packages/contracts/src/lesson.ts`: optional fields only (no breaking change).
- `packages/db/src/repos/student.ts`: `recordDecisionTrace`, `listDecisionTraces`.
- Tests: `apps/web/server/adaptive-lesson.test.ts` (new), `teaching.test.ts`,
  `apps/web/e2e/student-journey.spec.ts` (S19 updated, S20–S23 new).
- No migration, no new route, no new dependency, no new environment variable.

## Verified on this device

Final code, local PostgreSQL 16.16, `LLM_PROVIDER=disabled`, `AI_ZDR_CONFIRMED=false`:

- `pnpm verify`: passed (typecheck, lint, format:check, content:check with 42
  templates, db:migrate, db:seed, 330 unit/integration tests in 43 files, build,
  46 browser tests = 23 scenarios on Desktop Chrome and Mobile Chrome).
- Baseline at `e62b296` on this device before changes: passed (308 unit, 38 browser).

Not verified: any live model. All behaviour above is authored. The fallback path was
exercised with a failing engine, the disabled model engine and a hand-written rogue
engine. Nothing was run against a deployed environment.

## Open findings for Gyan

1. `/dev/lesson-planner` and `/api/v1/dev/*` have no authentication or environment
   gate (existing at `e62b296`). They return authored activities including answers.
2. The model engine is not enabled for real sessions: there is no per-student
   `ai_free_text` scope / class-flag check to satisfy Non-negotiable 6.
3. Learn shows both the fixed lessons and the step-by-step lessons. Making the
   step-by-step lesson the default means rewriting Gem's S11–S17 journeys.
4. Lesson content (fixed and item bank) has no review status, so Non-negotiable 10
   is not enforced for lessons.

## Local environment on this device (not transferred by Git)

- Toolchain helper: `source ~/.local/share/gaps-dev/env.sh` puts Node 22.23.5
  (downloaded from nodejs.org, checksum verified), pnpm 10.34.9 (corepack) and the
  PostgreSQL 16 client on PATH. The system Node is 24 and fails `engine-strict`.
- Docker is not installed. `pnpm db:up` does not work here. PostgreSQL 16 was
  installed with Homebrew (`postgresql@16`, not registered as a service) and runs
  from its own data directory `~/.local/share/gaps-dev/pgdata`, user/database `gaps`.
- **Process left running:** that PostgreSQL server, on `127.0.0.1:5432`.
  Stop: `pg_ctl -D ~/.local/share/gaps-dev/pgdata stop`.
  Start: `pg_ctl -D ~/.local/share/gaps-dev/pgdata -l ~/.local/share/gaps-dev/pg.log -o "-p 5432 -c listen_addresses=127.0.0.1" start`.
- `.env` was created from `.env.example` with a generated `SESSION_SECRET`. Variable
  names in use: `DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `LLM_PROVIDER`,
  `AI_ZDR_CONFIRMED`, `FEATURE_SOLVE_WITH_ME`, `CONTENT_SERVE_DRAFTS`, `SEED_DEMO`.
- No server is left on port 3100 or 3000.

## Next concrete actions

1. Gyan: review the branch and decide on push/merge authorization and the four
   findings above.
2. If a push is authorized: publish `codex/clau-teaching-engine` without force, have
   the other device fetch it and confirm the commit hash before any merge to `main`.
   Without push permission, transfer it as a Git bundle (see AGENT_WORKFLOW.md).
3. Next engineering steps, in order: gate the developer routes; add the per-student
   AI consent gate and only then allow the model engine in sessions, verified on
   synthetic learners; add item banks for `MATH-FRAC-EQUIV` and `SCI-ELEC-CONDUCTORS`.
