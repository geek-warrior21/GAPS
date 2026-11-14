import { createHash, randomBytes } from "node:crypto";
import {
  and,
  authSessions,
  cohorts,
  consentRecords,
  eq,
  getDb,
  gt,
  isNull,
  users,
  type DbClient,
} from "@gaps/db";
import type { ConsentScope, UserRole, UserStatus } from "@gaps/contracts";

export interface Principal {
  readonly userId: string;
  readonly role: UserRole;
  readonly displayName: string;
  readonly username: string | null;
  readonly email: string | null;
  readonly orgId: string | null;
  readonly cohortId: string | null;
  readonly cohortName?: string | null;
  readonly status: UserStatus;
  readonly consents: readonly ConsentScope[];
}

export interface SessionResult {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthSession(
  userId: string,
  deviceKind: "personal" | "shared" = "personal",
  db: DbClient = getDb(),
): Promise<SessionResult> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  // Expiry: 8 hours for shared device, 30 days for personal device
  const durationMs = deviceKind === "shared" ? 8 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);

  await db.insert(authSessions).values({
    id: tokenHash,
    userId,
    deviceKind,
    expiresAt,
  });

  return { token, tokenHash, expiresAt };
}

export async function verifySessionToken(
  token: string,
  db: DbClient = getDb(),
): Promise<Principal | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Find active session
  const [session] = await db
    .select({
      sessionId: authSessions.id,
      userId: authSessions.userId,
      expiresAt: authSessions.expiresAt,
      revokedAt: authSessions.revokedAt,
      user: users,
      cohortName: cohorts.name,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .leftJoin(cohorts, eq(users.cohortId, cohorts.id))
    .where(
      and(
        eq(authSessions.id, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  // Update last seen timestamp asynchronously
  db.update(authSessions)
    .set({ lastSeenAt: now })
    .where(eq(authSessions.id, tokenHash))
    .catch(() => {});

  // Fetch active consents for user
  const activeConsents = await db
    .select({ scope: consentRecords.scope })
    .from(consentRecords)
    .where(and(eq(consentRecords.studentId, session.user.id), isNull(consentRecords.revokedAt)));

  const consents = activeConsents.map((c) => c.scope as ConsentScope);

  return {
    userId: session.user.id,
    role: session.user.role as UserRole,
    displayName: session.user.displayName,
    username: session.user.username,
    email: session.user.email,
    orgId: session.user.orgId,
    cohortId: session.user.cohortId,
    cohortName: session.cohortName ?? null,
    status: session.user.status as UserStatus,
    consents,
  };
}

export async function revokeSessionToken(token: string, db: DbClient = getDb()): Promise<boolean> {
  const tokenHash = hashToken(token);
  const [updated] = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, tokenHash))
    .returning();
  return Boolean(updated);
}
