import type { ContentReview } from "@gaps/contracts";

/**
 * Review record for the fixed authored lessons.
 *
 * These lessons were drafted by an AI engineering agent and have NOT been
 * reviewed by an educator. They stay "draft" until a named educator reviews the
 * exact version; only then may status, reviewedBy and reviewedAt be set. Draft
 * lessons are served only where drafts are explicitly allowed (local demo).
 */
export const LESSON_DRAFT_REVIEW: ContentReview = {
  status: "draft",
  version: 1,
  authoredBy: "ai-drafted:gem",
  notes: "Awaiting educator review of explanations, simulations, checks and remediation.",
};
