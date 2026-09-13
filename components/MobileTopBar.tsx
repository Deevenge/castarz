"use client";

import { type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileTopBar({ extra }: { extra?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-brand-silver/70 bg-white/95 px-3 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
      <BrandLogo className="h-8 w-auto min-w-0 max-w-[calc(100%-7rem)] flex-1 object-contain object-left" priority />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <ThemeToggle compact />
        {extra}
      </div>
    </header>
  );
}
