"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoLoader } from "@/components/LogoLoader";
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

  return <LogoLoader />;
}
