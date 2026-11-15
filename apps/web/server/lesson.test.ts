import { describe, expect, it } from "vitest";
import { getDb, users, hashPin, events, conceptBeliefs, eq } from "@gaps/db";
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

  it("7. Maths struggling-student path triggers targeted remediation, fresh check, stopping point, and supports refresh recovery", async () => {
    const studentId = `stu_lesson_m_struggle_${Date.now()}`;
    await createTestStudent(studentId, `m_struggle_${Date.now()}`);

    const startRes = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );
    expect(startRes.currentActivityIndex).toBe(0);

    // 1. Intro & 2. Interactive Manipulation
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[0]!.id,
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[1]!.id,
      { parts: 4, shaded: 1 },
      db,
    );

    // 3. Predict & Observe: Student gives incorrect prediction (choice_4_3 instead of choice_3_4)
    const predictRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[2]!.id,
      { choiceId: "choice_4_3" },
      db,
    );

    expect(predictRes.accepted).toBe(true);
    expect(predictRes.isCorrect).toBe(false);
    expect(predictRes.feedback).toContain("denominator");
    expect(predictRes.activeBranch).toBeDefined();
    expect(predictRes.activeBranch?.stage).toBe("remediation_activity");
    expect(predictRes.activeActivity?.id).toBe("act_3_remediation_sim");

    // REFRESH RECOVERY CHECK 1: Mid-remediation simulation
    const refresh1 = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    expect(refresh1.activeBranch?.stage).toBe("remediation_activity");
    expect(refresh1.activeActivity?.id).toBe("act_3_remediation_sim");
    expect(refresh1.assistanceStatus?.act_3_predict).toBe("assisted");

    // 4. Remediation Activity: Student explores 4-part strip
    const simRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_sim",
      { parts: 4, shaded: 2 },
      db,
    );

    expect(simRes.accepted).toBe(true);
    expect(simRes.activeBranch?.stage).toBe("followup_check");
    expect(simRes.activeActivity?.id).toBe("act_3_remediation_fresh_check");

    // REFRESH RECOVERY CHECK 2: Mid-follow-up check
    const refresh2 = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    expect(refresh2.activeBranch?.stage).toBe("followup_check");
    expect(refresh2.activeActivity?.id).toBe("act_3_remediation_fresh_check");

    // 5. Fresh Follow-up Check: Student still struggles (incorrect answer fresh_4_1)
    const checkRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { answer: "fresh_4_1" },
      db,
    );

    expect(checkRes.accepted).toBe(true);
    expect(checkRes.isCorrect).toBe(false);
    expect(checkRes.activeBranch?.stage).toBe("stopping_point");
    expect(checkRes.activeActivity?.id).toBe("act_3_stopping_point");

    // REFRESH RECOVERY CHECK 3: Mid-stopping point
    const refresh3 = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    expect(refresh3.activeBranch?.stage).toBe("stopping_point");
    expect(refresh3.activeActivity?.id).toBe("act_3_stopping_point");

    // 6. Acknowledge Stopping Point
    const stopRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_stopping_point",
      { acknowledged: true },
      db,
    );

    expect(stopRes.accepted).toBe(true);
    expect(stopRes.activeBranch).toBeNull();
    expect(stopRes.nextActivityIndex).toBe(3);
    expect(stopRes.activeActivity?.id).toBe("act_4_guided");

    // Verify assistance status preserved as needs_support
    const sessionAfterStop = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    expect(sessionAfterStop.assistanceStatus?.act_3_predict).toBe("needs_support");

    // Complete remaining activities
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_4_guided",
      { value: "2/5" },
      db,
    );
    const finalRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a" },
      db,
    );

    expect(finalRes.isCompleted).toBe(true);
    expect(finalRes.sparksAwarded).toBe(15);
  });

  it("8. Maths successful-student path after remediation progresses smoothly to challenge", async () => {
    const studentId = `stu_lesson_m_success_${Date.now()}`;
    await createTestStudent(studentId, `m_success_${Date.now()}`);

    const startRes = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );

    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[0]!.id,
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[1]!.id,
      { parts: 4, shaded: 1 },
      db,
    );

    // Initial incorrect prediction
    const predictRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[2]!.id,
      { choiceId: "choice_4_3" },
      db,
    );
    expect(predictRes.activeBranch?.stage).toBe("remediation_activity");

    // Complete remediation simulation
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_sim",
      { parts: 4, shaded: 2 },
      db,
    );

    // Answer fresh check CORRECTLY (fresh_1_4)
    const freshCheckRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { answer: "fresh_1_4" },
      db,
    );

    expect(freshCheckRes.accepted).toBe(true);
    expect(freshCheckRes.isCorrect).toBe(true);
    expect(freshCheckRes.activeBranch).toBeNull();
    expect(freshCheckRes.activeActivity?.id).toBe("act_4_guided");
    expect(freshCheckRes.nextActivityIndex).toBe(3);

    const reloaded = await getLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    expect(reloaded.assistanceStatus?.act_3_predict).toBe("remediated");
  });

  it("9. Science struggling-student path triggers targeted air-gap remediation and stopping point", async () => {
    const studentId = `stu_lesson_s_struggle_${Date.now()}`;
    await createTestStudent(studentId, `s_struggle_${Date.now()}`);

    const startRes = await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);

    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[0]!.id,
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[1]!.id,
      { switchState: "closed", wireConnected: true },
      db,
    );

    // Incorrect prediction: student predicts bulb will glow with open switch
    const predictRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[2]!.id,
      { choiceId: "choice_glow" },
      db,
    );

    expect(predictRes.accepted).toBe(true);
    expect(predictRes.isCorrect).toBe(false);
    expect(predictRes.activeBranch?.stage).toBe("remediation_activity");
    expect(predictRes.activeActivity?.id).toBe("act_3_remediation_sim");
    expect(predictRes.feedback).toContain("air gap");

    // Complete remediation simulation
    const simRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_sim",
      { switchState: "open" },
      db,
    );
    expect(simRes.activeBranch?.stage).toBe("followup_check");
    expect(simRes.activeActivity?.id).toBe("act_3_remediation_fresh_check");

    // Incorrect response on fresh check (fresh_wire_glow)
    const freshRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { answer: "fresh_wire_glow" },
      db,
    );
    expect(freshRes.isCorrect).toBe(false);
    expect(freshRes.activeBranch?.stage).toBe("stopping_point");
    expect(freshRes.activeActivity?.id).toBe("act_3_stopping_point");

    // Acknowledge stopping point
    const stopRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_stopping_point",
      { acknowledged: true },
      db,
    );
    expect(stopRes.activeBranch).toBeNull();
    expect(stopRes.nextActivityIndex).toBe(3);
    expect(stopRes.activeActivity?.id).toBe("act_4_guided");

    const reloaded = await getLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    expect(reloaded.assistanceStatus?.act_3_predict).toBe("needs_support");
  });

  it("10. Science successful-student path after air-gap remediation continues independently", async () => {
    const studentId = `stu_lesson_s_success_${Date.now()}`;
    await createTestStudent(studentId, `s_success_${Date.now()}`);

    const startRes = await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);

    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[0]!.id,
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[1]!.id,
      { switchState: "closed", wireConnected: true },
      db,
    );

    // Incorrect prediction
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      startRes.lesson.activities[2]!.id,
      { choiceId: "choice_glow" },
      db,
    );

    // Complete remediation simulation
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_sim",
      { switchState: "open" },
      db,
    );

    // Correct response on fresh check (fresh_wire_dark)
    const freshRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { answer: "fresh_wire_dark" },
      db,
    );

    expect(freshRes.isCorrect).toBe(true);
    expect(freshRes.activeBranch).toBeNull();
    expect(freshRes.activeActivity?.id).toBe("act_4_guided");

    const reloaded = await getLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    expect(reloaded.assistanceStatus?.act_3_predict).toBe("remediated");
  });

  it("11. Assessment evidence is immutably recorded without treating lesson completion as mastery", async () => {
    const studentId = `stu_lesson_audit_${Date.now()}`;
    await createTestStudent(studentId, `audit_${Date.now()}`);

    const startRes = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );

    // Intro -> Sim -> Prediction -> Remediation Sim -> Fresh Check (correct) -> Guided -> Final Check
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[0]!.id,
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[1]!.id,
      { parts: 4, shaded: 1 },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      startRes.lesson.activities[2]!.id,
      { choiceId: "choice_4_3" }, // incorrect -> branch
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_sim",
      { parts: 4, shaded: 2 },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { answer: "fresh_1_4" }, // resolved
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_4_guided",
      { value: "2/5" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a" },
      db,
    );

    // 1. Verify structured immutable events recorded
    const recordedEvents = await db.select().from(events).where(eq(events.studentId, studentId));

    const eventTypes = recordedEvents.map((e) => e.type);
    expect(eventTypes).toContain("lesson_branch_triggered");
    expect(eventTypes).toContain("lesson_remediation_activity_explored");
    expect(eventTypes).toContain("lesson_remediation_check");
    expect(eventTypes).toContain("lesson_guided_practice");
    expect(eventTypes).toContain("lesson_independent_check");

    // 2. Invariant §3 & Rule F.1: Participation / completion is NOT mastery.
    // Verify concept_beliefs was NOT promoted to mastered solely by completing the lesson!
    const beliefs = await db
      .select()
      .from(conceptBeliefs)
      .where(eq(conceptBeliefs.studentId, studentId));

    // Either no belief entry exists or belief is NOT "mastered"
    const fracBelief = beliefs.find((b) => b.conceptId === "MATH-FRAC-PART");
    expect(fracBelief?.status ?? "unassessed").not.toBe("mastered");
  });
});
