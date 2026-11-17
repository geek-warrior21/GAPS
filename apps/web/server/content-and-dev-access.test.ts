import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, users, hashPin, learningSessions, seedDatabase, syncContent, eq } from "@gaps/db";
import { ContentReviewSchema, type ContentReview } from "@gaps/contracts";
import { LESSON_REGISTRY, CURRICULUM_TOPICS, TEMPLATES } from "@gaps/content";
import { createStepFromItem } from "./session/engine";
import {
  areDevToolsEnabled,
  areDraftsServable,
  isContentServable,
  isLocalBrowserTestHarness,
  isReviewed,
  type RuntimeEnv,
} from "./runtime-policy";
import {
  getCurriculumTopicsOverview,
  getPrimaryLessonIdForTopic,
  getRecommendedNextAction,
  isLessonAvailable,
  startOrResumeLessonSession,
  submitLessonActivityResponse,
} from "./lesson/service";
import { getAdaptiveLesson, listAdaptiveLessons } from "./teaching/adaptive-lessons";
import { getAdaptiveLessonAvailability } from "./teaching/availability";
import { AUTHORED_TEACHING_CONTENT_REVIEW } from "./teaching/authored-engine";
import {
  ITEM_REVIEW_RECORDS,
  getBankItems,
  getItemReview,
  selectAssessmentItem,
  selectDiagnosticItem,
} from "./teaching/item-bank";
import { createAuthSession } from "./auth/session";
import { canUseDevTools } from "./dev-tools";
import { POST as generateHandler } from "@/app/api/v1/dev/lesson-planner/generate/route";
import { POST as stepHandler } from "@/app/api/v1/dev/teaching-engine/step/route";
import { POST as compareHandler } from "@/app/api/v1/dev/teaching-engine/compare/route";
import { GET as topicsHandler } from "@/app/api/v1/curriculum/topics/route";
import { POST as lessonStartHandler } from "@/app/api/v1/lessons/[lessonId]/start/route";

const PRODUCTION: RuntimeEnv = { NODE_ENV: "production", APP_BASE_URL: "https://gaps.example" };
const DEVELOPMENT: RuntimeEnv = { NODE_ENV: "development" };

// Synthetic records used only to exercise the gate. No shipped content uses them.
const reviewed: ContentReview = {
  status: "reviewed",
  version: 1,
  authoredBy: "test-fixture",
  reviewedBy: "Test Fixture Reviewer",
  reviewedAt: "2026-01-01T00:00:00.000Z",
};
const draft: ContentReview = { status: "draft", version: 1, authoredBy: "test-fixture" };

