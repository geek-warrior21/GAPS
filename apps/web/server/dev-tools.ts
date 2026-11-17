import { AuthError } from "./auth/service";
import { requirePrincipal } from "./auth/guard";
import { verifySessionToken, type Principal } from "./auth/session";
import { areDevToolsEnabled, type RuntimeEnv, runtimeEnv } from "./runtime-policy";

/**
 * Access control for developer tools (/dev/* pages and /api/v1/dev/* routes).
 *
 * These tools return preview lesson plans, answer keys and synthetic-engine
 * controls. They are unavailable in production, off elsewhere unless
 * DEV_TOOLS_ENABLED=true, and then open only to a signed-in staff admin.
 * When disabled they answer 404, so their existence is not advertised.
 */
export async function requireDevTools(
  req: Request,
  env: RuntimeEnv = runtimeEnv(),
): Promise<Principal> {
  if (!areDevToolsEnabled(env)) {
    throw new AuthError("Not found", 404, "NOT_FOUND");
  }
  return requirePrincipal(req, ["staff_admin"]);
}

/** Same rule for server-rendered pages, which hold a session token, not a Request. */
export async function canUseDevTools(
  sessionToken: string | undefined,
  env: RuntimeEnv = runtimeEnv(),
): Promise<boolean> {
  if (!areDevToolsEnabled(env) || !sessionToken) return false;
  const principal = await verifySessionToken(sessionToken);
  return principal?.role === "staff_admin";
}
