import { loadRootEnv } from "@gaps/db";
import type { ContentReview } from "@gaps/contracts";

/**
 * Environment rules for what this server may serve.
 *
 * - Production serves only reviewed lesson content. Drafts are refused there
 *   whatever CONTENT_SERVE_DRAFTS says, with one exception: the browser-test
 *   harness, which runs the production build on a loopback address.
 * - Outside production (local development, tests) drafts are served unless
 *   CONTENT_SERVE_DRAFTS=false. This is the explicit local demo configuration.
 * - Developer tools never run in production, and elsewhere only when
 *   DEV_TOOLS_ENABLED=true. They additionally require a staff-admin session.
 */

export type RuntimeEnv = Record<string, string | undefined>;

let rootEnvLoaded = false;

export function runtimeEnv(): RuntimeEnv {
  if (!rootEnvLoaded) {
    // Root .env values are needed before the first database call loads them.
    loadRootEnv();
    rootEnvLoaded = true;
  }
  return process.env;
}

export function isProductionRuntime(env: RuntimeEnv = runtimeEnv()): boolean {
  return env.NODE_ENV === "production";
}

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** The Playwright harness: production build, test flag set, served on loopback only. */
export function isLocalBrowserTestHarness(env: RuntimeEnv = runtimeEnv()): boolean {
  return isProductionRuntime(env) && env.PLAYWRIGHT_TEST === "1" && isLoopbackUrl(env.APP_BASE_URL);
}

export function areDraftsServable(env: RuntimeEnv = runtimeEnv()): boolean {
  if (env.CONTENT_SERVE_DRAFTS === "false") return false;
  if (!isProductionRuntime(env)) return true;
  return isLocalBrowserTestHarness(env) && env.CONTENT_SERVE_DRAFTS === "true";
}

/** A review record counts as reviewed only with a named reviewer and a review time. */
export function isReviewed(review: ContentReview | undefined): boolean {
  return review?.status === "reviewed" && Boolean(review.reviewedBy) && Boolean(review.reviewedAt);
}

export function isContentServable(
  review: ContentReview | undefined,
  env: RuntimeEnv = runtimeEnv(),
): boolean {
  if (review?.status === "retired") return false;
  if (isReviewed(review)) return true;
  // Draft, missing or malformed review records are all treated as unreviewed.
  return areDraftsServable(env);
}

/**
 * Open-topic lessons are first released in the protected developer preview with
 * synthetic learners. The student-facing entry stays off unless explicitly
 * enabled, never in production, and then still requires every per-student
 * consent control.
 */
export function isOpenTopicStudentEntryEnabled(env: RuntimeEnv = runtimeEnv()): boolean {
  return !isProductionRuntime(env) && env.OPEN_TOPIC_STUDENT_ENTRY === "true";
}

export function areDevToolsEnabled(env: RuntimeEnv = runtimeEnv()): boolean {
  return !isProductionRuntime(env) && env.DEV_TOOLS_ENABLED === "true";
}