describe("Runtime policy: review status and environment", () => {
  it("serves reviewed content everywhere and never serves retired content", () => {
    for (const env of [PRODUCTION, DEVELOPMENT, { NODE_ENV: "test" }]) {
      expect(isContentServable(reviewed, env)).toBe(true);
      expect(isContentServable({ ...reviewed, status: "retired" }, env)).toBe(false);
    }
  });

  it("production refuses drafts and missing or incomplete review records, whatever the flag says", () => {
    for (const flag of [undefined, "true", "false"]) {
      const env = { ...PRODUCTION, CONTENT_SERVE_DRAFTS: flag };
      expect(areDraftsServable(env)).toBe(false);
      expect(isContentServable(draft, env)).toBe(false);
      expect(isContentServable(undefined, env)).toBe(false);
      // "reviewed" without a named reviewer and time is not a review.
      expect(isContentServable({ status: "reviewed", version: 1, authoredBy: "x" }, env)).toBe(
        false,
      );
    }
    // The test flag alone does not unlock drafts on a non-loopback deployment.
    expect(
      areDraftsServable({ ...PRODUCTION, PLAYWRIGHT_TEST: "1", CONTENT_SERVE_DRAFTS: "true" }),
    ).toBe(false);
  });

  it("drafts are served only in the explicit local configurations", () => {
    expect(areDraftsServable(DEVELOPMENT)).toBe(true);
    expect(areDraftsServable({ ...DEVELOPMENT, CONTENT_SERVE_DRAFTS: "true" })).toBe(true);
    expect(areDraftsServable({ ...DEVELOPMENT, CONTENT_SERVE_DRAFTS: "false" })).toBe(false);

    const harness = {
      NODE_ENV: "production",
      PLAYWRIGHT_TEST: "1",
      APP_BASE_URL: "http://localhost:3000",
    };
    expect(isLocalBrowserTestHarness(harness)).toBe(true);
    expect(areDraftsServable({ ...harness, CONTENT_SERVE_DRAFTS: "true" })).toBe(true);
    expect(areDraftsServable(harness)).toBe(false); // needs the explicit flag as well
    expect(areDraftsServable({ ...harness, CONTENT_SERVE_DRAFTS: "false" })).toBe(false);
  });

  it("review records must be well formed", () => {
    expect(ContentReviewSchema.safeParse(reviewed).success).toBe(true);
    expect(ContentReviewSchema.safeParse(draft).success).toBe(true);
    expect(
      ContentReviewSchema.safeParse({ status: "reviewed", version: 1, authoredBy: "x" }).success,
    ).toBe(false);
    expect(ContentReviewSchema.safeParse({ ...draft, reviewedBy: "Someone" }).success).toBe(false);
    expect(ContentReviewSchema.safeParse({ status: "draft", authoredBy: "x" }).success).toBe(false);
    expect(isReviewed(reviewed)).toBe(true);
    expect(isReviewed(draft)).toBe(false);
    expect(isReviewed(undefined)).toBe(false);
  });

  it("developer tools are off in production and need explicit enablement elsewhere", () => {
    expect(areDevToolsEnabled(PRODUCTION)).toBe(false);
    expect(areDevToolsEnabled({ ...PRODUCTION, DEV_TOOLS_ENABLED: "true" })).toBe(false);
    expect(
      areDevToolsEnabled({ ...PRODUCTION, DEV_TOOLS_ENABLED: "true", PLAYWRIGHT_TEST: "1" }),
    ).toBe(false);
    expect(areDevToolsEnabled(DEVELOPMENT)).toBe(false);
    expect(areDevToolsEnabled({ ...DEVELOPMENT, DEV_TOOLS_ENABLED: "1" })).toBe(false);
    expect(areDevToolsEnabled({ ...DEVELOPMENT, DEV_TOOLS_ENABLED: "true" })).toBe(true);
  });
});

