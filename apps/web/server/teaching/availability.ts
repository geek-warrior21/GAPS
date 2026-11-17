import type { ContentReview } from "@gaps/contracts";
import { isContentServable, runtimeEnv, type RuntimeEnv } from "../runtime-policy";
import type { AdaptiveLessonDefinition } from "./adaptive-lessons";
import { AUTHORED_TEACHING_CONTENT_REVIEW } from "./authored-engine";
import { getItemReview, getServableAssessmentItems, selectDiagnosticItem } from "./item-bank";

/** Distinct assessed items the belief reducer needs before it can report demonstrated. */
const MIN_SERVABLE_ITEMS = 3;
const MIN_SERVABLE_TEMPLATES = 2;

export interface LessonAvailability {
  readonly available: boolean;
  /** Internal reasons, for logs and the handoff. Never shown to students. */
  readonly reasons: readonly string[];
}

/**
 * An engine-driven lesson may be served only when every piece of content it
 * can reach is servable here: its framing, the authored teaching activities
 * (which are also the fallback for any other engine), the diagnostic probe, and
 * enough assessed items for mastery to be reachable.
 */
export function getAdaptiveLessonAvailability(
  def: AdaptiveLessonDefinition,
  env: RuntimeEnv = runtimeEnv(),
  reviews: {
    teaching?: Readonly<Record<string, ContentReview>>;
    item?: (itemId: string) => ContentReview | undefined;
  } = {},
): LessonAvailability {
  const servable = (review: ContentReview | undefined) => isContentServable(review, env);
  const itemReview = reviews.item ?? getItemReview;
  const itemServable = (itemId: string) => servable(itemReview(itemId));
  const reasons: string[] = [];

  if (!servable(def.review)) reasons.push("lesson definition is not reviewed");
  if (!servable((reviews.teaching ?? AUTHORED_TEACHING_CONTENT_REVIEW)[def.objectiveId])) {
    reasons.push("authored teaching activities are not reviewed");
  }

  const probe = selectDiagnosticItem(def.objectiveId, () => true);
  if (!probe || !itemServable(probe.itemId)) {
    reasons.push("diagnostic probe is not reviewed");
  }

  const items = getServableAssessmentItems(def.objectiveId, () => true).filter((i) =>
    itemServable(i.itemId),
  );
  if (
    items.length < MIN_SERVABLE_ITEMS ||
    new Set(items.map((i) => i.templateId)).size < MIN_SERVABLE_TEMPLATES
  ) {
    reasons.push(
      `fewer than ${MIN_SERVABLE_ITEMS} reviewed assessment items across ${MIN_SERVABLE_TEMPLATES} templates`,
    );
  }

  return { available: reasons.length === 0, reasons };
}
