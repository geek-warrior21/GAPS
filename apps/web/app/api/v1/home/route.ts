import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getHomeDashboard } from "@/server/session/engine";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const dashboard = await getHomeDashboard(principal.userId);
    return NextResponse.json(dashboard);
  } catch (err) {
    return errorResponse(err);
  }
}