describe("Lesson content review metadata", () => {
  it("every shipped lesson, item and teaching set carries a valid review record", () => {
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      expect(ContentReviewSchema.safeParse(lesson.review).success).toBe(true);
    }
    for (const def of listAdaptiveLessons()) {
      expect(ContentReviewSchema.safeParse(def.review).success).toBe(true);
      expect(
        ContentReviewSchema.safeParse(AUTHORED_TEACHING_CONTENT_REVIEW[def.objectiveId]).success,
      ).toBe(true);
      for (const item of getBankItems(def.objectiveId)) {
        expect(ContentReviewSchema.safeParse(getItemReview(item.itemId)).success).toBe(true);
      }
    }
  });

  it("no shipped lesson content claims an educator review it has not had", () => {
    // This is a statement of fact about the content at this checkpoint, and a
    // tripwire: marking anything reviewed must be a deliberate change that also
    // updates this test with the real reviewer.
    const claimed: string[] = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      if (lesson.review?.status === "reviewed") claimed.push(lesson.lessonId);
    }
    for (const def of listAdaptiveLessons()) {
      if (def.review.status === "reviewed") claimed.push(def.lessonId);
      if (AUTHORED_TEACHING_CONTENT_REVIEW[def.objectiveId]?.status === "reviewed") {
        claimed.push(`teaching:${def.objectiveId}`);
      }
    }
    claimed.push(...Object.keys(ITEM_REVIEW_RECORDS));
    expect(claimed).toEqual([]);
  });

  it("production content selection excludes unreviewed assessment items and probes", () => {
    const productionOnly = (r: ContentReview | undefined) => isContentServable(r, PRODUCTION);
    const local = (r: ContentReview | undefined) => isContentServable(r, DEVELOPMENT);
    for (const def of listAdaptiveLessons()) {
      expect(selectAssessmentItem(def.objectiveId, [], productionOnly)).toBeUndefined();
      expect(selectDiagnosticItem(def.objectiveId, productionOnly)).toBeUndefined();
      expect(selectAssessmentItem(def.objectiveId, [], local)).toBeDefined();
      expect(selectDiagnosticItem(def.objectiveId, local)).toBeDefined();
    }
  });

  it("an engine-driven lesson is available in production only when every piece it can reach is reviewed", () => {
    const def = getAdaptiveLesson("lesson-maths-frac-part-adaptive")!;
    const items = getBankItems(def.objectiveId);
    const allReviewed = {
      teaching: { [def.objectiveId]: reviewed },
      item: () => reviewed,
    };
    const reviewedDef = { ...def, review: reviewed };

    // As shipped: nothing is reviewed, so production refuses it and says why.
    const shipped = getAdaptiveLessonAvailability(def, PRODUCTION);
    expect(shipped.available).toBe(false);
    expect(shipped.reasons).toHaveLength(4);
    expect(getAdaptiveLessonAvailability(def, DEVELOPMENT).available).toBe(true);

    // Fully reviewed (synthetic records): available.
    expect(getAdaptiveLessonAvailability(reviewedDef, PRODUCTION, allReviewed).available).toBe(
      true,
    );

    // Any single unreviewed piece blocks it, including the fallback teaching content.
    expect(getAdaptiveLessonAvailability(def, PRODUCTION, allReviewed).reasons).toEqual([
      "lesson definition is not reviewed",
    ]);
    expect(
      getAdaptiveLessonAvailability(reviewedDef, PRODUCTION, {
        ...allReviewed,
        teaching: { [def.objectiveId]: draft },
      }).reasons,
    ).toEqual(["authored teaching activities are not reviewed"]);
    const probeId = items.find((i) => i.kind === "diagnostic")!.itemId;
    expect(
      getAdaptiveLessonAvailability(reviewedDef, PRODUCTION, {
        ...allReviewed,
        item: (id) => (id === probeId ? draft : reviewed),
      }).reasons,
    ).toEqual(["diagnostic probe is not reviewed"]);

    // Two reviewed items cannot reach the reducer's three-item rule.
    const two = new Set(
      items
        .filter((i) => i.kind === "assessment")
        .slice(0, 2)
        .map((i) => i.itemId),
    );
    expect(
      getAdaptiveLessonAvailability(reviewedDef, PRODUCTION, {
        ...allReviewed,
        item: (id) => (two.has(id) || id === probeId ? reviewed : draft),
      }).available,
    ).toBe(false);
    // Three reviewed items from a single template cannot either.
    const oneTemplate = new Set(
      items.filter((i) => i.templateId === "tpl_adp_frac_part_name").map((i) => i.itemId),
    );
    expect(oneTemplate.size).toBeGreaterThanOrEqual(3);
    expect(
      getAdaptiveLessonAvailability(reviewedDef, PRODUCTION, {
        ...allReviewed,
        item: (id) => (oneTemplate.has(id) || id === probeId ? reviewed : draft),
      }).available,
    ).toBe(false);
  });
});

