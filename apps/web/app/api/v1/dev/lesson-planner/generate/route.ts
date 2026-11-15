import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { LessonPlanGenerateRequestSchema } from "@gaps/contracts";
import { LlmLessonPlanner } from "@/server/lesson/planner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LessonPlanGenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Invalid lesson plan generation request: " +
              parsed.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 },
      );
    }

    const { subject, topicId, level, objectiveId, learnerProfile } = parsed.data;

    const planner = new LlmLessonPlanner();
    const result = await planner.planLessonWithDetails({
      subject,
      topicId,
      level,
      objectiveId,
      learnerProfile,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
