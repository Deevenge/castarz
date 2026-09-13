"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={compact
        ? "flex size-11 items-center justify-center rounded-xl bg-brand-ice text-brand-navy ring-1 ring-brand-silver/60 transition hover:bg-brand-cyan/20"
        : "inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ice px-4 text-sm font-bold text-brand-navy ring-1 ring-brand-silver/60 transition hover:bg-brand-cyan/20"}
      aria-label={isDark ? "Switch to light mode" : "Switch to grey mode"}
      title={isDark ? "Light mode" : "Grey mode"}
    >
      <Icon className="size-5" />
      {!compact && <span>{isDark ? "Light mode" : "Grey mode"}</span>}
    </button>
  );
}
