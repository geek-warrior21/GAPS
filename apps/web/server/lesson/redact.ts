import type { LessonActivity } from "@gaps/contracts";

/**
 * Student-facing copy of an activity (Non-negotiable 8 / Invariant I9).
 *
 * An independent check is an assessed item, so its correct answer and the
 * explanation that reveals it are blanked and the check is marked as graded on
 * the server. Nested remediation activities are redacted the same way.
 */
export function redactActivityForStudent(activity: LessonActivity): LessonActivity {
  const config =
    activity.config.type === "independent_check"
      ? { ...activity.config, correctAnswer: "", explanation: "", serverGraded: true }
      : activity.config;

  const remediation = activity.remediation
    ? {
        ...activity.remediation,
        remediationActivity: redactActivityForStudent(activity.remediation.remediationActivity),
        followUpCheck: redactActivityForStudent(activity.remediation.followUpCheck),
        ...(activity.remediation.stoppingPoint
          ? { stoppingPoint: redactActivityForStudent(activity.remediation.stoppingPoint) }
          : {}),
      }
    : undefined;

  return {
    ...activity,
    config,
    ...(remediation ? { remediation } : {}),
  };
}
