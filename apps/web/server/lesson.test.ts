import { describe, expect, it } from "vitest";
import {
  getDb,
  users,
  hashPin,
  events,
  conceptBeliefs,
  attempts,
  createStudentRepo,
  and,
  eq,
} from "@gaps/db";
import {
  getCurriculumTopicsOverview,
  startOrResumeLessonSession,
  getLessonSession,
  submitLessonActivityResponse,
  getRecommendedNextAction,
  recordLessonAssessment,
} from "./lesson/service";
import { AuthoredLessonPlanner, LlmLessonPlanner } from "./lesson/planner";
import { validateLessonPlan } from "./lesson/planner-validator";
import {
  MATHS_FRAC_PART_LESSON,
  SCI_CIRCUITS_LESSON,
  SCI_CIRCUITS_MASTERY_LESSON,
  SCI_CONDUCTORS_LESSON,
} from "@gaps/content";

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

  it("12. Struggling student reaches stopping point, clicks 'Save and finish for now', and receives follow-up action on return", async () => {
    const studentId = `stu_lesson_struggle_save_${Date.now()}`;
    await createTestStudent(studentId, `struggle_save_${Date.now()}`);

    // Start science circuits lesson
    await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);

    // Step 1: Intro
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    // Step 2: Sandbox
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_2_manipulation",
      { switch: "open" },
      db,
    );
    // Step 3: Incorrect prediction -> triggers remediation
    const predRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_glow" },
      db,
    );
    expect(predRes.activeBranch?.stage).toBe("remediation_activity");

    // Remediation simulation
    const remSimRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_sim",
      { observedGap: true },
      db,
    );
    expect(remSimRes.activeBranch?.stage).toBe("followup_check");

    // Continued difficulty on fresh follow-up check -> triggers stopping point
    const freshCheckRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { choiceId: "fresh_wire_glow" }, // Incorrect
      db,
    );
    expect(freshCheckRes.activeBranch?.stage).toBe("stopping_point");

    // Student clicks "Save and finish for now"
    const saveRes = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_stopping_point",
      { acknowledged: true, saveAndExit: true },
      db,
    );
    expect(saveRes.accepted).toBe(true);
    expect(saveRes.isSavedAndExited).toBe(true);

    // Student returns to app: next action on return advises revisiting unresolved objective
    const nextAction = await getRecommendedNextAction(studentId, "science", db);
    expect(nextAction.actionType).toBe("revisit_unresolved");
    expect(nextAction.objectiveId).toBe("SCI-ELEC-CIRCUITS");
    expect(nextAction.reasonCode).toBe("SAVED_AT_STOPPING_POINT");
    expect(nextAction.ctaLabel).toBe("Revisit Objective");

    // Student resumes session: reliably loads stopping point state
    const resumed = await getLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    expect(resumed.activeBranch?.stage).toBe("stopping_point");
    expect(resumed.activeActivity?.id).toBe("act_3_stopping_point");
  });

  it("13. Supported success in remediation does not establish mastery (Invariant 2 & SPEC §9)", async () => {
    const studentId = `stu_lesson_supported_${Date.now()}`;
    await createTestStudent(studentId, `supported_${Date.now()}`);

    // Start fractions lesson
    await startOrResumeLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);

    // Intro & Sandbox
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_2_manipulation",
      { parts: 4 },
      db,
    );

    // Step 3: Incorrect prediction -> triggers remediation
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_4_3" }, // Incorrect
      db,
    );

    // Explore remediation simulation
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_sim",
      { explored: true },
      db,
    );

    // Student answers fresh question correctly AFTER help
    const freshRes = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_remediation_fresh_check",
      { choiceId: "fresh_1_4" }, // Correct answer
      db,
    );
    expect(freshRes.isCorrect).toBe(true);

    // 1. Verify in attempts table: assistanceLevel is 1 (supported learning)
    const storedAttempts = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.studentId, studentId), eq(attempts.conceptId, "MATH-FRAC-PART")));

    expect(storedAttempts.length).toBeGreaterThanOrEqual(1);
    const remediationAttempt = storedAttempts.find((a) => a.assistanceLevel === 1);
    expect(remediationAttempt).toBeDefined();
    expect(remediationAttempt?.outcome).toBe("correct");

    // 2. Invariant 2: Supported attempt NEVER establishes demonstrated mastery
    const belief = await db
      .select()
      .from(conceptBeliefs)
      .where(
        and(
          eq(conceptBeliefs.studentId, studentId),
          eq(conceptBeliefs.conceptId, "MATH-FRAC-PART"),
        ),
      );

    expect(belief[0]?.status).not.toBe("demonstrated");
    expect(belief[0]?.demonstratedAt).toBeNull();
    // Independent counts must be 0 because this was an assisted attempt
    expect(belief[0]?.independentN).toBe(0);

    // 3. Recommended next action advises taking a fresh independent check
    const nextAction = await getRecommendedNextAction(studentId, "maths", db);
    expect(nextAction.actionType).toBe("fresh_check");
    expect(nextAction.objectiveId).toBe("MATH-FRAC-PART");
    expect(nextAction.ctaLabel).toBe("Take Independent Check");
  });

  it("14. Sufficient eligible independent evidence updates progress per policy (Demonstrated mastery)", async () => {
    const studentId = `stu_lesson_mastery_${Date.now()}`;
    await createTestStudent(studentId, `mastery_${Date.now()}`);

    const sessionRes = await startOrResumeLessonSession(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      db,
    );
    const sessionId = sessionRes.session.id;
    const studentRepo = createStudentRepo(studentId, db);

    // Simulate 3 independent correct checks meeting SPEC §9 policy rule:
    // okL4 >= 3, l2 all correct, distinct itemInstanceIds >= 3, distinct templateIds >= 2, assistance = 0
    const attempt1 = await recordLessonAssessment({
      db,
      studentRepo,
      studentId,
      sessionId,
      clientAttemptId: `client_att_ind_1_${Date.now()}`,
      stepSeq: 1,
      lessonPlan: MATHS_FRAC_PART_LESSON,
      activityId: "act_5_check_v1",
      conceptId: "MATH-FRAC-PART",
      questionText: "Question 1 on template A",
      submittedAnswer: "choice_a",
      correctAnswer: "choice_a",
      isCorrect: true,
      assistanceLevel: 0,
    });
    expect(attempt1.newState.status).toBe("developing");

    const attempt2 = await recordLessonAssessment({
      db,
      studentRepo,
      studentId,
      sessionId,
      clientAttemptId: `client_att_ind_2_${Date.now()}`,
      stepSeq: 2,
      lessonPlan: MATHS_FRAC_PART_LESSON,
      activityId: "act_5_check_v2", // Distinct template & item
      conceptId: "MATH-FRAC-PART",
      questionText: "Question 2 on template B",
      submittedAnswer: "choice_b",
      correctAnswer: "choice_b",
      isCorrect: true,
      assistanceLevel: 0,
    });
    expect(attempt2.newState.status).toBe("developing");

    // Third independent correct check on distinct item
    const attempt3 = await recordLessonAssessment({
      db,
      studentRepo,
      studentId,
      sessionId,
      clientAttemptId: `client_att_ind_3_${Date.now()}`,
      stepSeq: 3,
      lessonPlan: MATHS_FRAC_PART_LESSON,
      activityId: "act_5_check_v3", // Distinct item
      conceptId: "MATH-FRAC-PART",
      questionText: "Question 3 on template B",
      submittedAnswer: "choice_c",
      correctAnswer: "choice_c",
      isCorrect: true,
      assistanceLevel: 0,
    });

    // 3 independent correct answers across 2 templates & 3 items -> demonstrated!
    expect(attempt3.newState.status).toBe("demonstrated");
    expect(attempt3.newState.demonstratedAt).toBeTruthy();
    expect(attempt3.sparksAwarded).toBe(20); // +20 mastery Sparks awarded

    // Recommended next action now advances to next eligible objective
    const nextAction = await getRecommendedNextAction(studentId, "maths", db);
    expect(nextAction.actionType).toBe("continue_next_objective");
    expect(nextAction.objectiveId).toBe("MATH-FRAC-EQUIV");
    expect(nextAction.ctaLabel).toBe("Start Next Objective");
  });

  it("15. Duplicate submissions do not double-count (idempotency key preservation)", async () => {
    const studentId = `stu_lesson_duplicate_${Date.now()}`;
    await createTestStudent(studentId, `dup_${Date.now()}`);

    await startOrResumeLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    const clientAttemptId = `att_fixed_idempotency_${Date.now()}`;

    // Advance to act_5_check
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_2_manipulation",
      { parts: 4 },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_3_4" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_4_guided",
      { value: "2/5" },
      db,
    );

    // First submission
    const res1 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a", clientAttemptId },
      db,
    );
    expect(res1.accepted).toBe(true);

    const initialAttempts = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.studentId, studentId), eq(attempts.clientAttemptId, clientAttemptId)));
    expect(initialAttempts.length).toBe(1);

    // Duplicate submission with same clientAttemptId
    const res2 = await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a", clientAttemptId },
      db,
    );
    expect(res2.accepted).toBe(true);

    const finalAttempts = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.studentId, studentId), eq(attempts.clientAttemptId, clientAttemptId)));
    expect(finalAttempts.length).toBe(1); // Still exactly 1 attempt, no duplicate
  });

  it("16. Both subjects (Mathematics and Science) work through the shared learner model system", async () => {
    const studentId = `stu_lesson_both_subj_${Date.now()}`;
    await createTestStudent(studentId, `both_${Date.now()}`);

    // Complete lesson for Maths (Parts of a Whole)
    await startOrResumeLessonSession(studentId, MATHS_FRAC_PART_LESSON.lessonId, db);
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_2_manipulation",
      { parts: 4 },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      MATHS_FRAC_PART_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_3_4" },
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

    // Complete lesson for Science (Simple Circuits)
    await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_2_manipulation",
      { switch: "closed" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_dark" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_4_guided",
      { value: "closed" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a" },
      db,
    );

    // Verify both concept beliefs exist and are tracked in concept_beliefs table
    const beliefs = await db
      .select()
      .from(conceptBeliefs)
      .where(eq(conceptBeliefs.studentId, studentId));

    const mathBelief = beliefs.find((b) => b.conceptId === "MATH-FRAC-PART");
    const sciBelief = beliefs.find((b) => b.conceptId === "SCI-ELEC-CIRCUITS");

    expect(mathBelief).toBeDefined();
    expect(mathBelief?.status).toBe("developing");
    expect(mathBelief?.independentN).toBe(1);

    expect(sciBelief).toBeDefined();
    expect(sciBelief?.status).toBe("developing");
    expect(sciBelief?.independentN).toBe(1);
  });

  it("17. Science evidence threshold achieved through authored UI lessons (Mastery Demonstration across 2 templates)", async () => {
    const studentId = `stu_sci_mastery_ui_${Date.now()}`;
    await createTestStudent(studentId, `sci_mastery_${Date.now()}`);

    // Step 1: Student completes introductory Science lesson (lesson-sci-circuits-1)
    await startOrResumeLessonSession(studentId, SCI_CIRCUITS_LESSON.lessonId, db);
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_1_intro",
      { read: true },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_2_manipulation",
      { switch: "closed" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_3_predict",
      { choiceId: "choice_dark" },
      db,
    );
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_4_guided",
      { value: "closed" },
      db,
    );

    // Independent Check 1: Template 1 (tpl_sci_circuits_continuity), Item 1 (itm_sci_circuits_continuity_1)
    const check1Res = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_LESSON.lessonId,
      "act_5_check",
      { answer: "choice_a" },
      db,
    );
    expect(check1Res.isCorrect).toBe(true);

    // Verify belief after Check 1: developing, 1 independent attempt, not demonstrated
    let belief = await createStudentRepo(studentId, db).getConceptBelief("SCI-ELEC-CIRCUITS");
    expect(belief?.status).toBe("developing");
    expect(belief?.independentN).toBe(1);
    expect(belief?.demonstratedAt).toBeNull();

    // Verify next action recommends taking the fresh check / mastery assessment
    const nextActionBefore = await getRecommendedNextAction(studentId, "science", db);
    expect(nextActionBefore.actionType).toBe("fresh_check");
    // The fresh check now opens the topic's primary lesson, which is engine-driven
    // and gathers the remaining independent evidence itself. The fixed mastery
    // lesson below stays reachable by its URL.
    expect(nextActionBefore.lessonId).toBe("lesson-sci-circuits-adaptive");

    // Step 2: Student launches Science Mastery Assessment (lesson-sci-circuits-mastery)
    await startOrResumeLessonSession(studentId, SCI_CIRCUITS_MASTERY_LESSON.lessonId, db);
    await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_MASTERY_LESSON.lessonId,
      "act_mastery_intro",
      { read: true },
      db,
    );

    // Independent Check 2: Template 1 (tpl_sci_circuits_continuity), Item 2 (itm_sci_circuits_continuity_2)
    const check2Res = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_MASTERY_LESSON.lessonId,
      "act_check_air_gap",
      { answer: "choice_air_gap" },
      db,
    );
    expect(check2Res.isCorrect).toBe(true);

    // Belief after Check 2: 2 attempts, but only 1 template so far -> still developing
    belief = await createStudentRepo(studentId, db).getConceptBelief("SCI-ELEC-CIRCUITS");
    expect(belief?.status).toBe("developing");
    expect(belief?.independentN).toBe(2);
    expect(belief?.demonstratedAt).toBeNull();

    // Independent Check 3: Template 2 (tpl_sci_circuits_breaks), Item 3 (itm_sci_circuits_breaks_1)
    const check3Res = await submitLessonActivityResponse(
      studentId,
      SCI_CIRCUITS_MASTERY_LESSON.lessonId,
      "act_check_wire_break",
      { answer: "choice_stops_completely" },
      db,
    );
    expect(check3Res.isCorrect).toBe(true);
    expect(check3Res.isCompleted).toBe(true);

    // Belief after Check 3: 3 distinct items across 2 distinct templates -> DEMONSTRATED!
    belief = await createStudentRepo(studentId, db).getConceptBelief("SCI-ELEC-CIRCUITS");
    expect(belief?.status).toBe("demonstrated");
    expect(belief?.demonstratedAt).not.toBeNull();
    expect(belief?.independentN).toBe(3);
    expect(belief?.independentCorrectN).toBe(3);

    // Verify +20 Sparks awarded in ledger for newly demonstrated mastery
    const eventsList = await db
      .select()
      .from(events)
      .where(and(eq(events.studentId, studentId), eq(events.type, "sparks_awarded")));
    const masteryEvent = eventsList.find(
      (e) => (e.payload as { sourceKind?: string }).sourceKind === "mastery_demonstrated",
    );
    expect(masteryEvent).toBeDefined();

    // Step 3: Next action now updates to continue_next_objective (Conductors & Insulators)
    const nextActionAfter = await getRecommendedNextAction(studentId, "science", db);
    expect(nextActionAfter.actionType).toBe("continue_next_objective");
    expect(nextActionAfter.objectiveId).toBe("SCI-ELEC-CONDUCTORS");
  });

  it("18. Planner validator distinguishes structural schema validity from factual & semantic validity", () => {
    // Case 1: Schema valid, but factual error in simulation parameters (parts out of bounds)
    const invalidSimPlan = {
      ...MATHS_FRAC_PART_LESSON,
      activities: [
        MATHS_FRAC_PART_LESSON.activities[0]!,
        {
          id: "act_invalid_sim",
          type: "interactive_manipulation",
          title: "Invalid Simulation Parts",
          instructions: "Test invalid parts",
          config: {
            type: "interactive_manipulation",
            simulation: {
              simulationKind: "fraction_strip",
              initialParts: 15, // Schema valid (<= 16), but Factual Error: maxParts is 12
              initialShaded: 2,
              minParts: 1,
              maxParts: 12,
              instruction: "Too many parts",
            },
          },
        },
      ],
    };

    const val1 = validateLessonPlan(invalidSimPlan, "MATH-FRAC-PART");
    expect(val1.outcome.schemaValid).toBe(true); // Conforms to Zod schema types
    expect(val1.outcome.factualValid).toBe(false); // Fails factual domain boundaries
    expect(val1.outcome.status).toBe("rejected");
    expect(val1.outcome.issues.some((i) => i.includes("between 1 and 12"))).toBe(true);

    // Case 2: Schema valid, but choice mismatch (correctAnswer not in choices list)
    const invalidChoicePlan = {
      ...MATHS_FRAC_PART_LESSON,
      activities: [
        MATHS_FRAC_PART_LESSON.activities[0]!,
        {
          id: "act_invalid_check",
          type: "independent_check",
          title: "Mismatched Answer",
          instructions: "Answer check",
          config: {
            type: "independent_check",
            conceptId: "MATH-FRAC-PART",
            prompt: "What is 1/2?",
            questionType: "choice",
            choices: [
              { id: "choice_a", text: "1/2" },
              { id: "choice_b", text: "1/3" },
            ],
            correctAnswer: "choice_missing", // Factual Error: does not match any choice ID
            explanation: "Detailed explanation of fractional parts.",
          },
        },
      ],
    };

    const val2 = validateLessonPlan(invalidChoicePlan, "MATH-FRAC-PART");
    expect(val2.outcome.schemaValid).toBe(true);
    expect(val2.outcome.factualValid).toBe(false);
    expect(val2.outcome.status).toBe("rejected");
    expect(val2.outcome.issues.some((i) => i.includes("does not match any choice ID"))).toBe(true);
  });

  it("19. Model-planned teaching produces materially different teaching sequences for struggling vs challenge profiles (Maths and Science)", async () => {
    const planner = new LlmLessonPlanner();

    // Subject 1: Maths (MATH-FRAC-PART)
    // Profile A: Struggling with Misconception REV
    const mathsStruggling = await planner.planLessonWithDetails({
      subject: "maths",
      level: 6,
      topicId: "maths-frac-part",
      objectiveId: "MATH-FRAC-PART",
      learnerProfile: {
        profileType: "struggling",
        priorMastery: "struggling",
        namedMisconception: "REV",
      },
    });

    // Profile B: Ready for a Challenge
    const mathsChallenge = await planner.planLessonWithDetails({
      subject: "maths",
      level: 6,
      topicId: "maths-frac-part",
      objectiveId: "MATH-FRAC-PART",
      learnerProfile: {
        profileType: "ready_for_challenge",
        priorMastery: "demonstrated",
      },
    });

    // Verify distinct structures for Maths
    expect(mathsStruggling.plan.title).toContain("Inversion");
    expect(mathsChallenge.plan.title).toContain("Challenge");

    // Struggling has remediation branch addressing reversal
    const strugglingPredict = mathsStruggling.plan.activities.find(
      (a) => a.type === "predict_and_observe",
    );
    expect(strugglingPredict?.remediation).toBeDefined();
    expect(strugglingPredict?.remediation?.targetedExplanation).toContain(
      "Denominator is the 'Down' number",
    );

    // Challenge has multiple complex checks and no remediation hand-holding
    const challengeChecks = mathsChallenge.plan.activities.filter(
      (a) => a.type === "independent_check",
    );
    expect(challengeChecks.length).toBeGreaterThanOrEqual(2);
    expect(mathsChallenge.plan.activities.some((a) => a.remediation)).toBe(false);

    // Subject 2: Science (SCI-ELEC-CIRCUITS)
    // Profile A: Struggling with Air Gap Misconception
    const sciStruggling = await planner.planLessonWithDetails({
      subject: "science",
      level: 6,
      topicId: "sci-elec-circuits",
      objectiveId: "SCI-ELEC-CIRCUITS",
      learnerProfile: {
        profileType: "struggling",
        priorMastery: "struggling",
        namedMisconception: "AIR_GAP",
      },
    });

    // Profile B: Ready for a Challenge
    const sciChallenge = await planner.planLessonWithDetails({
      subject: "science",
      level: 6,
      topicId: "sci-elec-circuits",
      objectiveId: "SCI-ELEC-CIRCUITS",
      learnerProfile: {
        profileType: "ready_for_challenge",
        priorMastery: "demonstrated",
      },
    });

    expect(sciStruggling.plan.title).toContain("Air Gap");
    expect(sciChallenge.plan.title).toContain("Fault Diagnosis");

    const sciStrugglingCheck = sciStruggling.plan.activities.find(
      (a) => a.type === "independent_check",
    );
    expect((sciStrugglingCheck?.config as { prompt: string }).prompt).toContain("opening a switch");

    const sciChallengeChecks = sciChallenge.plan.activities.filter(
      (a) => a.type === "independent_check",
    );
    expect(sciChallengeChecks.length).toBeGreaterThanOrEqual(2);
  });

  it("20. Planner fallback guarantees authored lesson when LLM fails or is disabled without logging student personal data", async () => {
    // When LLM runtime is disabled (the default setting in this project), LlmLessonPlanner safely falls back
    const planner = new LlmLessonPlanner();
    const result = await planner.planLessonWithDetails({
      subject: "science",
      level: 6,
      topicId: "sci-elec-circuits",
      objectiveId: "SCI-ELEC-CIRCUITS",
      learnerProfile: {
        profileType: "new_learner",
        priorMastery: "not_started",
      },
    });

    expect(result.plan).toBeDefined();
    expect(result.plan.subject).toBe("science");
    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe("LLM_PROVIDER_DISABLED");

    // Verify metadata does not log student personal data
    expect(result.metadata.model).toBeDefined();
    expect(result.metadata.version).toBe("1.0");
    expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.validation.schemaValid).toBe(true);
    expect(result.metadata.validation.factualValid).toBe(true);

    // Check learner profile used contains only synthetic metadata
    expect(result.metadata.learnerProfileUsed.profileType).toBe("new_learner");
    expect(result.metadata.learnerProfileUsed).not.toHaveProperty("studentId");
    expect(result.metadata.learnerProfileUsed).not.toHaveProperty("name");
  });
});
