"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface HeaderProps {
  displayName?: string;
  sparksTotal?: number;
}

export function Header({ displayName, sparksTotal = 0 }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

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

  const navLinks = [
    { label: "Home", href: "/home" },
    { label: "Learn", href: "/learn" },
    { label: "Play", href: "/play" },
    { label: "GapMap", href: "/gapmap" },
    { label: "Solve With Me", href: "/solve" },
  ];

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/home"
            className="flex items-center gap-2.5 font-extrabold text-xl text-primary-ink shrink-0"
          >
            <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center text-base shadow-xs">
              G
            </span>
            <span className="tracking-tight">Gaps</span>
          </Link>

          {/* Desktop Navigation */}
          {displayName && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:text-ink hover:bg-surface-2"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {displayName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent-ink font-extrabold text-sm tabular-nums">
              <span>✦</span>
              <span>{sparksTotal} Sparks</span>
            </div>
          )}

          {displayName && (
            <div className="text-sm font-bold text-ink hidden lg:block">{displayName}</div>
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

      {/* Mobile Navigation bar */}
      {displayName && (
        <nav className="flex md:hidden items-center justify-around border-t border-line/60 px-2 py-1.5 bg-surface-2/40 overflow-x-auto">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive ? "bg-primary text-white shadow-2xs" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
