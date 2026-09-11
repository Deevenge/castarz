"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { loading, user, profile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      router.replace("/auth");
      return;
    }
    router.replace(`/${profile.role}/dashboard`);
  }, [loading, profile, router, user]);

  return <main className="flex min-h-dvh items-center justify-center bg-brand-ice"><LoaderCircle className="h-7 w-7 animate-spin text-brand-blue" aria-label="Loading" /></main>;
}
