"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
  LessonPlanGenerateResponse,
  LessonSessionResponse,
  SyntheticLearnerProfile,
  TeachingEngineTraceResponse,
  TeachingDecisionTraceEntry,
  LessonActivity,
} from "@gaps/contracts";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

/** Evidence behind one decision: belief status, lesson stage and the learner's response. */
function TraceEvidence({ dec }: { dec: TeachingDecisionTraceEntry }) {
  const response = dec.learnerResponse;
  return (
    <div
      data-testid="trace-evidence"
      className="text-2xs text-muted leading-relaxed bg-surface p-2.5 rounded-xl border border-line space-y-0.5"
    >
      <div>
        <strong className="text-ink">Objective status (belief reducer):</strong>{" "}
        {dec.objectiveStatus ?? "n/a"}
        {dec.lessonStage ? ` · Lesson stage: ${dec.lessonStage}` : ""}
      </div>
      {dec.assistanceLevel !== undefined && (
        <div>
          <strong className="text-ink">Check recorded as:</strong>{" "}
          {dec.assistanceLevel === 0 ? "independent" : "assisted (cannot count toward mastery)"}
        </div>
      )}
      {response && response.isCorrect !== undefined && (
        <div>
          <strong className="text-ink">Synthetic learner answered:</strong>{" "}
          {response.submittedAnswer} ({response.isCorrect ? "correct" : "not yet"}
          {response.countedAsEvidence ? ", stored as evidence" : ", not evidence"})
        </div>
      )}
    </div>
  );
}

const SUPPORTED_OBJECTIVES = [
  {
    id: "MATH-FRAC-PART",
    subject: "maths",
    title: "Fractions: Parts of a Whole (Numerator/Denominator)",
    strand: "fractions",
    topicId: "maths-frac-part",
    misconceptions: [
      { id: "REV", label: "Numerator/Denominator Reversal (writing 4/3 instead of 3/4)" },
      { id: "WHOLE", label: "Whole Number Fraction Bias (treating top and bottom independently)" },
    ],
  },
  {
    id: "MATH-FRAC-EQUIV",
    subject: "maths",
    title: "Equivalent Fractions: Equal Area Coverage",
    strand: "fractions",
    topicId: "maths-frac-equiv",
    misconceptions: [
      {
        id: "ADD_NUM_DEN",
        label: "Additive Equivalence Error (adding +1/+1 instead of multiplying)",
      },
    ],
  },
  {
    id: "SCI-ELEC-CIRCUITS",
    subject: "science",
    title: "Electric Current & Simple Circuits",
    strand: "electricity",
    topicId: "sci-elec-circuits",
    misconceptions: [
      { id: "AIR_GAP", label: "Air Gap Jump Fallacy (assuming charges cross open switch)" },
      { id: "SINGLE_WIRE", label: "Single Wire Supply Fallacy (expecting 1 wire to light bulb)" },
    ],
  },
  {
    id: "SCI-ELEC-CONDUCTORS",
    subject: "science",
    title: "Electrical Conductors & Insulators",
    strand: "electricity",
    topicId: "sci-elec-conductors",
    misconceptions: [
      { id: "ALL_SOLIDS", label: "Solid Conductivity Fallacy (assuming all solids conduct)" },
    ],
  },
];

