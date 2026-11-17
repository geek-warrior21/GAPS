import { NextResponse } from "next/server";
import { OpenLessonRequestSchema } from "@gaps/contracts";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { createOpenLesson } from "@/server/open-topic/session";
import { isOpenTopicStudentEntryEnabled } from "@/server/runtime-policy";

/**
 * Starts a lesson on a topic in the learner's own words (SPEC Appendix G).
 * Students only. The answer is one of: a lesson id to open, a clarification
 * question, or a reason the lesson cannot start.
 */
export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const parsed = OpenLessonRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Enter a topic (2 to 120 characters) and a class from 6 to 8.",
          },
        },
        { status: 400 },
      );
    }

    // Open topics are in developer preview. The student entry is off by default.
    if (!isOpenTopicStudentEntryEnabled()) {
      return NextResponse.json({
        status: "unavailable",
        reason: "preview_not_allowed",
        message: "Lessons on new topics are not available here yet.",
        retryable: false,
      });
    }

    const result = await createOpenLesson(principal.userId, parsed.data, getDb());
    return NextResponse.json(result, { status: result.status === "ready" ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
