# Open-topic teaching: how to run the demonstration

Status on 2026-11-16: **not yet run with a real model.** No provider credentials
were available on the build device. Everything below is wired and was exercised
with the mock provider, which proves the plumbing only.

## What you need

1. The repository set up as in `docs/AGENT_WORKFLOW.md` (Node 22.23.5, pnpm 10,
   PostgreSQL 16, `.env` copied from `.env.example`, `pnpm db:migrate && pnpm db:seed`).
2. An API key for an OpenAI-compatible chat-completions provider that supports
   JSON output (`response_format: json_object`).
3. In `.env`:

   ```sh
   LLM_PROVIDER=openai
   OPENAI_API_KEY=<your key>
   LLM_MODEL_TUTOR=<model name>          # REQUIRED, e.g. gpt-4o-mini. Do not leave it empty.
   # Optional, for another OpenAI-compatible provider:
   # OPENAI_BASE_URL=https://<provider host>/v1
   DEV_TOOLS_ENABLED=true                # needed for part B only
   ```

   `LLM_MODEL_TUTOR` must be set: `.env.example` ships it empty, and an empty
   value is sent to the provider as the model name, so every call fails while the
   report still says `gpt-4o-mini` (known problem R10 in the handoff).

   Leave `AI_ZDR_CONFIRMED=false` and `OPEN_TOPIC_STUDENT_ENTRY=false`. The
   demonstration uses synthetic learners and never touches a student account.

## Part A: command-line run (live-model tests)

```sh
pnpm demo:open-topic
```

This runs photosynthesis (Class 7), states of matter (Class 6) and negative
numbers (Class 6), each with a succeeding and a struggling synthetic learner: six
lessons, roughly 40 to 60 model calls. No topic has any code of its own; each is
passed as a plain string.

- Exit code 0: all checks passed. 1: at least one check failed. 2: blocked, no
  credentials.
- It writes `docs/demos/open-topic-live-demo.md` with: provider and model; a
  PASS/FAIL list (opening accepted by validation, lessons ran to a close or pause,
  the sequence changed after a missed answer using steps generated after it, no
  authored lesson used); the two sequences per topic side by side; and a full
  transcript of every accepted activity, answer key, key verification and the
  model's stated rationale.
- `pnpm demo:open-topic --timeout-ms=60000` raises the per-call timeout
  (default 30000).
- `pnpm demo:open-topic --dry-run-mock` checks the wiring with the mock provider.
  It prints to the terminal, writes nothing, and is **not** a demonstration.

## Part B: protected developer preview (persisted, refresh and retry)

1. Start the app in development mode (the preview does not exist in a
   production build):

   ```sh
   pnpm dev
   ```

2. Sign in as the demo staff admin. There is no staff sign-in screen yet, so
   open `http://localhost:3000` and run this in the browser console:

   ```js
   await fetch("/api/v1/auth/staff-login", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ email: "admin@demo.gaps", password: "AdminDemo2026!" }),
   });
   ```

3. Open `http://localhost:3000/dev/open-topic`. The bar at the top must read
   "Live provider ready: openai, model …". If it says "MOCK provider" or lists
   something missing, fix `.env` and restart `pnpm dev`.
4. Type `photosynthesis`, choose Class 7, click **Start new lesson**. The lesson
   is stored: the URL now ends with `?lesson=open-ses_…`. The player on the left
   shows the "Generated preview" banner; the trace on the right shows the content
   basis, the model's proposals (labelled as unverified) and step 1.
5. **Refresh the page.** The same lesson and step return, with no new model call.
6. Play a step or two by hand, then click **Auto-play struggling learner**. In the
   trace, find the first step marked "not yet": the step after it is a diagnostic
   probe or a new explanation rather than the next planned question. That is the
   lesson changing direction after a response.
7. Click **Start new lesson** with the same topic and use **Auto-play succeeding
   learner** to compare: it goes straight through three practice questions.
8. Repeat with `states of matter` (Class 6) and `negative numbers` (Class 6). For
   negative numbers, numeric questions whose key the server recomputed show
   `deterministic_answer_key` in the trace.
9. To see retry: stop your network or set an invalid key, restart, answer a
   question. The player shows "Your next step is not ready yet" with **Try
   again**; the answer is already saved. Restore the key, restart, reload the
   page and press **Try again**.

## What the demonstration does and does not show

It shows a real model producing configurations for the existing activity
components, the server accepting or rejecting them, lessons being stored and
resumed, and the sequence adapting to a response.

It does not show that the content is correct or suitable. Generated lessons are
unreviewed previews; their explanations and multiple-choice keys are not checked
by the server. They are practice only and never change the GapMap.
