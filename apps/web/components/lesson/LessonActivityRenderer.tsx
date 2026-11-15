"use client";

import React, { useState } from "react";
import type {
  LessonActivity,
  LessonActivityConfig,
  SimulationConfig,
  FractionStripSimulation,
  CircuitSimulation,
} from "@gaps/contracts";
import { FractionStripWidget } from "./FractionStripWidget";
import { CircuitSimulatorWidget } from "./CircuitSimulatorWidget";

interface LessonActivityRendererProps {
  activity: LessonActivity;
  isSubmitting: boolean;
  onRespond: (response: unknown) => Promise<void>;
  isFinalActivity?: boolean;
}

function extractSimulation(cfg: LessonActivityConfig): SimulationConfig | null {
  if (cfg.type === "interactive_manipulation") return cfg.simulation;
  if (cfg.type === "predict_and_observe") return cfg.simulation;
  if (cfg.type === "guided_practice") return cfg.simulation ?? null;
  return null;
}

export function LessonActivityRenderer({
  activity,
  isSubmitting,
  onRespond,
  isFinalActivity = false,
}: LessonActivityRendererProps) {
  const { config } = activity;
  const initialSim = extractSimulation(config);

  // 1. Simulation States
  const [stripParts, setStripParts] = useState(() =>
    initialSim?.simulationKind === "fraction_strip" ? (initialSim.initialParts ?? 4) : 4,
  );
  const [stripShaded, setStripShaded] = useState(() =>
    initialSim?.simulationKind === "fraction_strip" ? (initialSim.initialShaded ?? 1) : 1,
  );
  const [circuitSwitch, setCircuitSwitch] = useState<"open" | "closed">(() =>
    initialSim?.simulationKind === "circuit_loop"
      ? (initialSim.initialSwitchState ?? "open")
      : "open",
  );
  const [circuitWire, setCircuitWire] = useState(() =>
    initialSim?.simulationKind === "circuit_loop"
      ? (initialSim.initialWireConnected ?? true)
      : true,
  );

  // 2. Prediction States
  const [selectedPrediction, setSelectedPrediction] = useState<string | null>(null);
  const [hasRevealedPrediction, setHasRevealedPrediction] = useState(false);

  // 3. Guided Practice States
  const [guidedFeedback, setGuidedFeedback] = useState<{
    type: "success" | "retry";
    message: string;
  } | null>(null);
  const [guidedSolved, setGuidedSolved] = useState(false);

  // 4. Independent Check States
  const [independentAnswer, setIndependentAnswer] = useState("");
  const [checkSubmitted, setCheckSubmitted] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    isCorrect: boolean;
    explanation: string;
  } | null>(null);

  // Render Simulation Widget Helper
  const renderSimulation = (sim: SimulationConfig) => {
    if (sim.simulationKind === "fraction_strip") {
      return (
        <FractionStripWidget
          config={sim as FractionStripSimulation}
          currentParts={stripParts}
          currentShaded={stripShaded}
          onChangeParts={setStripParts}
          onChangeShaded={setStripShaded}
        />
      );
    }
    if (sim.simulationKind === "circuit_loop") {
      return (
        <CircuitSimulatorWidget
          config={sim as CircuitSimulation}
          switchState={circuitSwitch}
          wireConnected={circuitWire}
          onToggleSwitch={() => setCircuitSwitch((prev) => (prev === "open" ? "closed" : "open"))}
          onToggleWire={() => setCircuitWire((prev) => !prev)}
        />
      );
    }
    return null;
  };

  // --- 1. INTRO ACTIVITY ---
  if (config.type === "intro") {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black">
              📖
            </span>
            <div>
              <span className="text-2xs font-extrabold text-primary uppercase tracking-wider">
                Concept Introduction
              </span>
              <h2 className="text-xl font-extrabold text-ink">{config.headline}</h2>
            </div>
          </div>

          <div className="prose prose-sm text-ink/90 leading-relaxed font-medium bg-surface-2/40 p-6 rounded-2xl border border-line">
            <p className="whitespace-pre-line text-sm sm:text-base">{config.body}</p>
          </div>

          {config.hookQuestion && (
            <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                <span>🤔</span>
                <span className="uppercase tracking-wider">Think About This</span>
              </div>
              <p className="text-sm font-bold text-amber-950">{config.hookQuestion}</p>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onRespond({ acknowledged: true })}
              className="px-6 py-3 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? "Starting..." : "Let's Explore"}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. INTERACTIVE MANIPULATION ACTIVITY ---
  if (config.type === "interactive_manipulation") {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center text-xl font-black">
              🔬
            </span>
            <div>
              <span className="text-2xs font-extrabold text-sky-600 uppercase tracking-wider">
                Interactive Exploration
              </span>
              <h2 className="text-lg font-extrabold text-ink">{activity.title}</h2>
            </div>
          </div>

          <p className="text-sm text-muted font-medium">{activity.instructions}</p>
        </div>

        {renderSimulation(config.simulation)}

        <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-line">
          <p className="text-xs text-muted font-medium">
            Explore freely! Once you have manipulated the model, continue to the next activity.
          </p>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (config.simulation.simulationKind === "fraction_strip") {
                onRespond({ parts: stripParts, shaded: stripShaded });
              } else {
                onRespond({ switchState: circuitSwitch, wireConnected: circuitWire });
              }
            }}
            className="px-6 py-2.5 bg-primary hover:bg-primary-ink text-white rounded-xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? "Saving..." : "Next Step"}</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  // --- 3. PREDICT AND OBSERVE ACTIVITY ---
  if (config.type === "predict_and_observe") {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl font-black">
              🔮
            </span>
            <div>
              <span className="text-2xs font-extrabold text-amber-600 uppercase tracking-wider">
                Predict & Observe
              </span>
              <h2 className="text-lg font-extrabold text-ink">{activity.title}</h2>
            </div>
          </div>

          <div className="p-4 bg-surface-2/40 rounded-2xl border border-line">
            <p className="text-sm font-bold text-ink leading-relaxed">{config.prompt}</p>
          </div>

          {/* Prediction Choices */}
          <div className="space-y-3">
            <p className="text-xs font-extrabold text-muted uppercase tracking-wider">
              Step 1: Make your scientific prediction
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {config.predictionChoices.map((choice) => {
                const isSelected = selectedPrediction === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={hasRevealedPrediction}
                    onClick={() => setSelectedPrediction(choice.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-surface border-line text-ink hover:bg-surface-2"
                    } ${hasRevealedPrediction ? "opacity-75 cursor-default" : ""}`}
                  >
                    <span className="text-sm">{choice.text}</span>
                    <span className="text-xs font-bold text-muted">
                      {isSelected ? "● Selected" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!hasRevealedPrediction && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!selectedPrediction}
                onClick={() => setHasRevealedPrediction(true)}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span>Test Prediction & Observe</span>
                <span>⚡</span>
              </button>
            </div>
          )}
        </div>

        {/* Revealed Observation & Simulation */}
        {hasRevealedPrediction && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 bg-teal-500/10 border border-teal-500/20 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-teal-800 font-black text-xs uppercase tracking-wider">
                <span>👁️</span>
                <span>Observation & Why It Happens</span>
              </div>
              <p className="text-sm font-bold text-teal-950">
                {config.observationReveal.expectedObservation}
              </p>
              <p className="text-xs font-medium text-teal-900 leading-relaxed">
                {config.observationReveal.explanation}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-muted uppercase tracking-wider px-2">
                Step 2: Verify hands-on in the simulator
              </div>
              {renderSimulation(config.simulation)}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  onRespond({
                    choiceId: selectedPrediction ?? "",
                    verified: true,
                  })
                }
                className="px-6 py-3 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? "Submitting..." : "Continue to Next Activity"}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 4. GUIDED PRACTICE ACTIVITY ---
  if (config.type === "guided_practice") {
    const handleCheckGuided = () => {
      let isMet = false;
      let submittedVal = "";

      if (config.simulation?.simulationKind === "fraction_strip") {
        submittedVal = `${stripShaded}/${stripParts}`;
        isMet = submittedVal === config.targetCriteria.expectedValue;
      } else if (config.simulation?.simulationKind === "circuit_loop") {
        const isClosed =
          circuitSwitch === "closed" &&
          circuitWire &&
          (config.simulation.conductiveObject === "none" ||
            config.simulation.conductiveObject === "copper_key");
        submittedVal = isClosed ? "closed" : "open";
        isMet = submittedVal === config.targetCriteria.expectedValue;
      }

      if (isMet) {
        setGuidedFeedback({ type: "success", message: config.successFeedback });
        setGuidedSolved(true);
      } else {
        setGuidedFeedback({ type: "retry", message: config.retryFeedback });
        setGuidedSolved(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-xl font-black">
              🎯
            </span>
            <div>
              <span className="text-2xs font-extrabold text-indigo-600 uppercase tracking-wider">
                Guided Challenge
              </span>
              <h2 className="text-lg font-extrabold text-ink">{activity.title}</h2>
            </div>
          </div>

          <div className="p-4 bg-surface-2/40 rounded-2xl border border-line">
            <p className="text-sm font-bold text-ink leading-relaxed">{config.prompt}</p>
          </div>
        </div>

        {config.simulation && renderSimulation(config.simulation)}

        {guidedFeedback && (
          <div
            className={`p-5 rounded-2xl border transition-all ${
              guidedFeedback.type === "success"
                ? "bg-teal-500/10 border-teal-500/20 text-teal-950"
                : "bg-amber-500/10 border-amber-500/20 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider mb-1">
              <span>{guidedFeedback.type === "success" ? "🎉" : "💡"}</span>
              <span>{guidedFeedback.type === "success" ? "Goal Achieved!" : "Try Adjusting"}</span>
            </div>
            <p className="text-xs sm:text-sm font-medium leading-relaxed">
              {guidedFeedback.message}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-line">
          <p className="text-xs text-muted font-medium">
            {guidedSolved
              ? "Great job! Ready to proceed to the next step."
              : "Adjust the controls above to match the target criteria."}
          </p>

          {!guidedSolved ? (
            <button
              type="button"
              onClick={handleCheckGuided}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              Check Solution
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                let submittedVal = "";
                if (config.simulation?.simulationKind === "fraction_strip") {
                  submittedVal = `${stripShaded}/${stripParts}`;
                } else if (config.simulation?.simulationKind === "circuit_loop") {
                  submittedVal = "closed";
                }
                onRespond({ value: submittedVal });
              }}
              className="px-6 py-2.5 bg-primary hover:bg-primary-ink text-white rounded-xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? "Proceeding..." : "Continue"}</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- 5. INDEPENDENT CHECK ACTIVITY ---
  if (config.type === "independent_check") {
    const handleCheckSubmit = () => {
      const isCorrect =
        independentAnswer.trim().toLowerCase() === config.correctAnswer.trim().toLowerCase();
      setCheckResult({
        isCorrect,
        explanation: config.explanation,
      });
      setCheckSubmitted(true);
    };

    return (
      <div className="space-y-6">
        <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-xl font-black">
              ✍️
            </span>
            <div>
              <span className="text-2xs font-extrabold text-teal-600 uppercase tracking-wider">
                Independent Check
              </span>
              <h2 className="text-lg font-extrabold text-ink">{activity.title}</h2>
            </div>
          </div>

          <div className="p-5 bg-surface-2/40 rounded-2xl border border-line">
            <p className="text-sm sm:text-base font-bold text-ink leading-relaxed">
              {config.prompt}
            </p>
          </div>

          {/* Choices or Input Field */}
          {config.questionType === "choice" && config.choices && (
            <div className="grid grid-cols-1 gap-2.5">
              {config.choices.map((choice) => {
                const isSelected = independentAnswer === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={checkSubmitted}
                    onClick={() => setIndependentAnswer(choice.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-surface border-line text-ink hover:bg-surface-2"
                    } ${checkSubmitted ? "opacity-75 cursor-default" : ""}`}
                  >
                    <span className="text-sm">{choice.text}</span>
                    <span className="text-xs font-bold text-muted">
                      {isSelected ? "● Selected" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {config.questionType !== "choice" && (
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-muted uppercase tracking-wider block">
                Your Answer
              </label>
              <input
                type="text"
                disabled={checkSubmitted}
                value={independentAnswer}
                onChange={(e) => setIndependentAnswer(e.target.value)}
                placeholder="e.g. 3/4"
                className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink font-bold text-base focus:outline-hidden focus:border-primary"
              />
            </div>
          )}

          {!checkSubmitted && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!independentAnswer.trim()}
                onClick={handleCheckSubmit}
                className="px-6 py-2.5 bg-primary hover:bg-primary-ink text-white rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                Submit Answer
              </button>
            </div>
          )}
        </div>

        {checkSubmitted && checkResult && (
          <div className="space-y-6 animate-fade-in">
            <div
              className={`p-6 rounded-3xl border space-y-3 ${
                checkResult.isCorrect
                  ? "bg-teal-500/10 border-teal-500/20 text-teal-950"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <span>{checkResult.isCorrect ? "✅" : "💡"}</span>
                <span>
                  {checkResult.isCorrect ? "Correct Response!" : "Good Try — Learning Opportunity"}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed">{checkResult.explanation}</p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onRespond({ answer: independentAnswer })}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? "Submitting..."
                    : isFinalActivity
                      ? "Complete Lesson & Collect Sparks"
                      : "Submit & Continue"}
                </span>
                <span>{isFinalActivity ? "✨" : "→"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 6. STOPPING POINT ACTIVITY ---
  if (config.type === "stopping_point") {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center text-2xl font-black">
              🛑
            </span>
            <div>
              <span className="text-2xs font-extrabold text-amber-700 uppercase tracking-wider">
                Support & Reflection
              </span>
              <h2 className="text-xl font-extrabold text-ink">{config.headline}</h2>
            </div>
          </div>

          <div className="prose prose-sm text-ink/90 leading-relaxed font-medium bg-surface-2/40 p-6 rounded-2xl border border-line">
            <p className="whitespace-pre-line text-sm sm:text-base">{config.body}</p>
          </div>

          {config.keyTakeaways && config.keyTakeaways.length > 0 && (
            <div className="p-5 bg-teal-500/10 border border-teal-500/20 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-teal-800 font-black text-xs uppercase tracking-wider">
                <span>💡</span>
                <span>Key Takeaways</span>
              </div>
              <ul className="space-y-2">
                {config.keyTakeaways.map((takeaway, idx) => (
                  <li
                    key={idx}
                    className="text-xs sm:text-sm font-bold text-teal-950 flex items-start gap-2"
                  >
                    <span className="text-teal-600 font-black">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-5 bg-surface-2/60 border border-line rounded-2xl space-y-1">
            <div className="text-2xs font-black uppercase tracking-wider text-muted">
              Recommendation
            </div>
            <p className="text-xs sm:text-sm font-bold text-ink">{config.recommendation}</p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onRespond({ acknowledged: true })}
              className="px-6 py-3 bg-primary hover:bg-primary-ink text-white rounded-2xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? "Proceeding..." : "Acknowledge & Continue"}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
