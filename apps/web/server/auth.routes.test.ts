import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSqlClients, getDb, seedDatabase, syncContent } from "@gaps/db";
import { createAuthSession } from "./auth/session";
import { POST as studentLoginHandler } from "@/app/api/v1/auth/student-login/route";
import { POST as staffLoginHandler } from "@/app/api/v1/auth/staff-login/route";
import { POST as logoutHandler } from "@/app/api/v1/auth/logout/route";
import { GET as meHandler } from "@/app/api/v1/me/route";
import { GET as rosterHandler } from "@/app/api/v1/cohorts/[cohortId]/roster/route";
import { POST as addStudentHandler } from "@/app/api/v1/cohorts/[cohortId]/students/route";
import { POST as consentHandler } from "@/app/api/v1/students/[studentId]/consent/route";
import { POST as resetPinHandler } from "@/app/api/v1/students/[studentId]/reset-pin/route";

describe("Phase 4: Auth & Roster HTTP API Routes", () => {
  const db = getDb();

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  it("POST /api/v1/auth/student-login handles valid and invalid logins", async () => {
    // Valid login
    const validReq = new Request("http://localhost/api/v1/auth/student-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        joinCode: "DEMO7A",
        username: "meera",
        pin: "333333",
      }),
    });
    const validRes = await studentLoginHandler(validReq);
    expect(validRes.status).toBe(200);
    const validData = await validRes.json();
    expect(validData.user.displayName).toBe("Meera");
    expect(validRes.headers.get("Set-Cookie")).toContain("gaps_session=");

    // Invalid login
    const invalidReq = new Request("http://localhost/api/v1/auth/student-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        joinCode: "DEMO7A",
        username: "meera",
        pin: "000000",
      }),
    });
    const invalidRes = await studentLoginHandler(invalidReq);
    expect(invalidRes.status).toBe(401);
    const invalidData = await invalidRes.json();
    expect(invalidData.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /api/v1/auth/staff-login handles staff authentication", async () => {
    const req = new Request("http://localhost/api/v1/auth/staff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "teacher@demo.gaps",
        password: "TeacherDemo2026!",
      }),
    });
    const res = await staffLoginHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.role).toBe("teacher");
    expect(res.headers.get("Set-Cookie")).toContain("gaps_session=");
  });

  it("GET /api/v1/me returns current user profile or 401 when unauthorized", async () => {
    // Unauthorized
    const unauthReq = new Request("http://localhost/api/v1/me");
    const unauthRes = await meHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Authorized as student Meera
    const meeraSession = await createAuthSession("stu_01J00000000000000000000001", "personal", db);
    const authReq = new Request("http://localhost/api/v1/me", {
      headers: { Cookie: `gaps_session=${meeraSession.token}` },
    });
    const authRes = await meHandler(authReq);
    expect(authRes.status).toBe(200);
    const authData = await authRes.json();
    expect(authData.user.id).toBe("stu_01J00000000000000000000001");
    expect(authData.user.displayName).toBe("Meera");
    expect(authData.user.consents).toContain("core_learning");
  });

  it("POST /api/v1/auth/logout clears cookie and revokes session", async () => {
    const session = await createAuthSession("stu_01J00000000000000000000001", "personal", db);
    const req = new Request("http://localhost/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: `gaps_session=${session.token}` },
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("GET /api/v1/cohorts/[cohortId]/roster returns cohort roster for assigned teacher and 403 for student", async () => {
    const cohortId = "coh_01J00000000000000000000001";

    // Teacher of Cohort 7A
    const teacherSession = await createAuthSession(
      "usr_01J00000000000000000000001",
      "personal",
      db,
    );
    const teacherReq = new Request(`http://localhost/api/v1/cohorts/${cohortId}/roster`, {
      headers: { Cookie: `gaps_session=${teacherSession.token}` },
    });
    const teacherRes = await rosterHandler(teacherReq, { params: Promise.resolve({ cohortId }) });
    expect(teacherRes.status).toBe(200);
    const rosterData = await teacherRes.json();
    expect(rosterData.roster.length).toBeGreaterThanOrEqual(3);
    const meera = rosterData.roster.find((r: { username: string }) => r.username === "meera");
    expect(meera).toBeDefined();
    expect(meera.hasCoreConsent).toBe(true);

    // Student requesting roster should receive 403 Forbidden
    const studentSession = await createAuthSession(
      "stu_01J00000000000000000000001",
      "personal",
      db,
    );
    const studentReq = new Request(`http://localhost/api/v1/cohorts/${cohortId}/roster`, {
      headers: { Cookie: `gaps_session=${studentSession.token}` },
    });
    const studentRes = await rosterHandler(studentReq, { params: Promise.resolve({ cohortId }) });
    expect(studentRes.status).toBe(403);
  });

  it("manages student lifecycle: create student, record consent, and reset PIN", async () => {
    const cohortId = "coh_01J00000000000000000000001";
    const teacherSession = await createAuthSession(
      "usr_01J00000000000000000000001",
      "personal",
      db,
    );
    const headers = {
      Cookie: `gaps_session=${teacherSession.token}`,
      "Content-Type": "application/json",
    };

    // 1. Teacher adds a new student
    const newUsername = `rohit_${Date.now()}`;
    const addReq = new Request(`http://localhost/api/v1/cohorts/${cohortId}/students`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        displayName: "Rohit",
        username: newUsername,
        pin: "123456",
      }),
    });
    const addRes = await addStudentHandler(addReq, { params: Promise.resolve({ cohortId }) });
    expect(addRes.status).toBe(201);
    const createdData = await addRes.json();
    const newStudentId = createdData.student.id;
    expect(createdData.student.status).toBe("pending_consent");

    // 2. Teacher records core_learning consent
    const consentReq = new Request(`http://localhost/api/v1/students/${newStudentId}/consent`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        scope: "core_learning",
        method: "school_paper",
        evidenceRef: "PAPER-FORM-ROHIT-01",
      }),
    });
    const consentRes = await consentHandler(consentReq, {
      params: Promise.resolve({ studentId: newStudentId }),
    });
    expect(consentRes.status).toBe(201);

    // 3. Teacher resets student PIN
    const resetReq = new Request(`http://localhost/api/v1/students/${newStudentId}/reset-pin`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        newPin: "654321",
      }),
    });
    const resetRes = await resetPinHandler(resetReq, {
      params: Promise.resolve({ studentId: newStudentId }),
    });
    expect(resetRes.status).toBe(200);

    // 4. Student logs in with new PIN
    const loginReq = new Request("http://localhost/api/v1/auth/student-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        joinCode: "DEMO7A",
        username: newUsername,
        pin: "654321",
      }),
    });
    const loginRes = await studentLoginHandler(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.user.status).toBe("active");
    expect(loginData.user.consents).toContain("core_learning");
  });
});
