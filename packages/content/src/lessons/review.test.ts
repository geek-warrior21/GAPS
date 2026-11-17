import { describe, expect, it } from "vitest";
import { ContentReviewSchema } from "@gaps/contracts";
import { checkLessons, summarizeLessonReview } from "../check";
import { LESSON_REGISTRY } from "./registry";

describe("fixed lesson review metadata", () => {
  it("content:check accepts the registered lessons and their review records", () => {
    expect(checkLessons()).toEqual([]);
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      expect(ContentReviewSchema.safeParse(lesson.review).success).toBe(true);
      expect(lesson.review?.version).toBeGreaterThanOrEqual(1);
      expect(lesson.review?.authoredBy).toBeTruthy();
    }
  });

  it("reports every fixed lesson as awaiting educator review", () => {
    const summary = summarizeLessonReview();
    expect(summary.reviewed).toEqual([]);
    expect(summary.unreviewed.sort()).toEqual(Object.keys(LESSON_REGISTRY).sort());
  });
});
