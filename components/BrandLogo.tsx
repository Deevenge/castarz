"use client";

import Image from "next/image";
import lightLogo from "@/app/images/logoz.png";
import darkLogo from "@/app/images/logo-dark.png";
import { useTheme } from "@/context/ThemeContext";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  const { isDark } = useTheme();
  return <Image src={isDark ? darkLogo : lightLogo} alt="CASTARZ" className={className} priority={priority} />;
}
