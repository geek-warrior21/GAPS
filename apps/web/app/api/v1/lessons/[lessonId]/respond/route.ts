import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { LessonRespondRequestSchema } from "@gaps/contracts";
import { submitLessonActivityResponse } from "@/server/lesson/service";

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const { lessonId } = await params;
    const body = await req.json();
    const parsed = LessonRespondRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid activity response payload",
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const result = await submitLessonActivityResponse(
      principal.userId,
      lessonId,
      parsed.data.activityId,
      parsed.data.response,
    );

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