export default function DevLessonPlannerPage() {
  const [viewMode, setViewMode] = useState<"planner" | "teaching_trace">("planner");
  const [subject, setSubject] = useState<"maths" | "science">("maths");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>("MATH-FRAC-PART");
  const [profileType, setProfileType] = useState<
    "new_learner" | "struggling" | "ready_for_challenge"
  >("struggling");
  const [selectedMisconception, setSelectedMisconception] = useState<string>("REV");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<LessonPlanGenerateResponse | null>(null);

  // Teaching Decision Comparison State
  const [comparisonResult, setComparisonResult] = useState<TeachingEngineTraceResponse | null>(
    null,
  );
  const [isComparing, setIsComparing] = useState(false);
  const [selectedPreviewActivity, setSelectedPreviewActivity] = useState<LessonActivity | null>(
    null,
  );

  // Filter objectives matching current subject
  const availableObjectives = SUPPORTED_OBJECTIVES.filter((o) => o.subject === subject);
  const currentObjective =
    SUPPORTED_OBJECTIVES.find((o) => o.id === selectedObjectiveId) ?? availableObjectives[0]!;

  const handleSubjectChange = (newSubject: "maths" | "science") => {
    setSubject(newSubject);
    const firstForSubject = SUPPORTED_OBJECTIVES.find((o) => o.subject === newSubject)!;
    setSelectedObjectiveId(firstForSubject.id);
    setSelectedMisconception(firstForSubject.misconceptions[0]?.id ?? "");
  };

  const handleObjectiveChange = (objId: string) => {
    setSelectedObjectiveId(objId);
    const obj = SUPPORTED_OBJECTIVES.find((o) => o.id === objId);
    if (obj?.misconceptions[0]) {
      setSelectedMisconception(obj.misconceptions[0].id);
    }
  };

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setError(null);

    const learnerProfile: SyntheticLearnerProfile = {
      profileType,
      priorMastery: profileType === "ready_for_challenge" ? "demonstrated" : "not_started",
      namedMisconception: profileType === "struggling" ? selectedMisconception : undefined,
    };

    try {
      const res = await fetch("/api/v1/dev/lesson-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          level: 6,
          topicId: currentObjective.topicId,
          objectiveId: currentObjective.id,
          learnerProfile,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || "Plan generation failed");
      }

      const data: LessonPlanGenerateResponse = await res.json();
      setGenerationResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunComparison = async () => {
    setIsComparing(true);
    setError(null);
    setSelectedPreviewActivity(null);

    try {
      const res = await fetch("/api/v1/dev/teaching-engine/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          objectiveId: currentObjective.id,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || "Trace comparison failed");
      }

      const data: TeachingEngineTraceResponse = await res.json();
      setComparisonResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trace comparison failed");
    } finally {
      setIsComparing(false);
    }
  };

  // Preview Session builder
  const previewSessionData: LessonSessionResponse | null = selectedPreviewActivity
    ? {
        session: {
          id: `ses_preview_act_${selectedPreviewActivity.id}`,
          studentId: "stu_dev_preview",
          status: "active",
          mode: "lesson",
          stepSeq: 0,
        },
        lesson: {
          lessonId: "preview-lesson",
          version: "1.0",
          subject,
          level: 6,
          topicId: currentObjective.topicId,
          title: `Step Preview: ${selectedPreviewActivity.title}`,
          description: "Isolated activity preview from teaching decision engine.",
          learningObjectives: [selectedPreviewActivity.title],
          activities: [selectedPreviewActivity],
        },
        currentActivityIndex: 0,
        activeActivity: selectedPreviewActivity,
        completedActivities: [],
        activityResponses: {},
        isCompleted: false,
        sparksAwarded: 0,
      }
    : generationResult?.plan
      ? {
          session: {
            id: `ses_preview_${generationResult.plan.lessonId}`,
            studentId: "stu_dev_preview",
            status: "active",
            mode: "lesson",
            stepSeq: 0,
          },
          lesson: generationResult.plan,
          currentActivityIndex: 0,
          activeActivity: generationResult.plan.activities[0],
          completedActivities: [],
          activityResponses: {},
          isCompleted: false,
          sparksAwarded: 0,
        }
      : null;

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Top Banner */}
      <header className="bg-surface border-b border-line px-4 sm:px-8 py-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/learn"
              className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 hover:bg-surface text-ink text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Back to App</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 text-2xs font-black uppercase tracking-wider">
                  Developer Mode
                </span>
                <span className="text-2xs font-extrabold text-muted">
                  Real Student Data Isolated
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-ink">
                Model-Planned Teaching Engine: Live Preview
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-bold text-muted bg-surface-2 px-3 py-1.5 rounded-xl border border-line">
              Class 6 Middle School Engine
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            type="button"
            data-testid="tab-view-teaching-trace"
            onClick={() => setViewMode("teaching_trace")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "teaching_trace"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface text-muted hover:text-ink border border-line"
            }`}
          >
            <span>🔬</span>
            <span>Next-Step Teaching Decision Comparison (Struggling vs. Succeeding)</span>
          </button>
          <button
            type="button"
            data-testid="tab-view-planner"
            onClick={() => setViewMode("planner")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "planner"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface text-muted hover:text-ink border border-line"
            }`}
          >
            <span>📋</span>
            <span>Whole Lesson Plan Generator</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* MODE 1: TEACHING ENGINE DECISION COMPARISON                        */}
        {/* ================================================================= */}
        {viewMode === "teaching_trace" && (
          <div className="space-y-8">
            {/* Control Panel */}
            <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-ink">
                    Teaching Decision Comparison
                  </h2>
                  <p className="text-xs text-muted font-medium mt-1">
                    Simulate two synthetic learners through the{" "}
                    <strong>same starting objective</strong>. Inspect how server policy and evidence
                    shape completely distinct pedagogical sequences.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="run-comparison-button"
                  onClick={handleRunComparison}
                  disabled={isComparing}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2 self-start sm:self-auto"
                >
                  {isComparing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Simulating Learners…</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Run Comparison</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-2xs font-extrabold text-muted uppercase tracking-wider block mb-1">
                    Subject
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="trace-subject-maths"
                      onClick={() => handleSubjectChange("maths")}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        subject === "maths"
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-surface-2 text-ink border-line hover:bg-surface"
                      }`}
                    >
                      📐 Maths (Fractions)
                    </button>
                    <button
                      type="button"
                      data-testid="trace-subject-science"
                      onClick={() => handleSubjectChange("science")}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        subject === "science"
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-surface-2 text-ink border-line hover:bg-surface"
                      }`}
                    >
                      ⚡ Science (Circuits)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-extrabold text-muted uppercase tracking-wider block mb-1">
                    Curriculum Objective
                  </label>
                  <select
                    data-testid="trace-objective-select"
                    value={selectedObjectiveId}
                    onChange={(e) => handleObjectiveChange(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-surface-2 text-ink border border-line focus:outline-hidden focus:border-primary"
                  >
                    {availableObjectives.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-2xl text-xs font-bold">
                  {error}
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Columns */}
            {comparisonResult && (
              <div
                data-testid="comparison-results-container"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in"
              >
                {/* Column A: Struggling Learner */}
                <div className="p-6 bg-surface rounded-3xl border-2 border-amber-300 shadow-xs space-y-4">
                  <div className="border-b border-line pb-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-2xs font-black uppercase tracking-wider">
                        Learner A: Struggling
                      </span>
                      <span className="text-2xs font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        Status: {comparisonResult.traces.struggling.finalStatus}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-ink mt-2">
                      Scaffolded Adaptive Interventions
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Triggers: Misconception (
                      {comparisonResult.traces.struggling.learnerProfile.namedMisconception}) →
                      Targeted Manipulation → Guided Task → Supported Check → Ambiguous Error →
                      Diagnostic Probe → Alternative Explanation → Bounded Pause.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {comparisonResult.traces.struggling.decisions.map((dec) => (
                      <div
                        key={dec.stepIndex}
                        data-testid={`trace-struggling-step-${dec.stepIndex}`}
                        className="p-4 rounded-2xl border border-line bg-surface-2/60 space-y-2 hover:border-amber-400 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-black text-muted uppercase">
                            Step {dec.stepIndex}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider ${
                              dec.action === "pause"
                                ? "bg-red-100 text-red-900 border border-red-300"
                                : dec.action === "explain"
                                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                                  : dec.action === "explore"
                                    ? "bg-blue-100 text-blue-900 border border-blue-300"
                                    : "bg-surface text-ink border border-line"
                            }`}
                          >
                            Action: {dec.action}
                          </span>
                        </div>

                        <div className="text-xs font-extrabold text-ink">{dec.activityTitle}</div>

                        <div className="text-2xs text-muted leading-relaxed bg-surface p-2.5 rounded-xl border border-line">
                          <strong className="text-ink">Rationale:</strong> {dec.rationale}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-2xs pt-1">
                          <span className="text-muted font-bold">Server Envelope:</span>
                          {dec.eligibleActions.map((act) => (
                            <span
                              key={act}
                              className={`px-1.5 py-0.5 rounded-md font-mono text-3xs ${
                                act === dec.action
                                  ? "bg-primary text-white font-extrabold"
                                  : "bg-surface text-muted border border-line"
                              }`}
                            >
                              {act}
                            </span>
                          ))}
                        </div>

                        <TraceEvidence dec={dec} />

                        {dec.inferredMisconception && (
                          <div className="text-2xs font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            Misconception Detected: {dec.inferredMisconception}
                          </div>
                        )}

                        {dec.isAmbiguous && (
                          <div className="text-2xs font-bold text-sky-900 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200">
                            🔍 Ambiguous Error → Diagnostic Probe Activated
                          </div>
                        )}

                        {dec.activity && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              data-testid={`preview-activity-struggling-${dec.stepIndex}`}
                              onClick={() => setSelectedPreviewActivity(dec.activity!)}
                              className="px-2.5 py-1 text-2xs font-extrabold rounded-lg bg-surface border border-line hover:border-amber-400 text-ink cursor-pointer transition-colors"
                            >
                              👁️ Preview Activity
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column B: Succeeding Learner */}
                <div className="p-6 bg-surface rounded-3xl border-2 border-teal-300 shadow-xs space-y-4">
                  <div className="border-b border-line pb-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 border border-teal-300 text-2xs font-black uppercase tracking-wider">
                        Learner B: Succeeding Independently
                      </span>
                      <span className="text-2xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        Status: {comparisonResult.traces.succeeding.finalStatus}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-ink mt-2">
                      Independent Mastery & Progression
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Sequence: Initial Exploration → three distinct unassisted checks (correct) →
                      belief reducer reports demonstrated → Authorized Advance. Two correct answers
                      move the lesson on but do not advance the objective.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {comparisonResult.traces.succeeding.decisions.map((dec) => (
                      <div
                        key={dec.stepIndex}
                        data-testid={`trace-succeeding-step-${dec.stepIndex}`}
                        className="p-4 rounded-2xl border border-line bg-surface-2/60 space-y-2 hover:border-teal-400 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-black text-muted uppercase">
                            Step {dec.stepIndex}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider ${
                              dec.action === "advance"
                                ? "bg-teal-100 text-teal-900 border border-teal-300"
                                : dec.action === "independent_check"
                                  ? "bg-sky-100 text-sky-900 border border-sky-300"
                                  : "bg-blue-100 text-blue-900 border border-blue-300"
                            }`}
                          >
                            Action: {dec.action}
                          </span>
                        </div>

                        <div className="text-xs font-extrabold text-ink">{dec.activityTitle}</div>

                        <div className="text-2xs text-muted leading-relaxed bg-surface p-2.5 rounded-xl border border-line">
                          <strong className="text-ink">Rationale:</strong> {dec.rationale}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-2xs pt-1">
                          <span className="text-muted font-bold">Server Envelope:</span>
                          {dec.eligibleActions.map((act) => (
                            <span
                              key={act}
                              className={`px-1.5 py-0.5 rounded-md font-mono text-3xs ${
                                act === dec.action
                                  ? "bg-teal-600 text-white font-extrabold"
                                  : "bg-surface text-muted border border-line"
                              }`}
                            >
                              {act}
                            </span>
                          ))}
                        </div>

                        <TraceEvidence dec={dec} />

                        <div className="text-2xs font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">
                          🎯 Target: {dec.assessmentTarget}
                        </div>

                        {dec.activity && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              data-testid={`preview-activity-succeeding-${dec.stepIndex}`}
                              onClick={() => setSelectedPreviewActivity(dec.activity!)}
                              className="px-2.5 py-1 text-2xs font-extrabold rounded-lg bg-surface border border-line hover:border-teal-400 text-ink cursor-pointer transition-colors"
                            >
                              👁️ Preview Activity
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 2: WHOLE LESSON PLAN GENERATOR                               */}
        {/* ================================================================= */}
        {viewMode === "planner" && (
          <div className="space-y-8">
            <div className="p-6 sm:p-8 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-ink">
                    Configure Lesson Plan Generation
                  </h2>
                  <p className="text-xs text-muted font-medium mt-1">
                    Select curriculum parameters and synthetic learner characteristics to test
                    model-planned teaching.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Subject & Grade */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-ink uppercase tracking-wider">
                    1. Subject & Grade
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="select-subject-maths"
                      onClick={() => handleSubjectChange("maths")}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        subject === "maths"
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-surface-2 text-ink border-line hover:bg-surface"
                      }`}
                    >
                      📐 Maths
                    </button>
                    <button
                      type="button"
                      data-testid="select-subject-science"
                      onClick={() => handleSubjectChange("science")}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        subject === "science"
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-surface-2 text-ink border-line hover:bg-surface"
                      }`}
                    >
                      ⚡ Science
                    </button>
                  </div>
                </div>

                {/* 2. Objective Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-ink uppercase tracking-wider">
                    2. Learning Objective
                  </label>
                  <select
                    data-testid="select-objective"
                    value={selectedObjectiveId}
                    onChange={(e) => handleObjectiveChange(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-surface-2 text-ink border border-line focus:outline-hidden focus:border-primary"
                  >
                    {availableObjectives.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Synthetic Profile */}
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <label className="text-xs font-extrabold text-ink uppercase tracking-wider">
                    3. Synthetic Learner Profile
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      data-testid="profile-new"
                      onClick={() => setProfileType("new_learner")}
                      className={`py-2 px-1 text-center rounded-xl text-2xs font-extrabold border transition-colors ${
                        profileType === "new_learner"
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-surface-2 text-muted border-line hover:text-ink"
                      }`}
                    >
                      👶 New Learner
                    </button>
                    <button
                      type="button"
                      data-testid="profile-struggling"
                      onClick={() => setProfileType("struggling")}
                      className={`py-2 px-1 text-center rounded-xl text-2xs font-extrabold border transition-colors ${
                        profileType === "struggling"
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-surface-2 text-muted border-line hover:text-ink"
                      }`}
                    >
                      ⚠️ Struggling
                    </button>
                    <button
                      type="button"
                      data-testid="profile-challenge"
                      onClick={() => setProfileType("ready_for_challenge")}
                      className={`py-2 px-1 text-center rounded-xl text-2xs font-extrabold border transition-colors ${
                        profileType === "ready_for_challenge"
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-surface-2 text-muted border-line hover:text-ink"
                      }`}
                    >
                      🚀 Challenge
                    </button>
                  </div>

                  {profileType === "struggling" && currentObjective.misconceptions.length > 0 && (
                    <div className="pt-2">
                      <label
                        htmlFor="misconception-select"
                        className="block text-2xs font-bold text-amber-900 mb-1"
                      >
                        Named Misconception:
                      </label>
                      <select
                        id="misconception-select"
                        data-testid="select-misconception"
                        value={selectedMisconception}
                        onChange={(e) => setSelectedMisconception(e.target.value)}
                        className="w-full py-1.5 px-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-2xs font-bold text-amber-950 cursor-pointer"
                      >
                        {currentObjective.misconceptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}: {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-4">
                <div className="text-2xs font-bold text-muted">
                  Includes curated source pack, activity catalogue, and multi-stage validator.
                </div>
                <button
                  type="button"
                  data-testid="generate-plan-button"
                  onClick={handleGeneratePlan}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Plan…</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Generate Lesson Plan</span>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-2xl text-xs font-bold">
                  {error}
                </div>
              )}
            </div>

            {/* Validation & Audit Dashboard */}
            {generationResult && (
              <div
                data-testid="planner-audit-panel"
                className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-6 animate-fade-in"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <span className="text-2xs font-black uppercase tracking-wider text-muted">
                      Audit Telemetry & Multi-Stage Validation
                    </span>
                    <h3 className="text-base font-extrabold text-ink mt-0.5">
                      {generationResult.plan.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      data-testid="badge-generation-model"
                      className="px-3 py-1 bg-surface-2 border border-line text-ink rounded-full text-xs font-extrabold"
                    >
                      Model: {generationResult.metadata.model}
                    </span>
                    <span
                      data-testid="badge-source-type"
                      className={`px-3 py-1 rounded-full text-2xs font-black uppercase tracking-wider ${
                        generationResult.isFallback
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      {generationResult.isFallback
                        ? `Fallback: ${generationResult.fallbackReason ?? "Authored"}`
                        : "Model Generated"}
                    </span>
                    <span
                      data-testid="badge-generation-latency"
                      className="text-2xs font-bold text-muted bg-surface-2 px-3 py-1 rounded-full border border-line"
                    >
                      Latency: {generationResult.metadata.latencyMs}ms
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div
                    data-testid="val-schema-card"
                    className={`p-4 rounded-2xl border ${
                      generationResult.metadata.validation.schemaValid
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    }`}
                  >
                    <div className="text-2xs font-black uppercase tracking-wider">
                      1. Schema Conformance
                    </div>
                    <div className="text-sm font-extrabold mt-1">
                      {generationResult.metadata.validation.schemaValid
                        ? "✓ Schema Valid (Zod)"
                        : "✗ Schema Violation"}
                    </div>
                    <div className="text-2xs mt-1 opacity-75">
                      Zod discriminated unions across all activities.
                    </div>
                  </div>

                  <div
                    data-testid="val-factual-card"
                    className={`p-4 rounded-2xl border ${
                      generationResult.metadata.validation.factualValid
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    }`}
                  >
                    <div className="text-2xs font-black uppercase tracking-wider">
                      2. Factual Integrity
                    </div>
                    <div className="text-sm font-extrabold mt-1">
                      {generationResult.metadata.validation.factualValid
                        ? "✓ Factual Integrity Valid"
                        : "✗ Factual/Simulation Issue"}
                    </div>
                    <div className="text-2xs mt-1 opacity-75">
                      Physical circuits & partition bounds verified.
                    </div>
                  </div>

                  <div
                    data-testid="val-pedagogical-card"
                    className={`p-4 rounded-2xl border ${
                      generationResult.metadata.validation.pedagogicalMatch
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    }`}
                  >
                    <div className="text-2xs font-black uppercase tracking-wider">
                      3. Pedagogical Fit
                    </div>
                    <div className="text-sm font-extrabold mt-1">
                      {generationResult.metadata.validation.pedagogicalMatch
                        ? `✓ Tailored: ${generationResult.metadata.learnerProfileUsed.profileType}`
                        : "⚠️ Generic Structure"}
                    </div>
                    <div className="text-2xs mt-1 opacity-75">
                      Activities specifically align with synthetic learner state.
                    </div>
                  </div>
                </div>

                {generationResult.metadata.validation.issues.length > 0 && (
                  <div className="p-4 bg-surface-2 rounded-2xl border border-line space-y-1">
                    <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
                      Validation Log Notes:
                    </span>
                    <ul className="text-xs text-muted space-y-0.5">
                      {generationResult.metadata.validation.issues.map((iss, i) => (
                        <li key={i}>• {iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live Interactive Player Preview */}
        {previewSessionData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">
                Interactive Lesson Player Preview (Simulated In-Memory Session)
              </h3>
              <div className="flex items-center gap-2">
                {selectedPreviewActivity && (
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewActivity(null)}
                    className="text-2xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full border border-red-200 cursor-pointer transition-colors"
                  >
                    ✕ Close Step Preview
                  </button>
                )}
                <span className="text-2xs font-bold text-muted bg-surface px-3 py-1 rounded-full border border-line">
                  Deterministic Execution • Real Database Writes Skipped
                </span>
              </div>
            </div>

            <div
              data-testid="preview-lesson-player"
              className="border-2 border-line rounded-3xl overflow-hidden shadow-sm bg-surface"
            >
              <LessonPlayer
                key={previewSessionData.session.id}
                initialData={previewSessionData}
                isPreview={true}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
