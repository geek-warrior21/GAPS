import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { initSolveWithMe } from "@/server/session/engine";
import { SolveInitRequestSchema } from "@gaps/contracts";

export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const json = await req.json().catch(() => ({}));
    const parsed = SolveInitRequestSchema.parse(json);
    const result = await initSolveWithMe(principal.userId, parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
