"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import { LogOut } from "lucide-react";
import logo from "@/app/images/logoz.png";

export function MobileTopBar({ extra, onSignOut }: { extra?: ReactNode; onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-brand-silver/70 bg-white/95 px-3 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
      <Image src={logo} alt="CASTARZ" className="h-8 w-auto min-w-0 max-w-[calc(100%-6.5rem)] flex-1 object-contain object-left" priority />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {extra}
        <button
          type="button"
          onClick={onSignOut}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white"
          aria-label="Log out"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </header>
  );
}
