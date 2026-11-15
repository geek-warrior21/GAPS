import { NextResponse } from "next/server";
import { z } from "zod";
import { SubjectIdSchema } from "@gaps/contracts";
import {
  runTeachingDecisionComparison,
  UnsupportedObjectiveError,
} from "@/server/teaching/compare";

const CompareRequestSchema = z.object({
  subject: SubjectIdSchema.default("maths"),
  objectiveId: z.string().default("MATH-FRAC-PART"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parse = CompareRequestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: parse.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const { subject, objectiveId } = parse.data;
    const result = await runTeachingDecisionComparison(subject, objectiveId);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnsupportedObjectiveError) {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_OBJECTIVE", message: err.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