describe("Lesson services under a production environment", () => {
  const db = getDb();
  const orgId = "org_01J00000000000000000000001";
  const cohortId = "coh_01J00000000000000000000001";
  let n = 0;

  const createStudent = async (label: string) => {
    n += 1;
    const id = `stu_gate_${label}_${Date.now()}_${n}`;
    await db
      .insert(users)
      .values({
        id,
        role: "student",
        orgId,
        cohortId,
        displayName: `Gate Test ${label}`,
        username: `gate_${label}_${Date.now()}_${n}`,
        pinHash: hashPin("999999"),
        status: "active",
        avatar: { color: "teal", icon: "spark" },
        settings: {},
      })
      .onConflictDoNothing();
    return id;
  };

  const asProduction = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://gaps.example");
    vi.stubEnv("PLAYWRIGHT_TEST", "");
    vi.stubEnv("CONTENT_SERVE_DRAFTS", "true"); // must make no difference
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const allLessonIds = [
    ...Object.keys(LESSON_REGISTRY),
    ...listAdaptiveLessons().map((d) => d.lessonId),
  ];

  it("refuses to start any unreviewed lesson, fixed or engine-driven, and creates no session", async () => {
    const studentId = await createStudent("start");
    asProduction();
    for (const lessonId of allLessonIds) {
      expect(isLessonAvailable(lessonId)).toBe(false);
      await expect(startOrResumeLessonSession(studentId, lessonId, db)).rejects.toMatchObject({
        statusCode: 404,
        code: "LESSON_NOT_AVAILABLE",
      });
    }
    const sessions = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.studentId, studentId));
    expect(sessions).toHaveLength(0);
  });

  it("refuses to resume or accept answers for sessions that began where drafts were allowed", async () => {
    const studentId = await createStudent("resume");
    const fixedId = "lesson-maths-frac-part-1";
    const adaptiveId = "lesson-maths-frac-part-adaptive";
    const fixed = await startOrResumeLessonSession(studentId, fixedId, db);
    const adaptive = await startOrResumeLessonSession(studentId, adaptiveId, db);

    asProduction();
    for (const [lessonId, activityId] of [
      [fixedId, fixed.activeActivity!.id],
      [adaptiveId, adaptive.activeActivity!.id],
    ] as const) {
      await expect(startOrResumeLessonSession(studentId, lessonId, db)).rejects.toMatchObject({
        code: "LESSON_NOT_AVAILABLE",
      });
      await expect(
        submitLessonActivityResponse(studentId, lessonId, activityId, { acknowledged: true }, db),
      ).rejects.toMatchObject({ code: "LESSON_NOT_AVAILABLE" });
    }
    vi.unstubAllEnvs();

    // Back in the local configuration both sessions are intact and resume.
    const fixedAgain = await startOrResumeLessonSession(studentId, fixedId, db);
    const adaptiveAgain = await startOrResumeLessonSession(studentId, adaptiveId, db);
    expect(fixedAgain.session.id).toBe(fixed.session.id);
    expect(adaptiveAgain.session.id).toBe(adaptive.session.id);
  });

  it("practice questions come only from reviewed templates in production", async () => {
    // All 42 practice templates are drafts today, so production serves none.
    expect(TEMPLATES.every((t) => t.review.status === "draft")).toBe(true);
    const local = await createStepFromItem(db, "MATH-FRAC-PART", 1);
    expect(local.step).toBeDefined();

    asProduction();
    await expect(createStepFromItem(db, "MATH-FRAC-PART", 1)).rejects.toMatchObject({
      message: "Practice for this topic is not available yet.",
    });
  });

  it("Learn marks unreviewed lessons unavailable in production instead of linking to them", async () => {
    const studentId = await createStudent("topics");
    asProduction();
    const overview = await getCurriculumTopicsOverview(studentId, db);
    expect(overview.topics.length).toBe(CURRICULUM_TOPICS.length);
    expect(overview.topics.every((t) => t.lessonAvailable === false)).toBe(true);
  });

  it("the lesson start route answers 404 with a plain message, not a server error", async () => {
    const studentId = await createStudent("route");
    const session = await createAuthSession(studentId, "personal", db);
    asProduction();
    const res = await lessonStartHandler(
      new Request("http://localhost/api/v1/lessons/lesson-sci-circuits-adaptive/start", {
        method: "POST",
        headers: { Cookie: `gaps_session=${session.token}` },
      }),
      { params: Promise.resolve({ lessonId: "lesson-sci-circuits-adaptive" }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "LESSON_NOT_AVAILABLE", message: "This lesson is not available yet." },
    });
  });
});

