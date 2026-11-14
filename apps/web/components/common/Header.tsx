"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeaderProps {
  displayName?: string;
  sparksTotal?: number;
}

export function Header({ displayName, sparksTotal = 0 }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/home"
          className="flex items-center gap-2.5 font-extrabold text-xl text-primary-ink"
        >
          <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center text-base shadow-xs">
            G
          </span>
          <span className="tracking-tight">Gaps</span>
        </Link>

        <div className="flex items-center gap-3">
          {displayName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent-ink font-extrabold text-sm tabular-nums">
              <span>✦</span>
              <span>{sparksTotal} Sparks</span>
            </div>
          )}

          {displayName && (
            <div className="text-sm font-bold text-ink hidden sm:block">{displayName}</div>
          )}

          {displayName ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-muted hover:text-ink px-3 py-1.5 rounded-xl border border-line bg-surface-2 hover:bg-line transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold text-white bg-primary hover:bg-primary-ink px-3.5 py-1.5 rounded-xl transition-colors shadow-2xs"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
