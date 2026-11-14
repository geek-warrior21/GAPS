import { NextResponse } from "next/server";
import { StudentLoginRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { loginStudent } from "@/server/auth/service";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = StudentLoginRequestSchema.parse(body);
    const result = await loginStudent(parsed);

    const response = NextResponse.json({
      user: result.user,
      sessionToken: result.sessionToken,
    });
    response.headers.set("Set-Cookie", result.cookieHeader);
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
