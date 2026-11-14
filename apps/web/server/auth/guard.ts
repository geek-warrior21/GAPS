import type { UserRole } from "@gaps/contracts";
import { AuthError } from "./service";
import { verifySessionToken, type Principal } from "./session";

export function extractTokenFromRequest(req: Request): string | null {
  // 1. Try Cookie header
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("gaps_session=")) {
        const token = cookie.slice("gaps_session=".length).trim();
        if (token) return token;
      }
    }
  }

  // 2. Try Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    if (token) return token;
  }

  return null;
}

export async function getPrincipal(req: Request): Promise<Principal | null> {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function requirePrincipal(
  req: Request,
  allowedRoles?: readonly UserRole[],
): Promise<Principal> {
  const principal = await getPrincipal(req);

  if (!principal) {
    throw new AuthError("Authentication required", 401, "UNAUTHORIZED");
  }

  if (allowedRoles && !allowedRoles.includes(principal.role)) {
    throw new AuthError(`Access denied for role '${principal.role}'`, 403, "FORBIDDEN");
  }

  return principal;
}

export function requireCoreConsent(principal: Principal): void {
  if (principal.role === "student" && !principal.consents.includes("core_learning")) {
    throw new AuthError(
      "Waiting for parent or guardian consent before learning sessions can start.",
      403,
      "CONSENT_REQUIRED",
    );
  }
}
