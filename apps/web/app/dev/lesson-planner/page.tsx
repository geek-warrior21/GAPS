"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
  LessonPlanGenerateResponse,
  LessonSessionResponse,
  SyntheticLearnerProfile,
} from "@gaps/contracts";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

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
  const [subject, setSubject] = useState<"maths" | "science">("maths");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>("MATH-FRAC-PART");
  const [profileType, setProfileType] = useState<
    "new_learner" | "struggling" | "ready_for_challenge"
  >("struggling");
  const [selectedMisconception, setSelectedMisconception] = useState<string>("REV");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<LessonPlanGenerateResponse | null>(null);

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

  const previewSessionData: LessonSessionResponse | null = generationResult?.plan
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
        {/* Planner Configuration Card */}
        <div className="p-6 sm:p-8 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Configure Lesson Plan Generation</h2>
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
              <span className="block text-2xs text-muted font-medium">
                Standard: Class 6 Curriculum
              </span>
            </div>

            {/* 2. Objective Selection */}
            <div className="space-y-2">
              <label
                htmlFor="objective-select"
                className="text-xs font-extrabold text-ink uppercase tracking-wider"
              >
                2. Supported Objective
              </label>
              <select
                id="objective-select"
                data-testid="select-objective-dropdown"
                value={selectedObjectiveId}
                onChange={(e) => handleObjectiveChange(e.target.value)}
                className="w-full py-2.5 px-3 bg-surface-2 border border-line rounded-xl text-xs font-bold text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {availableObjectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.title}
                  </option>
                ))}
              </select>
              <span className="block text-2xs text-muted font-medium">
                Strand: {currentObjective.strand.toUpperCase()} • {currentObjective.id}
              </span>
            </div>

            {/* 3. Synthetic Learner Profile */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-ink uppercase tracking-wider">
                3. Synthetic Learner Profile
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="profile-new-learner"
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

          <div className="pt-4 flex items-center justify-between border-t border-line">
            <span className="text-xs text-muted font-medium">
              Uses Curated Source Pack, Supported Activity Catalogue, and Multi-Stage Validator.
            </span>
            <button
              type="button"
              data-testid="generate-plan-button"
              disabled={isLoading}
              onClick={handleGeneratePlan}
              className="px-8 py-3.5 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <span>{isLoading ? "Generating with Planner..." : "Generate Lesson Plan"}</span>
              <span>✨</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-900 rounded-2xl text-xs font-bold">
            Generation Error: {error}
          </div>
        )}

        {/* Metadata, Validation & Audit Summary Panel */}
        {generationResult && (
          <div
            data-testid="planner-audit-panel"
            className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-6 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
              <div className="space-y-1">
                <span className="text-2xs font-black uppercase tracking-wider text-muted">
                  Generation Metadata & Audit Trail
                </span>
                <h3 className="text-lg font-extrabold text-ink">
                  {generationResult.plan.title} (ID: {generationResult.plan.lessonId})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="badge-generation-model"
                  className="px-3 py-1 bg-surface-2 border border-line text-ink rounded-full text-xs font-extrabold"
                >
                  Model: {generationResult.metadata.model}
                </span>
                <span
                  data-testid="badge-generation-latency"
                  className="px-3 py-1 bg-surface-2 border border-line text-ink rounded-full text-xs font-extrabold"
                >
                  ⏱️ {generationResult.metadata.latencyMs} ms
                </span>
                <span
                  data-testid="badge-fallback-status"
                  className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                    generationResult.isFallback
                      ? "bg-amber-500/10 text-amber-900 border-amber-500/20"
                      : "bg-teal-500/10 text-teal-900 border-teal-500/20"
                  }`}
                >
                  {generationResult.isFallback
                    ? `Fallback (${generationResult.fallbackReason})`
                    : "Live / Fixture Generated"}
                </span>
              </div>
            </div>

            {/* Validation Distinction: Schema vs Factual vs Pedagogical */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                data-testid="val-schema-card"
                className={`p-4 rounded-2xl border ${
                  generationResult.metadata.validation.schemaValid
                    ? "bg-teal-500/10 border-teal-500/20 text-teal-950"
                    : "bg-red-500/10 border-red-500/20 text-red-950"
                }`}
              >
                <div className="text-2xs font-black uppercase tracking-wider opacity-80">
                  1. Structural Schema
                </div>
                <div className="text-sm font-extrabold mt-1">
                  {generationResult.metadata.validation.schemaValid
                    ? "✓ Schema Valid (Zod)"
                    : "✗ Schema Invalid"}
                </div>
                <div className="text-2xs mt-1 opacity-75">
                  Conforms strictly to version 1.0 JSON format.
                </div>
              </div>

              <div
                data-testid="val-factual-card"
                className={`p-4 rounded-2xl border ${
                  generationResult.metadata.validation.factualValid
                    ? "bg-teal-500/10 border-teal-500/20 text-teal-950"
                    : "bg-red-500/10 border-red-500/20 text-red-950"
                }`}
              >
                <div className="text-2xs font-black uppercase tracking-wider opacity-80">
                  2. Factual & Semantic
                </div>
                <div className="text-sm font-extrabold mt-1">
                  {generationResult.metadata.validation.factualValid
                    ? "✓ Factual Integrity Valid"
                    : "✗ Semantic Discrepancy"}
                </div>
                <div className="text-2xs mt-1 opacity-75">
                  Simulation parameters, choice links, and answer correctness verified.
                </div>
              </div>

              <div
                data-testid="val-pedagogical-card"
                className={`p-4 rounded-2xl border ${
                  generationResult.metadata.validation.pedagogicalMatch
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-950"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-950"
                }`}
              >
                <div className="text-2xs font-black uppercase tracking-wider opacity-80">
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

        {/* Live Interactive Player Preview */}
        {previewSessionData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">
                Interactive Lesson Player Preview (Simulated In-Memory Session)
              </h3>
              <span className="text-2xs font-bold text-muted bg-surface px-3 py-1 rounded-full border border-line">
                Deterministic Execution • Real Database Writes Skipped
              </span>
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