describe("Learn entry points", () => {
  const db = getDb();
  let n = 0;
  const createStudent = async (label: string) => {
    n += 1;
    const id = `stu_entry_${label}_${Date.now()}_${n}`;
    await db
      .insert(users)
      .values({
        id,
        role: "student",
        orgId: "org_01J00000000000000000000001",
        cohortId: "coh_01J00000000000000000000001",
        displayName: `Entry Test ${label}`,
        username: `entry_${label}_${Date.now()}_${n}`,
        pinHash: hashPin("999999"),
        status: "active",
        avatar: { color: "teal", icon: "spark" },
        settings: {},
      })
      .onConflictDoNothing();
    return id;
  };
  const entryOf = async (studentId: string, topicId: string) =>
    (await getCurriculumTopicsOverview(studentId, db)).topics.find((t) => t.id === topicId)!;

  it("the engine-driven lesson is the primary entry for fractions and circuits; other topics keep their lessons", async () => {
    const studentId = await createStudent("primary");
    const expected: Record<string, string> = {
      "maths-frac-part": "lesson-maths-frac-part-adaptive",
      "sci-elec-circuits": "lesson-sci-circuits-adaptive",
      "maths-frac-equiv": "lesson-maths-frac-part-1",
      "sci-elec-conductors": "lesson-sci-conductors-1",
    };
    const overview = await getCurriculumTopicsOverview(studentId, db);
    for (const topic of overview.topics) {
      expect(topic.entryLessonId).toBe(expected[topic.id]);
      expect(getPrimaryLessonIdForTopic(topic)).toBe(expected[topic.id]);
      expect(topic.entryIsResume).toBe(false);
      expect(topic.lessonAvailable).toBe(true);
    }

    const first = await getRecommendedNextAction(studentId, "maths", db);
    expect(first.actionType).toBe("start_objective");
    expect(first.lessonId).toBe("lesson-maths-frac-part-adaptive");
    expect((await getRecommendedNextAction(studentId, "science", db)).lessonId).toBe(
      "lesson-sci-circuits-adaptive",
    );
  });

  it("a fixed lesson already in progress is resumed from Learn, then the primary lesson takes over", async () => {
    const studentId = await createStudent("resume");
    const fixedId = "lesson-sci-circuits-1";
    const started = await startOrResumeLessonSession(studentId, fixedId, db);
    await submitLessonActivityResponse(studentId, fixedId, "act_1_intro", { read: true }, db);

    const entry = await entryOf(studentId, "sci-elec-circuits");
    expect(entry.entryLessonId).toBe(fixedId);
    expect(entry.entryIsResume).toBe(true);
    // Other topics are unaffected.
    expect((await entryOf(studentId, "maths-frac-part")).entryIsResume).toBe(false);

    // The fixed URL still resumes the same session at the same activity.
    const resumed = await startOrResumeLessonSession(studentId, fixedId, db);
    expect(resumed.session.id).toBe(started.session.id);
    expect(resumed.currentActivityIndex).toBe(1);
    expect(resumed.activeActivity?.id).toBe("act_2_manipulation");

    // Once that session is finished, Learn opens the engine-driven lesson.
    await db
      .update(learningSessions)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(learningSessions.id, started.session.id));
    const after = await entryOf(studentId, "sci-elec-circuits");
    expect(after.entryLessonId).toBe("lesson-sci-circuits-adaptive");
    expect(after.entryIsResume).toBe(false);
  });

  it("an engine-driven lesson in progress is also resumed, and staff see only primary entries", async () => {
    const studentId = await createStudent("adaptive");
    await startOrResumeLessonSession(studentId, "lesson-maths-frac-part-adaptive", db);
    const entry = await entryOf(studentId, "maths-frac-part");
    expect(entry.entryLessonId).toBe("lesson-maths-frac-part-adaptive");
    expect(entry.entryIsResume).toBe(true);

    const staffView = await getCurriculumTopicsOverview(undefined, db);
    expect(staffView.topics.every((t) => t.entryIsResume === false)).toBe(true);
  });
});

