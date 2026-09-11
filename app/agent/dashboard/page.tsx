"use client";

import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowUpRight, BriefcaseBusiness, ClipboardCheck, LoaderCircle, Plus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";

export default function AgentDashboardPage() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [pendingApps, setPendingApps] = useState(0);
  const [talentCount, setTalentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    const briefStop = onSnapshot(query(collection(db, "briefs"), where("agencyId", "==", user.uid)), (snapshot) => { setBriefs(snapshot.docs.map((item) => briefFromDocument(item.id, item.data()))); setLoading(false); }, () => setLoading(false));
    const appStop = onSnapshot(query(collection(db, "applications"), where("agencyId", "==", user.uid)), (snapshot) => setPendingApps(snapshot.docs.filter((item) => item.data().status === "pending").length));
    const talentStop = onSnapshot(query(collection(db, "connections"), where("agencyId", "==", user.uid)), (snapshot) => setTalentCount(snapshot.docs.filter((item) => item.data().status === "approved").length));
    return () => { briefStop(); appStop(); talentStop(); };
  }, [user]);
  const published = briefs.filter((brief) => brief.status === "published");
  return <div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold tracking-[0.18em] text-brand-blue">AGENCY OVERVIEW</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Your casting desk.</h1><p className="mt-2 text-slate-600">Move talent from brief to booking without the WhatsApp chaos.</p></div><Link href="/agent/briefs" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white hover:bg-brand-navy"><Plus className="size-5" />Create brief</Link></header><section className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={BriefcaseBusiness} label="Live briefs" value={loading ? "—" : String(published.length)} tone="bg-brand-navy" /><Metric icon={ClipboardCheck} label="New applications" value={loading ? "—" : String(pendingApps)} tone="bg-brand-blue" /><Metric icon={UsersRound} label="Private talent" value={loading ? "—" : String(talentCount)} tone="bg-cyan-600" /></section><section className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_0.85fr]"><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-brand-silver/70"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Active casting briefs</h2><p className="mt-1 text-sm text-slate-600">The briefs your actors can currently see.</p></div><Link href="/agent/briefs" className="text-sm font-bold text-brand-blue hover:text-brand-navy">View all</Link></div>{loading ? <div className="flex min-h-48 items-center justify-center"><LoaderCircle className="size-6 animate-spin text-brand-blue" /></div> : published.length ? <div className="mt-5 space-y-3">{published.slice(0, 3).map((brief) => <Link key={brief.id} href="/agent/briefs" className="flex items-center justify-between gap-3 rounded-2xl bg-brand-ice p-4 hover:bg-brand-cyan/15"><div className="min-w-0"><p className="truncate font-bold">{brief.title}</p><p className="mt-1 text-sm text-slate-600">{brief.location || "Location pending"} · {brief.shootDate || "Date pending"}</p></div><ArrowUpRight className="size-5 shrink-0 text-brand-blue" /></Link>)}</div> : <EmptyState title="Create your first brief" copy="Once published, it becomes a structured opportunity for your connected talent." action="Create brief" href="/agent/briefs" />}</div><div className="rounded-3xl bg-brand-navy p-6 text-white"><p className="text-sm font-bold tracking-[0.18em] text-brand-cyan">NEXT STEP</p><h2 className="mt-3 text-2xl font-bold">Build your private network.</h2><p className="mt-3 leading-6 text-slate-300">Review connection requests from actors, then approve only the talent you trust. Other agencies never see your network.</p><Link href="/agent/network" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-cyan px-4 text-sm font-bold text-brand-navy hover:bg-white">Review talent <ArrowUpRight className="size-4" /></Link></div></section></div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BriefcaseBusiness; label: string; value: string; tone: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70"><div className={`flex size-11 items-center justify-center rounded-2xl ${tone} text-white`}><Icon className="size-5" /></div><p className="mt-5 text-3xl font-bold">{value}</p><p className="mt-1 text-sm font-semibold text-slate-500">{label}</p></div>; }
function EmptyState({ title, copy, action, href }: { title: string; copy: string; action: string; href: string }) { return <div className="mt-5 flex min-h-48 flex-col justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/50 p-5"><p className="font-bold">{title}</p><p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{copy}</p><Link href={href} className="mt-4 text-sm font-bold text-brand-blue">{action} →</Link></div>; }
