"use client";

import React from "react";
import type { QuestDto } from "@gaps/contracts";

interface QuestCardProps {
  quest: QuestDto;
  onStartQuest?: () => void;
  className?: string;
}

export function QuestCard({ quest, onStartQuest, className = "" }: QuestCardProps) {
  const completedSlots = quest.slots.filter((s) => s.completed).length;
  const isCompleted = quest.status === "completed" || completedSlots === quest.slots.length;

  return (
    <div
      className={`p-5 bg-surface rounded-2xl border border-line shadow-xs space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <div>
            <h3 className="font-extrabold text-ink text-lg leading-tight">Daily Quest</h3>
            <p className="text-xs text-muted">Complete 3 daily steps for bonus sparks</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent font-extrabold text-xs">
          <span>✦</span>
          <span>+10 Sparks</span>
        </div>
      </div>

      {/* 3 Slots */}
      <div className="space-y-2.5">
        {quest.slots.map((slot, idx) => {
          return (
            <div
              key={slot.slotId}
              className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                slot.completed
                  ? "bg-teal/5 border-teal/30 text-ink"
                  : "bg-surface-2 border-line text-ink"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    slot.completed
                      ? "bg-teal text-white shadow-xs"
                      : "bg-surface border-2 border-line text-muted"
                  }`}
                >
                  {slot.completed ? "✓" : idx + 1}
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">{slot.title}</div>
                  <div className="text-xs text-muted capitalize">Kind: {slot.kind}</div>
                </div>
              </div>

              {slot.completed ? (
                <span className="text-xs font-bold text-teal px-2 py-0.5 rounded bg-teal/10">
                  Done
                </span>
              ) : (
                <span className="text-xs font-bold text-muted px-2 py-0.5 rounded bg-surface">
                  Ready
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress & Action */}
      <div className="pt-1 flex items-center justify-between">
        <div className="text-xs font-bold text-muted">
          Progress: <span className="text-ink">{completedSlots}</span> of {quest.slots.length} done
        </div>

        {onStartQuest && !isCompleted && (
          <button
            type="button"
            onClick={onStartQuest}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-ink active:scale-95 transition-all shadow-xs"
          >
            Start Quest →
          </button>
        )}

        {isCompleted && (
          <div className="text-xs font-extrabold text-teal flex items-center gap-1">
            <span>🎉 Quest Complete!</span>
          </div>
        )}
      </div>
    </div>
  );
}
