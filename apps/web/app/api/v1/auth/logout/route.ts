import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { extractTokenFromRequest } from "@/server/auth/guard";
import { logoutUser } from "@/server/auth/service";

export async function POST(req: Request) {
  try {
    const token = extractTokenFromRequest(req);
    let clearCookieHeader = "gaps_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

    if (token) {
      const res = await logoutUser(token);
      clearCookieHeader = res.clearCookieHeader;
    }

    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", clearCookieHeader);
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
