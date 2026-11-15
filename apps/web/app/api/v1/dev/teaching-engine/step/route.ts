import { NextResponse } from "next/server";
import { TeachingDecisionInputSchema } from "@gaps/contracts";
import { getTeachingDecisionEngine } from "@/server/teaching/factory";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parse = TeachingDecisionInputSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: parse.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const preferLlm = req.headers.get("x-prefer-llm") === "true";
    const engine = getTeachingDecisionEngine({ preferLlm });
    const decision = await engine.decideNextStep(parse.data);

    return NextResponse.json(decision);
  } catch (err) {
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
