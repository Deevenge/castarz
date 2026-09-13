"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import logo from "@/app/images/logoz.gif";

export function MobileTopBar({ extra }: { extra?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-brand-silver/70 bg-white/95 px-3 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
      <Image src={logo} alt="CASTARZ" className="h-8 w-auto min-w-0 max-w-[calc(100%-4rem)] flex-1 object-contain object-left" priority unoptimized />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {extra}
      </div>
    </header>
  );
}
