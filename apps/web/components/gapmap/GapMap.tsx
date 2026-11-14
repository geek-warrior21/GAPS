"use client";

import React, { useState } from "react";
import type { GapMapConceptNode, GapMapResponse } from "@gaps/contracts";

interface GapMapProps {
  data: GapMapResponse;
  onSelectConcept?: (conceptId: string) => void;
  className?: string;
}

export function GapMap({ data, onSelectConcept, className = "" }: GapMapProps) {
  const [selectedNode, setSelectedNode] = useState<GapMapConceptNode | null>(null);

  const getStatusBadge = (status: GapMapConceptNode["status"]) => {
    switch (status) {
      case "retained":
        return {
          color: "bg-teal text-white border-teal shadow-xs",
          label: "Remembered",
          icon: "★",
          bg: "bg-teal/10 text-teal border-teal/30",
        };
      case "demonstrated":
        return {
          color: "bg-primary text-white border-primary shadow-xs",
          label: "You can do this",
          icon: "●",
          bg: "bg-primary/10 text-primary border-primary/30",
        };
      case "developing":
        return {
          color: "bg-[#8db8f0] text-ink border-[#6ca0e8]",
          label: "Getting there",
          icon: "◑",
          bg: "bg-blue-50 text-primary border-blue-200",
        };
      case "needs_support":
        return {
          color: "bg-accent text-white border-accent shadow-xs",
          label: "Let's work on this",
          icon: "▲",
          bg: "bg-accent/15 text-accent-ink border-accent/40",
        };
      case "not_assessed":
      default:
        return {
          color: "bg-surface-2 text-muted border-line border-dashed",
          label: "Not explored yet",
          icon: "○",
          bg: "bg-surface-2 text-muted border-line",
        };
    }
  };

  const getChapterConcepts = (chapterId: string) => {
    return data.concepts
      .filter((c) => c.chapterId === chapterId)
      .sort((a, b) => a.topoOrder - b.topoOrder);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Legend & Stats Banner */}
      <div className="p-4 bg-surface rounded-2xl border border-line shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-ink uppercase tracking-wider mr-1">
            Status:
          </span>
          {(
            [
              { s: "retained", l: "Remembered", i: "★", c: "bg-teal text-white" },
              { s: "demonstrated", l: "Demonstrated", i: "●", c: "bg-primary text-white" },
              { s: "developing", l: "Developing", i: "◑", c: "bg-[#8db8f0] text-ink" },
              { s: "needs_support", l: "Needs Support", i: "▲", c: "bg-accent text-white" },
              {
                s: "not_assessed",
                l: "Not Explored",
                i: "○",
                c: "bg-surface-2 text-muted border-dashed",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.s}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-line bg-surface"
            >
              <span
                className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[10px] ${item.c}`}
              >
                {item.i}
              </span>
              <span className="text-ink">{item.l}</span>
            </div>
          ))}
        </div>

        <div className="text-xs font-bold text-muted tabular-nums">
          <span className="text-teal font-extrabold">
            {data.summary.demonstratedCount + data.summary.retainedCount}
          </span>{" "}
          of <span className="text-ink">{data.summary.totalConcepts}</span> skills demonstrated
        </div>
      </div>

      {/* Chapters Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {data.chapters.map((chapter) => {
          const concepts = getChapterConcepts(chapter.id);
          return (
            <div
              key={chapter.id}
              className="p-5 bg-surface rounded-2xl border border-line shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
                  <h4 className="font-extrabold text-ink text-base">
                    Chapter {chapter.strand.toUpperCase()}: {chapter.title}
                  </h4>
                  <span className="text-xs font-bold text-muted px-2 py-0.5 rounded-full bg-surface-2 border border-line">
                    {concepts.length} skills
                  </span>
                </div>

                <div className="space-y-2.5">
                  {concepts.map((concept) => {
                    const badge = getStatusBadge(concept.status);
                    const isSelected = selectedNode?.id === concept.id;

                    return (
                      <button
                        key={concept.id}
                        type="button"
                        onClick={() => setSelectedNode(concept)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                            : "border-line bg-surface-2 hover:bg-surface hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0 border ${badge.color}`}
                          >
                            {badge.icon}
                          </span>
                          <div className="truncate">
                            <div className="text-sm font-bold text-ink truncate">
                              {concept.studentTitle}
                            </div>
                            <div className="text-[11px] text-muted truncate">{concept.title}</div>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Concept Evidence Modal / Drawer */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-3xl border border-line shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-full inline-flex items-center justify-center text-base font-bold border ${
                    getStatusBadge(selectedNode.status).color
                  }`}
                >
                  {getStatusBadge(selectedNode.status).icon}
                </span>
                <div>
                  <h3 className="font-extrabold text-ink text-xl leading-tight">
                    {selectedNode.studentTitle}
                  </h3>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    {selectedNode.title} · {selectedNode.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="w-8 h-8 rounded-full bg-surface-2 hover:bg-line text-muted hover:text-ink flex items-center justify-center font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-text leading-relaxed">{selectedNode.description}</p>

            {/* Evidence & Mastery Status */}
            <div className="p-4 bg-surface-2 rounded-2xl border border-line space-y-2">
              <div className="text-xs font-extrabold text-ink uppercase tracking-wider">
                Why this status?
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Mastery state:</span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-full text-xs border ${
                    getStatusBadge(selectedNode.status).bg
                  }`}
                >
                  {getStatusBadge(selectedNode.status).label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Independent practice attempts:</span>
                <span className="font-bold text-ink tabular-nums">
                  {selectedNode.independentCorrectN} correct of {selectedNode.independentN} total
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Measurement reliability:</span>
                <span className="font-bold text-ink capitalize">{selectedNode.reliability}</span>
              </div>
            </div>

            {/* Prerequisites */}
            {selectedNode.prereqIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-ink uppercase tracking-wider">
                  Prerequisites
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.prereqIds.map((pId) => {
                    const prereqNode = data.concepts.find((c) => c.id === pId);
                    return (
                      <span
                        key={pId}
                        className="px-2.5 py-1 rounded-xl bg-surface border border-line text-xs font-bold text-ink flex items-center gap-1.5"
                      >
                        <span className="text-primary font-bold">↳</span>
                        <span>{prereqNode?.studentTitle ?? pId}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex-1 py-3 bg-surface-2 hover:bg-line text-ink font-bold rounded-xl text-sm transition-colors"
              >
                Close
              </button>

              {onSelectConcept && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedNode.id;
                    setSelectedNode(null);
                    onSelectConcept(id);
                  }}
                  className="flex-1 py-3 bg-primary hover:bg-primary-ink text-white font-bold rounded-xl text-sm shadow-xs transition-colors"
                >
                  Practise this skill →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
