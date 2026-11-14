import { describe, expect, it } from "vitest";
import { getDb, users, hashPin } from "@gaps/db";
import {
  getCurriculumTopicsOverview,
  startOrResumeLessonSession,
  getLessonSession,
  submitLessonActivityResponse,
} from "./lesson/service";
import { AuthoredLessonPlanner, LlmLessonPlanner } from "./lesson/planner";
import { MATHS_FRAC_PART_LESSON, SCI_CIRCUITS_LESSON, SCI_CONDUCTORS_LESSON } from "@gaps/content";

describe("Dynamic Teaching Vertical Slice (Maths & Science)", () => {
  const db = getDb();
  const orgId = "org_01J00000000000000000000001";
  const cohortId = "coh_01J00000000000000000000001";

  const createTestStudent = async (id: string, username: string) => {
    await db
      .insert(users)
      .values({
        id,
        role: "student",
        orgId,
        cohortId,
        displayName: `Test Student ${username}`,
        username,
        pinHash: hashPin("999999"),
        status: "active",
        avatar: { color: "teal", icon: "spark" },
        settings: {},
      })
      .onConflictDoNothing();
  };

  it("1. Topics catalog includes entries for Mathematics and Science", async () => {
    const overview = await getCurriculumTopicsOverview();
    expect(overview.topics.length).toBeGreaterThanOrEqual(3);

    const mathTopic = overview.topics.find((t) => t.subject === "maths");
    expect(mathTopic).toBeDefined();
    expect(mathTopic?.title).toContain("Parts of a Whole");

    const scienceTopic = overview.topics.find((t) => t.subject === "science");
    expect(scienceTopic).toBeDefined();
    expect(scienceTopic?.title).toContain("Electric Current");
  });

  it("2. Complete Lesson 1 (Maths: Fractions) runs end to end with verification", async () => {
    const studentId = `stu_lesson_math_${Date.now()}`;
    await createTestStudent(studentId, `math_${Date.now()}`);

    // A: Start lesson session
    const startRes = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );
    expect(startRes.session.mode).toBe("lesson");
    expect(startRes.lesson.lessonId).toBe(MATHS_FRAC_PART_LESSON.lessonId);
    expect(startRes.currentActivityIndex).toBe(0);

    // B: Step 1 (Intro)
    const act1 = startRes.lesson.activities[0]!;
    const res1 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      act1.id,
      { read: true },
      db,
    );
    expect(res1.accepted).toBe(true);
    expect(res1.nextActivityIndex).toBe(1);

    // C: Step 2 (Interactive Manipulation)
    const act2 = startRes.lesson.activities[1]!;
    const res2 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      act2.id,
      { parts: 6, shaded: 3 },
      db,
    );
    expect(res2.accepted).toBe(true);
    expect(res2.nextActivityIndex).toBe(2);

    // D: Step 3 (Predict & Observe)
    const act3 = startRes.lesson.activities[2]!;
    const res3 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      act3.id,
      { choiceId: "choice_3_4" },
      db,
    );
    expect(res3.accepted).toBe(true);
    expect(res3.isCorrect).toBe(true);
    expect(res3.nextActivityIndex).toBe(3);

    // E: Step 4 (Guided Practice)
    const act4 = startRes.lesson.activities[3]!;
    const res4 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      act4.id,
      { value: "2/5" },
      db,
    );
    expect(res4.accepted).toBe(true);
    expect(res4.isCorrect).toBe(true);
    expect(res4.nextActivityIndex).toBe(4);

    // F: Step 5 (Independent Check)
    const act5 = startRes.lesson.activities[4]!;
    const res5 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      act5.id,
      { answer: "choice_a" },
      db,
    );
    expect(res5.accepted).toBe(true);
    expect(res5.isCorrect).toBe(true);
    expect(res5.isCompleted).toBe(true);
    expect(res5.sparksAwarded).toBe(15);
  });

  it("3. Complete Lesson 2 (Science: Simple Circuits) runs end to end with simulation & prediction", async () => {
    const studentId = `stu_lesson_sci_${Date.now()}`;
    await createTestStudent(studentId, `sci_${Date.now()}`);

    // A: Start science lesson session
    const startRes = await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    expect(startRes.session.mode).toBe("lesson");
    expect(startRes.lesson.lessonId).toBe(SCI_CIRCUITS_LESSON.lessonId);
    expect(startRes.currentActivityIndex).toBe(0);

    // B: Step 1 (Intro)
    const act1 = startRes.lesson.activities[0]!;
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      act1.id,
      { read: true },
      db,
    );

    // C: Step 2 (Interactive Circuit Sandbox)
    const act2 = startRes.lesson.activities[1]!;
    const res2 = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      act2.id,
      { switchState: "closed", wireConnected: true },
      db,
    );
    expect(res2.accepted).toBe(true);
    expect(res2.nextActivityIndex).toBe(2);

    // D: Step 3 (Predict & Observe open switch)
    const act3 = startRes.lesson.activities[2]!;
    const res3 = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      act3.id,
      { choiceId: "choice_dark" },
      db,
    );
    expect(res3.accepted).toBe(true);
    expect(res3.isCorrect).toBe(true);
    expect(res3.feedback).toContain("continuous conducting path");

    // E: Step 4 (Guided Practice: close switch)
    const act4 = startRes.lesson.activities[3]!;
    const res4 = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      act4.id,
      { value: "closed" },
      db,
    );
    expect(res4.accepted).toBe(true);
    expect(res4.isCorrect).toBe(true);

    // F: Step 5 (Independent Check)
    const act5 = startRes.lesson.activities[4]!;
    const res5 = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      act5.id,
      { answer: "choice_a" },
      db,
    );
    expect(res5.accepted).toBe(true);
    expect(res5.isCorrect).toBe(true);
    expect(res5.isCompleted).toBe(true);
    expect(res5.sparksAwarded).toBe(15);
  });

  it("4. Progress saving and resume behaviour preserves state on reload", async () => {
    const studentId = `stu_lesson_res_${Date.now()}`;
    await createTestStudent(studentId, `res_${Date.now()}`);

    // Start lesson and complete first two steps
    const session1 = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );
    expect(session1.currentActivityIndex).toBe(0);

    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      session1.lesson.activities[0]!.id,
      { read: true },
      db,
    );

    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      session1.lesson.activities[1]!.id,
      { parts: 5, shaded: 2 },
      db,
    );

    // Simulate page refresh / reconnect:
    const reloaded = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);

    expect(reloaded.currentActivityIndex).toBe(2);
    expect(reloaded.completedActivities).toContain(session1.lesson.activities[0]!.id);
    expect(reloaded.completedActivities).toContain(session1.lesson.activities[1]!.id);
    expect(reloaded.activityResponses[session1.lesson.activities[1]!.id]).toEqual({
      parts: 5,
      shaded: 2,
    });
  });

  it("5. Invalid lesson data falls back safely without failing", async () => {
    const planner = new AuthoredLessonPlanner();
    const fallbackLesson = await planner.planLesson({
      subject: "science",
      topicId: "non_existent_topic_id",
      level: 6,
    });

    expect(fallbackLesson).toBeDefined();
    expect(fallbackLesson.subject).toBe("science");
    expect(fallbackLesson.activities.length).toBeGreaterThanOrEqual(2);

    const llmPlanner = new LlmLessonPlanner(planner);
    // When LLM is disabled (default), LlmLessonPlanner safely falls back to authored lesson
    const plan = await llmPlanner.planLesson({
      subject: "maths",
      topicId: "any_topic",
      level: 6,
    });
    expect(plan).toBeDefined();
    expect(plan.lessonId).toBe(MATHS_FRAC_PART_LESSON.lessonId);
  });

  it("6. Another topic can be added purely through configuration and runs through existing activities", async () => {
    const studentId = `stu_lesson_conf_${Date.now()}`;
    await createTestStudent(studentId, `conf_${Date.now()}`);

    // Topic 3: Conductors & Insulators (SCI_CONDUCTORS_LESSON) is purely configuration
    expect(SCI_CONDUCTORS_LESSON).toBeDefined();
    expect(SCI_CONDUCTORS_LESSON.topicId).toBe("sci-elec-conductors");

    const session = await startOrResumeLessonSession(studentId, SCI_CONDUCTORS_LESSON.lessonId, db);

    expect(session.lesson.title).toContain("Conductors & Insulators");
    expect(session.lesson.activities).toHaveLength(3);

    // Step 1: Intro
    await submitLessonActivityResponse(
      studentId,
      SCI_CONDUCTORS_LESSON.lessonId,
      session.lesson.activities[0]!.id,
      { read: true },
      db,
    );

    // Step 2: Predict testing copper key
    const resPredict = await submitLessonActivityResponse(
      studentId,
      SCI_CONDUCTORS_LESSON.lessonId,
      session.lesson.activities[1]!.id,
      { choiceId: "choice_key_glow" },
      db,
    );
    expect(resPredict.isCorrect).toBe(true);

    // Step 3: Independent check
    const resCheck = await submitLessonActivityResponse(
      studentId,
      SCI_CONDUCTORS_LESSON.lessonId,
      session.lesson.activities[2]!.id,
      { answer: "choice_rubber_eraser" },
      db,
    );
    expect(resCheck.isCorrect).toBe(true);
    expect(resCheck.isCompleted).toBe(true);
  });
});
