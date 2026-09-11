"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Bell, BriefcaseBusiness, ClipboardCheck, LayoutDashboard, LoaderCircle, LogOut, Settings, UsersRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useInbox } from "@/hooks/useInbox";
import { db } from "@/lib/firebase";
import logo from "@/app/images/logoz.png";

const links = [
  { href: "/agent/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/agent/briefs", label: "Briefs", icon: BriefcaseBusiness },
  { href: "/agent/network", label: "Talent", icon: UsersRound },
  { href: "/agent/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/agent/profile", label: "Agency", icon: Settings },
];

function UnreadDot({ count }: { count: number }) {
  if (!count) return null;
  return <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-cyan px-1 text-[10px] font-bold leading-4 text-brand-navy">{count > 9 ? "9+" : count}</span>;
}

export default function AgentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, signOut } = useAuth();
  const { unreadCount } = useInbox();
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    if (!loading && profile?.role !== "agent") router.replace(profile ? `/${profile.role}/dashboard` : "/auth");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(doc(db, "agencies", profile.uid), (snapshot) => {
      const data = snapshot.data();
      setAgencyName(typeof data?.name === "string" ? data.name : "");
    });
  }, [profile]);

  async function handleSignOut() {
    await signOut();
    router.replace("/auth");
  }

  if (loading || profile?.role !== "agent") {
    return <main className="flex min-h-dvh items-center justify-center bg-brand-ice"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></main>;
  }

  return (
    <div className="min-h-dvh bg-[#f6f9fd] text-brand-navy">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-brand-navy px-5 py-7 text-white lg:flex">
        <div className="rounded-2xl bg-white p-3"><Image src={logo} alt="CASTARZ" className="h-auto w-48" priority /></div>
        <p className="mt-4 text-xs font-bold tracking-[0.2em] text-brand-cyan">AGENCY CONSOLE</p>
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-cyan font-extrabold text-brand-navy">{(agencyName || profile.email).slice(0, 1).toUpperCase()}</div>
          <p className="mt-3 truncate font-semibold">{agencyName || "Set up your agency"}</p>
          <p className="mt-1 text-sm text-slate-300">{agencyName ? "Casting agency" : profile.email}</p>
        </div>
        <nav className="mt-7 space-y-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${pathname === href ? "bg-brand-blue text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="size-5" />{label}
            </Link>
          ))}
          <Link href="/agent/inbox" className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${pathname === "/agent/inbox" ? "bg-brand-blue text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
            <span className="relative"><Bell className="size-5" /><UnreadDot count={unreadCount} /></span>
            Inbox
          </Link>
        </nav>
        <button type="button" onClick={() => void handleSignOut()} className="mt-auto flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
          <LogOut className="size-5" />Log out
        </button>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-brand-silver/70 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Image src={logo} alt="CASTARZ" className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <Link href="/agent/inbox" className="relative flex size-11 items-center justify-center rounded-xl bg-brand-ice text-brand-navy" aria-label="Inbox">
            <Bell className="size-5" />
            <UnreadDot count={unreadCount} />
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-3 text-sm font-bold text-white">
            <LogOut className="size-4" />Log out
          </button>
        </div>
      </header>

      <main className="min-h-dvh px-4 py-6 pb-24 sm:px-7 lg:ml-72 lg:px-10 lg:py-10 lg:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[76px] items-center justify-around border-t border-brand-silver/70 bg-white/95 px-1 lg:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 text-[10px] font-bold ${pathname === href ? "text-brand-blue" : "text-slate-500"}`}>
            <Icon className="size-5" /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
