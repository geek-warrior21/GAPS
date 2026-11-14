"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TutorIntent, TutorMessageDto } from "@gaps/contracts";
import { VisualViewer } from "../visuals/VisualViewer";

interface TutorPanelProps {
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  lastOutcome?: string | null;
}

export function TutorPanel({ sessionId, isOpen, onToggle, lastOutcome }: TutorPanelProps) {
  const [messages, setMessages] = useState<TutorMessageDto[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTurns, setRemainingTurns] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/v1/sessions/${sessionId}/tutor`);
        if (res.ok && mounted) {
          const data = await res.json();
          setMessages(data.conversation ?? []);
          if (data.remainingTurns !== undefined) {
            setRemainingTurns(data.remainingTurns);
          }
        }
      } catch {
        // Non-blocking fetch failure
      }
    };

    fetchHistory();
    return () => {
      mounted = false;
    };
  }, [sessionId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendTutorMessage = async (text: string, intent?: TutorIntent) => {
    if (!text.trim() || isLoading || remainingTurns <= 0) return;

    setError(null);
    setIsLoading(true);

    const clientMessageId = crypto.randomUUID();
    const optimisticStudentMsg: TutorMessageDto = {
      id: `temp_${Date.now()}`,
      role: "student",
      text: text.trim(),
      clientMessageId,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticStudentMsg]);
    setInputText("");

    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          intent,
          clientMessageId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.conversation ?? []);
        if (data.remainingTurns !== undefined) {
          setRemainingTurns(data.remainingTurns);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error?.message ?? "Could not get response from tutor.");
      }
    } catch {
      setError("Network error communicating with tutor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTutorMessage(inputText, "free_text");
  };

  return (
    <div className="w-full bg-surface-2 border border-primary/20 rounded-3xl shadow-sm overflow-hidden transition-all duration-200">
      {/* Panel Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between border-b border-primary/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-xs">
            ✨
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-ink">Gaps AI Maths Tutor</span>
              <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                Guidance Only
              </span>
            </div>
            <p className="text-3xs text-muted">
              {remainingTurns > 0
                ? `${remainingTurns} tutor turns remaining`
                : "No turns remaining in this session"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="px-3 py-1 bg-surface hover:bg-surface-2 active:bg-line border border-line rounded-xl text-xs font-bold text-muted hover:text-ink transition-colors"
          data-testid="toggle-tutor-btn"
        >
          {isOpen ? "Hide Tutor ▲" : "Ask Tutor ▼"}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Information Notice */}
          <div className="px-3.5 py-2 bg-primary/5 rounded-xl border border-primary/10 text-3xs text-primary/80 font-medium">
            💡 The tutor helps you understand the concept. To progress or earn sparks, submit your
            final answer on the AnswerPad below.
          </div>

          {/* Quick Action Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              disabled={isLoading || remainingTurns <= 0}
              onClick={() => sendTutorMessage("Give me a hint", "hint")}
              className="px-3 py-1.5 bg-surface hover:bg-surface-2 disabled:opacity-50 border border-line rounded-xl text-xs font-bold text-primary flex items-center gap-1 shadow-2xs transition-all"
              data-testid="tutor-quick-hint"
            >
              <span>💡</span> Give me a hint
            </button>

            {lastOutcome && lastOutcome !== "correct" && (
              <button
                type="button"
                disabled={isLoading || remainingTurns <= 0}
                onClick={() =>
                  sendTutorMessage("Why was my answer not yet correct?", "why_incorrect")
                }
                className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 disabled:opacity-50 border border-accent/40 rounded-xl text-xs font-bold text-ink flex items-center gap-1 shadow-2xs transition-all"
                data-testid="tutor-quick-why"
              >
                <span>❓</span> Why was I not yet?
              </button>
            )}

            <button
              type="button"
              disabled={isLoading || remainingTurns <= 0}
              onClick={() => sendTutorMessage("Can you explain this differently?", "explain")}
              className="px-3 py-1.5 bg-surface hover:bg-surface-2 disabled:opacity-50 border border-line rounded-xl text-xs font-bold text-ink flex items-center gap-1 shadow-2xs transition-all"
            >
              <span>🔄</span> Explain differently
            </button>

            <button
              type="button"
              disabled={isLoading || remainingTurns <= 0}
              onClick={() => sendTutorMessage("Can you show a visual model?", "visual")}
              className="px-3 py-1.5 bg-surface hover:bg-surface-2 disabled:opacity-50 border border-line rounded-xl text-xs font-bold text-ink flex items-center gap-1 shadow-2xs transition-all"
            >
              <span>🖼️</span> Show visual
            </button>

            <button
              type="button"
              disabled={isLoading || remainingTurns <= 0}
              onClick={() => sendTutorMessage("Show me an example", "example")}
              className="px-3 py-1.5 bg-surface hover:bg-surface-2 disabled:opacity-50 border border-line rounded-xl text-xs font-bold text-ink flex items-center gap-1 shadow-2xs transition-all"
            >
              <span>📖</span> Example
            </button>
          </div>

          {/* Conversation History */}
          <div
            className="max-h-80 overflow-y-auto space-y-3 p-3 bg-surface rounded-2xl border border-line/60"
            data-testid="tutor-conversation-thread"
          >
            {messages.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted">
                <span className="text-xl block mb-1">👋</span>
                Hi there! Ask me a question or tap one of the hint buttons above.
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isStudent = msg.role === "student";
                return (
                  <div
                    key={msg.id ?? idx}
                    className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-2xs ${
                        isStudent
                          ? "bg-primary text-white rounded-br-2xs"
                          : "bg-surface-2 text-ink border border-line rounded-bl-2xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.visual && (
                        <div className="mt-2 pt-2 border-t border-line/50">
                          <VisualViewer visual={msg.visual} />
                        </div>
                      )}
                    </div>
                    <span className="text-3xs text-muted/60 mt-0.5 px-1">
                      {isStudent ? "You" : "Gaps Tutor"}
                    </span>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted italic p-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                Gaps Tutor is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Free-text input */}
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading || remainingTurns <= 0}
              placeholder={
                remainingTurns <= 0
                  ? "Turn limit reached for this session"
                  : "Ask a question about this problem..."
              }
              className="flex-1 px-4 py-2 text-xs bg-surface border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 disabled:opacity-50 text-ink placeholder:text-muted"
              data-testid="tutor-input-field"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading || remainingTurns <= 0}
              className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center gap-1"
              data-testid="tutor-send-btn"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
