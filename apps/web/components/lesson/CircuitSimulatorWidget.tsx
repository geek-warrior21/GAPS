"use client";

import React from "react";
import type { CircuitSimulation } from "@gaps/contracts";

interface CircuitSimulatorWidgetProps {
  config: CircuitSimulation;
  switchState: "open" | "closed";
  wireConnected: boolean;
  onToggleSwitch?: () => void;
  onToggleWire?: () => void;
  readOnly?: boolean;
}

export function CircuitSimulatorWidget({
  config,
  switchState,
  wireConnected,
  onToggleSwitch,
  onToggleWire,
  readOnly = false,
}: CircuitSimulatorWidgetProps) {
  // Determine if electric current can complete the loop
  const isObjectConductor =
    config.conductiveObject === "none" || config.conductiveObject === "copper_key";
  const isCircuitClosed =
    switchState === "closed" &&
    wireConnected &&
    config.hasBattery &&
    config.hasBulb &&
    isObjectConductor;

  return (
    <div className="p-6 bg-surface rounded-3xl border border-line shadow-xs space-y-6">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all shadow-xs ${
              isCircuitClosed
                ? "bg-amber-400 text-amber-950 shadow-amber-300/50 shadow-md animate-pulse"
                : "bg-surface-2 text-muted border border-line"
            }`}
          >
            {isCircuitClosed ? "💡" : "⚪"}
          </div>

          <div>
            <span className="text-2xs font-extrabold text-muted uppercase tracking-wider">
              Circuit State
            </span>
            <h4 className="font-extrabold text-ink text-base">
              {isCircuitClosed ? "Complete Closed Loop" : "Open / Broken Circuit"}
            </h4>
            <p className="text-xs text-muted">
              {isCircuitClosed
                ? "Continuous conducting path: Electric current is flowing through the bulb!"
                : switchState === "open"
                  ? "Switch is OPEN: Air gap prevents charges from completing the loop."
                  : config.conductiveObject === "rubber_eraser"
                    ? "Rubber Eraser is an INSULATOR: Blocks electrical charges."
                    : "Wire is disconnected: Loop is incomplete."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
              isCircuitClosed
                ? "bg-teal/15 text-teal border-teal/40"
                : "bg-amber-100 text-amber-900 border-amber-300"
            }`}
          >
            {isCircuitClosed ? "⚡ Current ON" : "⏸ Current OFF"}
          </span>
        </div>
      </div>

      {/* Visual Circuit Board Diagram */}
      <div className="relative w-full h-64 bg-slate-900 rounded-3xl p-4 overflow-hidden border-2 border-slate-700 flex items-center justify-center shadow-inner">
        <svg
          viewBox="0 0 500 240"
          className="w-full h-full max-w-lg select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Circuit Loop Wires */}
          <path
            d="M 120 60 L 380 60 L 380 180 L 120 180 Z"
            fill="none"
            stroke={isCircuitClosed ? "#fbbf24" : "#64748b"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isCircuitClosed ? "transition-colors duration-300" : ""}
          />

          {/* Animated Electron Current Flow when closed */}
          {isCircuitClosed && (
            <path
              d="M 120 60 L 380 60 L 380 180 L 120 180 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeDasharray="8 12"
              className="animate-dash"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="0;-100"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* 1. Battery (Left side: 120, 120) */}
          <g transform="translate(90, 95)">
            {/* Battery Body */}
            <rect
              x="0"
              y="0"
              width="60"
              height="50"
              rx="6"
              fill="#1e293b"
              stroke="#94a3b8"
              strokeWidth="2"
            />
            {/* Positive terminal */}
            <rect x="22" y="-8" width="16" height="8" rx="2" fill="#ef4444" />
            <text x="30" y="16" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">
              +
            </text>
            <text x="30" y="36" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
              1.5V
            </text>
            <text x="30" y="47" fill="#64748b" fontSize="11" fontWeight="bold" textAnchor="middle">
              −
            </text>
          </g>

          {/* 2. Bulb (Right side: 380, 120) */}
          <g transform="translate(380, 120)">
            {/* Ambient Glow Aura when lit */}
            {isCircuitClosed && (
              <circle
                cx="0"
                cy="0"
                r="45"
                fill="#fef08a"
                opacity="0.35"
                className="animate-pulse"
              />
            )}
            {/* Bulb Glass */}
            <circle
              cx="0"
              cy="0"
              r="24"
              fill={isCircuitClosed ? "#fde047" : "#334155"}
              stroke="#cbd5e1"
              strokeWidth="2.5"
            />
            {/* Filament */}
            <path
              d="M -8 10 L -4 -6 L 0 4 L 4 -6 L 8 10"
              fill="none"
              stroke={isCircuitClosed ? "#b45309" : "#64748b"}
              strokeWidth="2"
            />
            {/* Bulb Base */}
            <rect x="-10" y="24" width="20" height="10" fill="#94a3b8" rx="2" />
            <text
              x="0"
              y="-30"
              fill={isCircuitClosed ? "#fef08a" : "#94a3b8"}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              {isCircuitClosed ? "Bulb: GLOWING" : "Bulb: OFF"}
            </text>
          </g>

          {/* 3. Switch (Top wire: center at 250, 60) */}
          <g transform="translate(220, 60)">
            {/* Contact Terminals */}
            <circle cx="0" cy="0" r="5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />
            <circle cx="60" cy="0" r="5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />

            {/* Lever */}
            {switchState === "closed" ? (
              <line
                x1="0"
                y1="0"
                x2="60"
                y2="0"
                stroke="#38bdf8"
                strokeWidth="5"
                strokeLinecap="round"
              />
            ) : (
              <line
                x1="0"
                y1="0"
                x2="50"
                y2="-28"
                stroke="#f87171"
                strokeWidth="5"
                strokeLinecap="round"
              />
            )}

            <text
              x="30"
              y="-32"
              fill={switchState === "closed" ? "#38bdf8" : "#f87171"}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              Switch: {switchState.toUpperCase()}
            </text>
          </g>

          {/* 4. Bottom Test Object / Gap (Center at 250, 180) */}
          {config.conductiveObject !== "none" && (
            <g transform="translate(220, 180)">
              {/* Gap Terminals */}
              <circle cx="0" cy="0" r="5" fill="#e2e8f0" />
              <circle cx="60" cy="0" r="5" fill="#e2e8f0" />

              {config.conductiveObject === "copper_key" ? (
                // Copper Key Object
                <g transform="translate(10, -10)">
                  <rect x="0" y="5" width="40" height="10" rx="3" fill="#b45309" stroke="#d97706" />
                  <circle cx="5" cy="10" r="8" fill="#b45309" stroke="#d97706" />
                  <circle cx="5" cy="10" r="3" fill="#0f172a" />
                  <text
                    x="20"
                    y="30"
                    fill="#fde68a"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    Copper Key (Metal)
                  </text>
                </g>
              ) : (
                // Rubber Eraser Object
                <g transform="translate(10, -10)">
                  <rect x="0" y="0" width="40" height="20" rx="4" fill="#ec4899" stroke="#f472b6" />
                  <text
                    x="20"
                    y="32"
                    fill="#fbcfe8"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    Rubber Eraser (Insulator)
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Control Buttons */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-line">
          <div className="space-y-0.5">
            <span className="text-2xs font-extrabold text-muted uppercase">
              Interactive Control
            </span>
            <p className="text-xs text-ink font-semibold">
              Click the button below or tap the switch to test loop continuity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onToggleSwitch && (
              <button
                type="button"
                data-testid="toggle-circuit-switch"
                onClick={onToggleSwitch}
                className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all shadow-xs flex items-center gap-2 ${
                  switchState === "open"
                    ? "bg-primary text-white hover:bg-primary-ink"
                    : "bg-surface-2 text-ink border border-line hover:bg-surface"
                }`}
              >
                <span>
                  {switchState === "open" ? "🔌 Close Switch (ON)" : "⚡ Open Switch (OFF)"}
                </span>
              </button>
            )}

            {onToggleWire && (
              <button
                type="button"
                data-testid="toggle-circuit-wire"
                onClick={onToggleWire}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface text-ink border border-line rounded-2xl font-bold text-xs shadow-xs"
              >
                {wireConnected ? "Disconnect Wire" : "Reconnect Wire"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