describe("Developer tools authorization (every role, direct API requests)", () => {
  const db = getDb();
  const ids = {
    student: "stu_01J00000000000000000000001",
    teacher: "usr_01J00000000000000000000001",
    staff_admin: "usr_01J00000000000000000000002",
  };
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
    for (const [role, id] of Object.entries(ids)) {
      const session = await createAuthSession(id, "personal", db);
      cookies[role] = `gaps_session=${session.token}`;
    }
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const routes = [
    {
      name: "lesson-planner/generate",
      handler: generateHandler,
      body: {
        subject: "maths",
        level: 6,
        topicId: "maths-frac-part",
        objectiveId: "MATH-FRAC-PART",
        learnerProfile: { profileType: "struggling", namedMisconception: "REVERSAL" },
      },
    },
    {
      name: "teaching-engine/step",
      handler: stepHandler,
      body: { objectiveId: "MATH-FRAC-PART", subject: "maths" },
    },
    {
      name: "teaching-engine/compare",
      handler: compareHandler,
      body: { subject: "maths", objectiveId: "MATH-FRAC-PART" },
    },
  ] as const;

  const call = (route: (typeof routes)[number], cookie?: string, bearer?: string) =>
    route.handler(
      new Request(`http://localhost/api/v1/dev/${route.name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(route.body),
      }),
    );

  const expectNoToolOutput = (text: string) => {
    expect(text).not.toContain("correctAnswer");
    expect(text).not.toContain("activity");
    expect(text).not.toContain("eligibleActions");
    expect(text).not.toContain("plan");
  };

  it("production: every route answers 404 for every caller, including a staff admin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_TOOLS_ENABLED", "true"); // must make no difference in production
    for (const route of routes) {
      for (const cookie of [undefined, cookies.student, cookies.teacher, cookies.staff_admin]) {
        const res = await call(route, cookie);
        expect(res.status).toBe(404);
        const text = await res.text();
        expect(JSON.parse(text)).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
        expectNoToolOutput(text);
      }
    }
    expect(await canUseDevTools(cookies.staff_admin!.split("=")[1])).toBe(false);
  });

  it("not explicitly enabled: every route answers 404 for every caller", async () => {
    vi.stubEnv("DEV_TOOLS_ENABLED", "");
    for (const route of routes) {
      for (const cookie of [undefined, cookies.student, cookies.staff_admin]) {
        expect((await call(route, cookie)).status).toBe(404);
      }
    }
  });

  it("enabled: unauthenticated callers get 401; students and teachers get 403; nothing is returned", async () => {
    vi.stubEnv("DEV_TOOLS_ENABLED", "true");
    for (const route of routes) {
      const anonymous = await call(route);
      expect(anonymous.status).toBe(401);
      expectNoToolOutput(await anonymous.text());

      const forged = await call(route, "gaps_session=not-a-real-token");
      expect(forged.status).toBe(401);
      expect((await call(route, undefined, "not-a-real-token")).status).toBe(401);

      for (const role of ["student", "teacher"] as const) {
        const res = await call(route, cookies[role]);
        expect(res.status).toBe(403);
        const text = await res.text();
        expect(JSON.parse(text).error.code).toBe("FORBIDDEN");
        expectNoToolOutput(text);
      }
    }
    expect(await canUseDevTools(cookies.student!.split("=")[1])).toBe(false);
    expect(await canUseDevTools(cookies.teacher!.split("=")[1])).toBe(false);
    expect(await canUseDevTools(undefined)).toBe(false);
    expect(await canUseDevTools("not-a-real-token")).toBe(false);
  });

  it("enabled: a staff admin can use every route", async () => {
    vi.stubEnv("DEV_TOOLS_ENABLED", "true");
    for (const route of routes) {
      const res = await call(route, cookies.staff_admin);
      expect(res.status).toBe(200);
    }
    const compare = await (await call(routes[2], cookies.staff_admin)).json();
    expect(compare.traces.succeeding.masteryDemonstrated).toBe(true);
    expect(await canUseDevTools(cookies.staff_admin!.split("=")[1])).toBe(true);
  });

  it("the student topics route exposes entry points but no answers or review internals", async () => {
    const res = await topicsHandler(
      new Request("http://localhost/api/v1/curriculum/topics", {
        headers: { Cookie: cookies.student! },
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("entryLessonId");
    expect(text).not.toContain("correctAnswer");
    expect(text).not.toContain("reviewedBy");
    expect(
      (await topicsHandler(new Request("http://localhost/api/v1/curriculum/topics"))).status,
    ).toBe(401);
  });
});
