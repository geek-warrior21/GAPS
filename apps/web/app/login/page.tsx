"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("DEMO7A");
  const [username, setUsername] = useState("meera");
  const [pin, setPin] = useState("333333");
  const [deviceKind, setDeviceKind] = useState<"shared" | "personal">("personal");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCode || !username || pin.length !== 6 || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: joinCode.trim().toUpperCase(),
          username: username.trim().toLowerCase(),
          pin,
          deviceKind,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 423) {
          setError(
            "Account locked due to multiple incorrect PIN attempts. Please ask your teacher for help.",
          );
        } else {
          setError(err.error?.message || "Check your join code, username, or PIN.");
        }
        setIsLoading(false);
        return;
      }

      router.push("/home");
    } catch {
      setError("Network error. Please verify your connection.");
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setJoinCode("DEMO7A");
    setUsername(u);
    setPin(p);
  };

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-extrabold mx-auto shadow-sm">
          G
        </div>
        <h1 className="text-3xl font-extrabold text-ink tracking-tight">Sign in to Gaps</h1>
        <p className="text-sm text-muted">Adaptive maths learning for Class 6–8 students</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-6 shadow-sm rounded-3xl border border-line sm:px-10 space-y-6">
          {error && (
            <div className="p-4 bg-accent/15 border border-accent/40 rounded-2xl text-ink text-sm font-bold flex items-start gap-2.5">
              <span>⚠️</span>
              <div className="flex-1">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            {/* Join Code */}
            <div>
              <label
                htmlFor="joinCode"
                className="block text-xs font-extrabold text-ink uppercase tracking-wider mb-1"
              >
                Class Join Code
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. DEMO7A"
                required
                className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-bold focus:border-primary focus:bg-surface outline-none transition-colors uppercase tracking-wider"
              />
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-extrabold text-ink uppercase tracking-wider mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="e.g. meera"
                required
                className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-bold focus:border-primary focus:bg-surface outline-none transition-colors lowercase"
              />
            </div>

            {/* 6-digit PIN */}
            <div>
              <label
                htmlFor="pin"
                className="block text-xs font-extrabold text-ink uppercase tracking-wider mb-1"
              >
                6-digit Secret PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                required
                className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-bold text-center tracking-widest text-lg focus:border-primary focus:bg-surface outline-none transition-colors tabular-nums"
              />
            </div>

            {/* Device selection */}
            <div className="pt-1 flex items-center justify-between text-xs text-muted">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={deviceKind === "personal"}
                  onChange={(e) => setDeviceKind(e.target.checked ? "personal" : "shared")}
                  className="rounded text-primary focus:ring-primary w-4 h-4 border-line"
                />
                <span>Remember me on this personal device</span>
              </label>
            </div>

            {/* Sign in button */}
            <div className="pt-2">
              <button
                type="submit"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
                disabled={isLoading || !joinCode || !username || pin.length !== 6}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-base hover:bg-primary-ink active:scale-98 transition-all disabled:opacity-50 shadow-sm"
              >
                {isLoading ? "Signing in…" : "Sign In →"}
              </button>
            </div>
          </div>

          {/* Quick Demo Fill Buttons for Reviewers */}
          <div className="pt-4 border-t border-line space-y-2">
            <div className="text-xs font-extrabold text-muted uppercase tracking-wider text-center">
              Quick Demo Accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("meera", "333333")}
                className="p-2.5 bg-surface-2 hover:bg-line border border-line rounded-xl text-left transition-colors"
              >
                <div className="text-xs font-bold text-ink">Meera (Active)</div>
                <div className="text-[11px] text-teal font-semibold">Ready to learn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("kabir", "444444")}
                className="p-2.5 bg-surface-2 hover:bg-line border border-line rounded-xl text-left transition-colors"
              >
                <div className="text-xs font-bold text-ink">Kabir (Pending)</div>
                <div className="text-[11px] text-accent font-semibold">Consent check</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
