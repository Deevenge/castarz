"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { BriefcaseBusiness, House, ImagePlus, LoaderCircle, LogOut, MessageCircle, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import logo from "@/app/images/logoz.png";
import { db } from "@/lib/firebase";

const links = [
  { href: "/actor/dashboard", label: "Home", icon: House },
  { href: "/actor/briefs", label: "My applications", icon: BriefcaseBusiness },
  { href: "/actor/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/actor/albums", label: "Albums", icon: ImagePlus },
  { href: "/actor/profile", label: "Profile", icon: UserRound },
];

export default function ActorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, signOut } = useAuth();
  const [actorName, setActorName] = useState("");

  useEffect(() => {
    if (!loading && profile?.role !== "actor") router.replace(profile ? `/${profile.role}/dashboard` : "/auth");
  }, [loading, profile, router]);
  useEffect(() => { if (!profile) return; return onSnapshot(doc(db, "actors", profile.uid), (snapshot) => setActorName(typeof snapshot.data()?.fullName === "string" ? snapshot.data()?.fullName : "")); }, [profile]);

  if (loading || profile?.role !== "actor") return <main className="flex min-h-dvh items-center justify-center bg-brand-ice"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></main>;

  return (
    <div className="min-h-dvh bg-brand-ice text-brand-navy">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-brand-silver/70 bg-white px-5 py-7 lg:flex">
        <Image src={logo} alt="CASTARZ" className="h-auto w-48" priority />
<div className="mt-10 rounded-2xl bg-brand-ice p-4"><div className="flex size-11 items-center justify-center rounded-full bg-brand-blue text-white"><UserRound className="size-5" /></div><p className="mt-3 truncate font-semibold">{actorName || "Complete your profile"}</p><p className="mt-1 text-sm text-slate-500">{actorName ? "Actor workspace" : profile.email}</p></div>
        <nav className="mt-7 space-y-2" aria-label="Actor navigation">{links.map(({ href, label, icon: Icon }) => { const active = href === "/actor/dashboard" ? pathname === href : pathname.startsWith(href); return <Link key={label} href={href} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${active ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/15" : "text-slate-600 hover:bg-brand-ice hover:text-brand-navy"}`}><Icon className="size-5" />{label}</Link>; })}</nav>
        <button type="button" onClick={() => signOut()} className="mt-auto flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-700"><LogOut className="size-5" />Log out</button>
      </aside>
      <main className="mx-auto min-h-dvh max-w-6xl px-4 py-6 pb-24 sm:px-7 lg:ml-72 lg:max-w-none lg:px-10 lg:py-10 lg:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[76px] items-center justify-around border-t border-brand-silver/70 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Actor navigation">{links.map(({ href, label, icon: Icon }) => { const active = href === "/actor/dashboard" ? pathname === href : pathname.startsWith(href); return <Link key={label} href={href} className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold ${active ? "text-brand-blue" : "text-slate-500"}`}><Icon className={`size-5 ${active ? "fill-brand-cyan/20" : ""}`} /><span>{label}</span></Link>; })}</nav>
    </div>
  );
}
