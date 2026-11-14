import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth/service";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join("; ");
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: message || "Invalid input" } },
      { status: 400 },
    );
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}
