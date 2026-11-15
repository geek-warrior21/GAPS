import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getRecommendedNextAction } from "@/server/lesson/service";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const url = new URL(req.url);
    const subjectParam = url.searchParams.get("subject");
    const subject =
      subjectParam === "maths" || subjectParam === "science" ? subjectParam : undefined;

    const nextAction = await getRecommendedNextAction(principal.userId, subject);
    return NextResponse.json(nextAction);
  } catch (err) {
    return errorResponse(err);
  }
}
