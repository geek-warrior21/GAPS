import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getConceptsOverview } from "@/server/session/engine";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const overview = await getConceptsOverview(principal.userId);
    return NextResponse.json(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
