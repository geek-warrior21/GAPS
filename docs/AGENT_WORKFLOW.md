# Gem and Clau: engineering handoffs

## Ownership and shared memory

Gyan chooses the active engineer. Clau is the requested next engineer; Gem must
release the current unfinished work first. Default to one active writer across
both devices. A handoff file is a coordination convention, not a distributed lock.
An offline or stale checkout cannot establish that another agent has stopped.

- `AGENTS.md`: shared engineering instructions; `CLAUDE.md` points to it.
- `docs/SPEC.md`: requirements, including the maths-and-science pivot in Appendix F.
- `docs/BUILD_PLAN.md`: milestone plan; `docs/BUILD_LOG.md`: historical results.
- `docs/AGENT_HANDOFF.md`: current ownership, unfinished work, evidence and next task.
- Git history and diffs: what actually changed. Chat claims alone do not prove it.

Keep the handoff concise and current. Put historical detail in the build log.

## Start or resume a session

1. Read AGENTS.md, the handoff, the relevant spec and latest build-log entry.
2. Inspect `git status --short --branch`, `git log -5 --oneline`, and the tracked
   and untracked changes. Preserve unexpected edits and identify their owner.
3. Obtain the outgoing engineer's release and exact transfer commit from Gyan.
   If using an authorized remote, fetch it before comparing hashes. With an
   offline bundle, verify and fetch the bundle instead. Never assume a cached
   `origin/main` or the name of a branch is the latest work.
4. Confirm `git rev-parse HEAD` matches the agreed checkpoint, or document the
   deliberate continuation from it. If code or untracked files are missing,
   recover them before implementation. Do not reset or overwrite the other work.
5. Use a task branch such as `codex/clau-teaching-engine` or
   `codex/gem-teaching-engine`, based on the transferred checkpoint. Keep `main`
   as the verified integration baseline. Existing work on main must be preserved
   when moving it onto a task branch.
6. Update the handoff owner, device alias, task, starting hash and status. If an
   authorized remote is used for coordination, sync the claim before editing.
   Without remote writes, Gyan explicitly coordinates the ownership change.
7. On a fresh device, establish the baseline with the commands below. Report
   existing failures separately from failures introduced by new work.

## While working

Work on the recorded task and preserve the other agent's changes. Update the
handoff if scope changes, execution is interrupted, or a meaningful checkpoint is
reached. Record actual validation commands and results, not just “tests pass.”

Use each device's own local development database. Record migrations and required
configuration variable NAMES. Transfer code, migrations and demo fixtures through
Git; keep `.env`, API keys, database dumps and student data out of handoffs and
bundles. A bundle contains committed history, so inspect the transfer contents.

`pnpm verify` includes migrations, demo seeding and tests: run it against the local
development/test database, not a live school database. Avoid concurrent test runs
against the same database. Keep the checked-in dependency lockfile.

## Finish or switch devices

1. Stop editing and finish/cancel your own relevant background commands. Record
   any processes deliberately left running, including ports and purpose.
2. Inspect all changes, including new files. Stage explicit task paths only.
3. Run the repository's required checks against the final code; fix genuine
   regressions without weakening tests. Record failures or unrun checks honestly.
4. Update the handoff: changes, decisions, validation scope, limitations,
   migrations/configuration, and the next concrete action. Mark ownership
   `released` only when the outgoing agent has stopped editing.
5. Commit the intended code and handoff when the existing commit gates pass.
   Report the resulting full commit hash after committing; do not try to put a
   commit's own hash inside that same commit. Identify the tested code/base hash
   in the handoff and disclose any subsequent documentation-only changes.
6. Transfer the checkpoint by the agreed method. Have the incoming agent confirm
   its full hash before editing. An unsynced local commit is not a completed
   cross-device handoff.

If an urgent switch interrupts failing work, keep it labeled INCOMPLETE. Preserve
tracked edits and required untracked source files and record their provenance.
The current every-commit verification rule still applies; ask Gyan for an explicit
WIP-checkpoint exception if a transfer commit is needed before the gate passes.
Never describe a failing checkpoint as the verified baseline.

## Transfer methods

The existing no-push/no-deploy directive remains in effect. Neither this document
nor the agent switch authorizes pushing or deploying.

**After Gyan authorizes branch pushes:** use the repository remote with confirmed
appropriate access/visibility. Publish the handoff/task branch without force,
fetch it on the other device and check the exact commit. Review and verify the
integrated result before merging to main. Publishing a branch is not deployment.

**Without push permission:** after a complete local checkpoint, create a Git
bundle of the explicit handoff branch and have Gyan transfer it to the other device.
Example (substitute the actual branch and an unused bundle path):

```sh
git bundle create /tmp/gaps-handoff.bundle codex/gem-teaching-engine
git bundle verify /tmp/gaps-handoff.bundle
```

On the new device, clone the bundle into a NEW directory using that branch:

```sh
git clone -b codex/gem-teaching-engine /path/to/gaps-handoff.bundle GAPS
```

Bundles contain committed work only. They exclude uncommitted/untracked files and
local databases. This clone's origin is the bundle path, not GitHub; configure a
network remote separately only when needed and authorized. For later handoffs,
fetch the transferred branch from the next bundle into the existing repository,
inspect the diff and preserve local work before changing branches.

## Fresh-device bootstrap

Use the Node version in `.node-version`, compatible pnpm from `package.json`, and
Docker with Compose. Docker Desktop or Colima may supply the local runtime.
Use a separate OS account/profile on a borrowed device and your own repository
access. Keep credentials local to that account; remove/revoke temporary access
when the device is no longer used for this project.

```sh
# From the transferred repository, after starting Docker:
pnpm install --frozen-lockfile
# Copy .env.example to .env only if .env does not exist.
# Set a local SESSION_SECRET and local database connection.
# Leave LLM_PROVIDER=disabled and AI_ZDR_CONFIRMED=false.
pnpm db:up
pnpm exec playwright install chromium
pnpm verify
pnpm dev
```

Use the URL printed by the dev server. The existing browser-test configuration
uses port 3100: check that a stale server is not supplying an older build during
verification. New databases get demo records from verify; existing student
progress is not transferred by cloning code.

## Handoff fields to maintain

- Updated time and timezone; status (`active`, `released`, or `blocked`).
- Active owner and device alias; next owner; release confirmation.
- Task branch, starting commit, transfer method and synchronization state.
- Current task and acceptance criteria.
- Changes and important decisions; touched areas and migrations.
- Checks run, code/tree they covered, pass/fail and unverified claims.
- Uncommitted/untracked work and unfinished tasks.
- Configuration names, relevant running processes and next action.

If parallel engineering is later requested, first assign separate task branches,
non-overlapping ownership and separate databases; nominate one integrator. Neither
agent should edit the same checkout or merge the other's branch concurrently.
