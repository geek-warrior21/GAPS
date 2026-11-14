"use client";

import React from "react";
import type { VisualSpecDto } from "@gaps/contracts";

interface VisualViewerProps {
  visual?: VisualSpecDto;
  className?: string;
}

export function VisualViewer({ visual, className = "" }: VisualViewerProps) {
  if (!visual) return null;

  if (visual.type === "fraction_bar") {
    return (
      <div
        className={`p-4 bg-surface rounded-2xl border border-line shadow-sm space-y-3 ${className}`}
      >
        {visual.bars.map((bar, barIdx) => {
          const parts = Math.max(1, bar.parts);
          const shaded = Math.min(parts, Math.max(0, bar.shaded));

          return (
            <div key={barIdx} className="space-y-1">
              {bar.label && (
                <div className="text-xs font-semibold text-muted flex justify-between">
                  <span>{bar.label}</span>
                  <span className="tabular-nums font-mono text-primary font-bold">
                    {shaded}/{parts}
                  </span>
                </div>
              )}
              <div className="flex w-full h-10 border-2 border-primary-ink/70 rounded-xl overflow-hidden bg-surface-2 shadow-inner">
                {Array.from({ length: parts }).map((_, partIdx) => {
                  const isShaded = partIdx < shaded;
                  return (
                    <div
                      key={partIdx}
                      className={`flex-1 border-r border-primary-ink/40 last:border-r-0 transition-colors duration-200 flex items-center justify-center text-xs font-bold ${
                        isShaded ? "bg-primary text-white shadow-sm" : "bg-surface text-muted/60"
                      }`}
                    >
                      {parts <= 8 && <span>1/{parts}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (visual.type === "number_line") {
    const { min, max, divisions, markers = [], jumps = [] } = visual;
    const totalDivisions = Math.max(1, (max - min) * divisions);
    const width = 500;
    const height = jumps.length > 0 ? 120 : 80;
    const paddingX = 40;
    const lineY = jumps.length > 0 ? 80 : 45;
    const usableWidth = width - 2 * paddingX;

    const getX = (val: { n: number; d: number }) => {
      const numVal = val.n / val.d;
      const fraction = (numVal - min) / (max - min);
      return paddingX + fraction * usableWidth;
    };

    return (
      <div
        className={`p-4 bg-surface rounded-2xl border border-line shadow-sm overflow-x-auto ${className}`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-xl mx-auto block overflow-visible"
        >
          {/* Main axis line with arrows */}
          <line
            x1={paddingX - 15}
            y1={lineY}
            x2={width - paddingX + 15}
            y2={lineY}
            stroke="#18375A"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Left Arrow */}
          <polygon
            points={`${paddingX - 18},${lineY} ${paddingX - 10},${lineY - 4} ${paddingX - 10},${lineY + 4}`}
            fill="#18375A"
          />
          {/* Right Arrow */}
          <polygon
            points={`${width - paddingX + 18},${lineY} ${width - paddingX + 10},${lineY - 4} ${width - paddingX + 10},${lineY + 4}`}
            fill="#18375A"
          />

          {/* Division Ticks */}
          {Array.from({ length: totalDivisions + 1 }).map((_, i) => {
            const x = paddingX + (i / totalDivisions) * usableWidth;
            const isInteger = i % divisions === 0;
            const intVal = min + i / divisions;
            const tickHeight = isInteger ? 14 : 7;

            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={lineY - tickHeight}
                  x2={x}
                  y2={lineY + tickHeight}
                  stroke={isInteger ? "#18375A" : "#5B6C80"}
                  strokeWidth={isInteger ? "2.5" : "1.5"}
                />
                {isInteger && (
                  <text
                    x={x}
                    y={lineY + 28}
                    textAnchor="middle"
                    className="text-xs font-bold tabular-nums"
                    fill="#152743"
                  >
                    {intVal}
                  </text>
                )}
              </g>
            );
          })}

          {/* Jumps Arcs */}
          {jumps.map((jump, idx) => {
            const fromX = getX(jump.from);
            const toX = getX(jump.to);
            const midX = (fromX + toX) / 2;
            const arcHeight = Math.min(45, Math.abs(toX - fromX) * 0.45);
            const controlY = lineY - arcHeight;

            return (
              <g key={idx}>
                <path
                  d={`M ${fromX} ${lineY} Q ${midX} ${controlY} ${toX} ${lineY}`}
                  fill="none"
                  stroke="#285BAD"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
                {jump.label && (
                  <text
                    x={midX}
                    y={controlY - 4}
                    textAnchor="middle"
                    className="text-xs font-bold"
                    fill="#285BAD"
                  >
                    {jump.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Markers / Points on Line */}
          {markers.map((marker, idx) => {
            const x = getX(marker.value);
            return (
              <g key={idx}>
                <circle cx={x} cy={lineY} r="6" fill="#F2A93B" stroke="#152743" strokeWidth="2.5" />
                {marker.label && (
                  <text
                    x={x}
                    y={lineY - 14}
                    textAnchor="middle"
                    className="text-xs font-extrabold"
                    fill="#18375A"
                  >
                    {marker.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (visual.type === "area_model") {
    const { rows, cols, shadedRows, shadedCols } = visual;
    return (
      <div
        className={`p-4 bg-surface rounded-2xl border border-line shadow-sm max-w-sm mx-auto ${className}`}
      >
        <div
          className="grid gap-0.5 border-2 border-primary-ink/70 rounded-xl overflow-hidden bg-primary-ink/20"
          style={{
            gridTemplateRows: `repeat(${rows}, minmax(28px, 1fr))`,
            gridTemplateColumns: `repeat(${cols}, minmax(28px, 1fr))`,
          }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const isShadedRow = r < shadedRows;
              const isShadedCol = c < shadedCols;
              const isOverlap = isShadedRow && isShadedCol;
              const isSingleShaded = isShadedRow || isShadedCol;

              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center border border-line transition-colors ${
                    isOverlap
                      ? "bg-teal text-white font-bold"
                      : isSingleShaded
                        ? "bg-primary/40 text-primary-ink"
                        : "bg-surface"
                  }`}
                />
              );
            }),
          )}
        </div>
      </div>
    );
  }

  return null;
}
