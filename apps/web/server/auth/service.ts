import {
  and,
  cohorts,
  consentRecords,
  eq,
  getDb,
  isNull,
  sql,
  users,
  verifyPassword,
  verifyPin,
  type DbClient,
} from "@gaps/db";
import type {
  ConsentScope,
  StaffLoginRequest,
  StudentLoginRequest,
  UserProfileDto,
  UserRole,
  UserStatus,
} from "@gaps/contracts";
import { createAuthSession, revokeSessionToken } from "./session";

export interface AuthResult {
  readonly user: UserProfileDto;
  readonly sessionToken: string;
  readonly cookieHeader: string;
}

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 401, code = "UNAUTHORIZED") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const isSecure =
    process.env.NODE_ENV === "production" &&
    process.env.COOKIE_INSECURE !== "true" &&
    process.env.PLAYWRIGHT_TEST !== "1";
  const secureFlag = isSecure ? "; Secure" : "";
  return `gaps_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

export function buildClearCookie(): string {
  const isSecure =
    process.env.NODE_ENV === "production" &&
    process.env.COOKIE_INSECURE !== "true" &&
    process.env.PLAYWRIGHT_TEST !== "1";
  const secureFlag = isSecure ? "; Secure" : "";
  return `gaps_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

export async function loginStudent(
  req: StudentLoginRequest,
  db: DbClient = getDb(),
): Promise<AuthResult> {
  const joinCode = req.joinCode.trim().toUpperCase();
  const username = req.username.trim().toLowerCase();

  // 1. Find cohort by joinCode
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.joinCode, joinCode)).limit(1);

  if (!cohort) {
    throw new AuthError("Invalid join code or student credentials", 401, "INVALID_CREDENTIALS");
  }

  // 2. Find user in cohort
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.cohortId, cohort.id),
        sql`LOWER(${users.username}) = ${username}`,
        eq(users.role, "student"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) {
    throw new AuthError("Invalid join code or student credentials", 401, "INVALID_CREDENTIALS");
  }

  // 3. Check lockout
  const now = new Date();
  if (user.status === "locked") {
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AuthError(
        "Account is locked due to too many failed attempts. Please try again later or ask your teacher.",
        423,
        "ACCOUNT_LOCKED",
      );
    }
    // Lock period expired, reset to active/pending_consent
  }

  // 4. Verify PIN
  if (!user.pinHash) {
    throw new AuthError("Student account has no PIN configured", 401, "NO_PIN_CONFIGURED");
  }

  const isPinValid = verifyPin(req.pin, user.pinHash);

  if (!isPinValid) {
    const newFailed = user.failedLogins + 1;
    if (newFailed >= 10) {
      // Lock account for 15 minutes
      const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
      await db
        .update(users)
        .set({
          status: "locked",
          failedLogins: newFailed,
          lockedUntil: lockUntil,
        })
        .where(eq(users.id, user.id));
      throw new AuthError(
        "Account is locked due to too many failed attempts. Please ask your teacher to reset your PIN.",
        423,
        "ACCOUNT_LOCKED",
      );
    }

    await db.update(users).set({ failedLogins: newFailed }).where(eq(users.id, user.id));

    throw new AuthError("Invalid join code or student credentials", 401, "INVALID_CREDENTIALS");
  }

  // 5. Successful PIN verification: reset failed logins
  if (user.failedLogins > 0 || user.status === "locked") {
    const recoveredStatus = user.status === "locked" ? "active" : user.status;
    await db
      .update(users)
      .set({
        failedLogins: 0,
        lockedUntil: null,
        status: recoveredStatus,
      })
      .where(eq(users.id, user.id));
  }

  // 6. Create session
  const { token, expiresAt } = await createAuthSession(user.id, req.deviceKind, db);
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  const cookieHeader = buildSessionCookie(token, maxAgeSeconds);

  // 7. Get active consents
  const consents = await db
    .select({ scope: consentRecords.scope })
    .from(consentRecords)
    .where(and(eq(consentRecords.studentId, user.id), isNull(consentRecords.revokedAt)));

  const consentScopes = consents.map((c) => c.scope as ConsentScope);

  const userProfile: UserProfileDto = {
    id: user.id,
    role: user.role as UserRole,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    orgId: user.orgId,
    cohortId: user.cohortId,
    cohortName: cohort.name,
    status: user.status as UserStatus,
    consents: consentScopes,
    avatar: (user.avatar as Record<string, unknown>) ?? {},
  };

  return {
    user: userProfile,
    sessionToken: token,
    cookieHeader,
  };
}

export async function loginStaff(
  req: StaffLoginRequest,
  db: DbClient = getDb(),
): Promise<AuthResult> {
  const email = req.email.trim().toLowerCase();

  // 1. Find staff user by email
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        sql`LOWER(${users.email}) = ${email}`,
        sql`${users.role} IN ('teacher', 'staff_admin')`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) {
    throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  // 2. Check lockout
  const now = new Date();
  if (user.status === "locked") {
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AuthError(
        "Account is locked due to too many failed attempts. Try again in 15 minutes.",
        423,
        "ACCOUNT_LOCKED",
      );
    }
  }

  // 3. Verify password
  if (!user.passwordHash) {
    throw new AuthError("Staff user has no password configured", 401, "NO_PASSWORD_CONFIGURED");
  }

  const isPasswordValid = verifyPassword(req.password, user.passwordHash);

  if (!isPasswordValid) {
    const newFailed = user.failedLogins + 1;
    if (newFailed >= 5) {
      const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
      await db
        .update(users)
        .set({
          status: "locked",
          failedLogins: newFailed,
          lockedUntil: lockUntil,
        })
        .where(eq(users.id, user.id));
      throw new AuthError(
        "Account locked due to 5 consecutive failed attempts. Try again in 15 minutes.",
        423,
        "ACCOUNT_LOCKED",
      );
    }

    await db.update(users).set({ failedLogins: newFailed }).where(eq(users.id, user.id));

    throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  // 4. Reset failed logins on success
  if (user.failedLogins > 0 || user.status === "locked") {
    await db
      .update(users)
      .set({
        failedLogins: 0,
        lockedUntil: null,
        status: "active",
      })
      .where(eq(users.id, user.id));
  }

  // 5. Create session (staff session default personal = 30 days)
  const { token, expiresAt } = await createAuthSession(user.id, "personal", db);
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  const cookieHeader = buildSessionCookie(token, maxAgeSeconds);

  const userProfile: UserProfileDto = {
    id: user.id,
    role: user.role as UserRole,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    orgId: user.orgId,
    cohortId: user.cohortId,
    status: user.status as UserStatus,
    consents: [],
    avatar: (user.avatar as Record<string, unknown>) ?? {},
  };

  return {
    user: userProfile,
    sessionToken: token,
    cookieHeader,
  };
}

export async function logoutUser(
  token: string,
  db: DbClient = getDb(),
): Promise<{ success: boolean; clearCookieHeader: string }> {
  await revokeSessionToken(token, db);
  return {
    success: true,
    clearCookieHeader: buildClearCookie(),
  };
}
