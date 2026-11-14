import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeSqlClients,
  createStudentRepo,
  eq,
  getDb,
  seedDatabase,
  syncContent,
  users,
} from "@gaps/db";
import { AuthError, loginStaff, loginStudent, logoutUser } from "./auth/service";
import { createAuthSession, revokeSessionToken, verifySessionToken } from "./auth/session";
import { requireCoreConsent, requirePrincipal } from "./auth/guard";

describe("Phase 4: Identity, Auth, Roles, and Consent Gating", () => {
  const db = getDb();

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  describe("Student Login & Session", () => {
    it("successfully logs in seeded student Meera (join code DEMO7A, username meera, PIN 333333)", async () => {
      const result = await loginStudent(
        {
          joinCode: "DEMO7A",
          username: "meera",
          pin: "333333",
          deviceKind: "personal",
        },
        db,
      );

      expect(result.user.displayName).toBe("Meera");
      expect(result.user.role).toBe("student");
      expect(result.user.status).toBe("active");
      expect(result.user.consents).toContain("core_learning");
      expect(result.sessionToken).toBeTruthy();
      expect(result.cookieHeader).toContain("gaps_session=");
      expect(result.cookieHeader).toContain("HttpOnly");

      // Verify the returned token validates to Meera's principal
      const principal = await verifySessionToken(result.sessionToken, db);
      expect(principal).not.toBeNull();
      expect(principal?.userId).toBe(result.user.id);
      expect(principal?.role).toBe("student");
      expect(principal?.cohortName).toBe("7A");
    });

    it("rejects invalid join code", async () => {
      await expect(
        loginStudent(
          {
            joinCode: "INVALID99",
            username: "meera",
            pin: "333333",
            deviceKind: "personal",
          },
          db,
        ),
      ).rejects.toThrow(AuthError);
    });

    it("rejects incorrect PIN and locks account after 10 failed attempts", async () => {
      // Create a dedicated student for lockout testing
      const lockTestId = `stu_lock_test_${Date.now()}`;
      const repo = createStudentRepo(lockTestId, db);
      await db.insert(users).values({
        id: lockTestId,
        role: "student",
        orgId: "org_01J00000000000000000000001",
        cohortId: "coh_01J00000000000000000000001",
        displayName: "Lock Test",
        username: `lock_${Date.now()}`,
        pinHash: (await repo.getProfile())?.pinHash ?? "wrong",
        status: "active",
      });

      // Update PIN to "123456"
      const { hashPin } = await import("@gaps/db");
      await db
        .update(users)
        .set({ pinHash: hashPin("123456") })
        .where(eq(users.id, lockTestId));

      const [testUser] = await db.select().from(users).where(eq(users.id, lockTestId));

      const req = {
        joinCode: "DEMO7A",
        username: testUser!.username!,
        pin: "999999", // wrong PIN
        deviceKind: "personal" as const,
      };

      // 9 failed attempts should throw 401
      for (let i = 0; i < 9; i++) {
        await expect(loginStudent(req, db)).rejects.toThrow(
          "Invalid join code or student credentials",
        );
      }

      // 10th failed attempt should lock account with 423
      await expect(loginStudent(req, db)).rejects.toThrow(/locked/i);

      // Verify status in DB is locked
      const [lockedUser] = await db.select().from(users).where(eq(users.id, lockTestId));
      expect(lockedUser?.status).toBe("locked");
      expect(lockedUser?.failedLogins).toBe(10);
    });
  });

  describe("Staff Login (Teacher & Admin)", () => {
    it("successfully logs in teacher with email and password", async () => {
      const result = await loginStaff(
        {
          email: "teacher@demo.gaps",
          password: "TeacherDemo2026!",
        },
        db,
      );

      expect(result.user.displayName).toBe("Ananya Sharma");
      expect(result.user.role).toBe("teacher");
      expect(result.sessionToken).toBeTruthy();

      const principal = await verifySessionToken(result.sessionToken, db);
      expect(principal?.role).toBe("teacher");
    });

    it("rejects staff login with wrong password", async () => {
      await expect(
        loginStaff(
          {
            email: "teacher@demo.gaps",
            password: "WrongPassword123!",
          },
          db,
        ),
      ).rejects.toThrow("Invalid email or password");
    });
  });

  describe("Session Lifecycle & Revocation", () => {
    it("revokes session on logout", async () => {
      const session = await createAuthSession("stu_01J00000000000000000000001", "personal", db);
      expect(await verifySessionToken(session.token, db)).not.toBeNull();

      await revokeSessionToken(session.token, db);
      expect(await verifySessionToken(session.token, db)).toBeNull();
    });

    it("logout helper returns expired cookie header", async () => {
      const { clearCookieHeader } = await logoutUser("dummy_token", db);
      expect(clearCookieHeader).toContain("Max-Age=0");
    });
  });

  describe("Consent Gating & Guard", () => {
    it("allows student with core_learning consent", () => {
      expect(() =>
        requireCoreConsent({
          userId: "stu_01J00000000000000000000001",
          role: "student",
          displayName: "Meera",
          username: "meera",
          email: null,
          orgId: null,
          cohortId: "coh_01J00000000000000000000001",
          status: "active",
          consents: ["core_learning"],
        }),
      ).not.toThrow();
    });

    it("blocks student missing core_learning consent with 403", () => {
      expect(() =>
        requireCoreConsent({
          userId: "stu_01J00000000000000000000002",
          role: "student",
          displayName: "Kabir",
          username: "kabir",
          email: null,
          orgId: null,
          cohortId: "coh_01J00000000000000000000001",
          status: "pending_consent",
          consents: [],
        }),
      ).toThrow("Waiting for parent or guardian consent");
    });

    it("enforces role permissions in requirePrincipal", async () => {
      // Mock request with teacher session
      const teacherSession = await createAuthSession(
        "usr_01J00000000000000000000001",
        "personal",
        db,
      );
      const req = new Request("http://localhost/api/v1/test", {
        headers: { Cookie: `gaps_session=${teacherSession.token}` },
      });

      // Allowed for teacher
      const principal = await requirePrincipal(req, ["teacher", "staff_admin"]);
      expect(principal.role).toBe("teacher");

      // Blocked if role requires student
      await expect(requirePrincipal(req, ["student"])).rejects.toThrow(/Access denied/);
    });
  });
});
