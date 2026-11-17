import { NextResponse } from "next/server";
import { LessonRespondRequestSchema } from "@gaps/contracts";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireDevTools } from "@/server/dev-tools";
import { respondToPreviewLesson } from "@/server/open-topic/dev-preview";
import { isOpenLessonId } from "@/server/open-topic/session";

/** Developer preview: answer the current step as the synthetic learner. */
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    await requireDevTools(req);
    const { lessonId } = await params;
    const parsed = LessonRespondRequestSchema.safeParse(await req.json().catch(() => null));
    if (!isOpenLessonId(lessonId) || !parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid activity response payload" } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await respondToPreviewLesson(lessonId, parsed.data.activityId, parsed.data.response, getDb()),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
