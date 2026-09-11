"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import Link from "next/link";
import { Bell, CheckCircle2, Clock3, LoaderCircle, MapPin, Send, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

export default function ActorDashboardPage() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [tab, setTab] = useState<"discover" | "network">("discover");
  const [connectedAgencyIds, setConnectedAgencyIds] = useState<string[]>([]);
  const connectedKey = connectedAgencyIds.join("|");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "briefs"), where("status", "==", "published"), where("visibility", "==", "public")),
      (snapshot) => setBriefs((current) => {
        const publicBriefs = snapshot.docs.map((item) => briefFromDocument(item.id, item.data()));
        const networkBriefs = current.filter((brief) => brief.visibility === "network");
        return [...publicBriefs, ...networkBriefs];
      }),
    );
  }, []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), (snapshot) => setAppliedIds(snapshot.docs.map((item) => item.data().briefId).filter((id): id is string => typeof id === "string")));
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "connections"), where("actorUid", "==", user.uid)), (snapshot) => {
      const ids = snapshot.docs.filter((item) => item.data().status === "approved").map((item) => item.data().agencyId).filter((id): id is string => typeof id === "string");
      ids.sort();
      setConnectedAgencyIds(ids);
    });
  }, [user]);
  useEffect(() => {
    if (!connectedAgencyIds.length) {
      setBriefs((current) => current.filter((brief) => brief.visibility === "public"));
      return;
    }
    const chunks: string[][] = [];
    for (let index = 0; index < connectedAgencyIds.length; index += 10) {
      chunks.push(connectedAgencyIds.slice(index, index + 10));
    }
    const unsubscribers = chunks.map((agencyIds) => onSnapshot(
      query(collection(db, "briefs"), where("status", "==", "published"), where("visibility", "==", "network"), where("agencyId", "in", agencyIds)),
      (snapshot) => {
        const networkBriefs = snapshot.docs.map((item) => briefFromDocument(item.id, item.data()));
        setBriefs((current) => {
          const publicBriefs = current.filter((brief) => brief.visibility === "public");
          const fromOtherChunks = current.filter((brief) => brief.visibility === "network" && !agencyIds.includes(brief.agencyId));
          return [...publicBriefs, ...fromOtherChunks, ...networkBriefs];
        });
      },
    ));
    return () => unsubscribers.forEach((stop) => stop());
  }, [connectedKey]);

  async function apply(brief: AgentBrief) {
    if (!user || appliedIds.includes(brief.id)) return;
    setApplyingId(brief.id); setNotice("");
    try {
      const applicationRef = doc(db, "applications", `${brief.id}_${user.uid}`);
      await setDoc(applicationRef, { briefId: brief.id, actorUid: user.uid, agencyId: brief.agencyId, status: "pending", createdAt: serverTimestamp() });
      await notifyQuietly({
        recipientUid: brief.agencyId,
        senderUid: user.uid,
        type: "application_received",
        title: "New application",
        body: `An actor applied for ${brief.title}. Open the dossier to review and book.`,
        href: "/agent/applications",
      });
      setNotice("Application sent. Your agent will review your profile and availability.");
    } catch { setNotice("We could not send your application. Please try again."); }
    finally { setApplyingId(""); }
  }

  const visibleBriefs = tab === "discover" ? briefs.filter((brief) => brief.visibility === "public") : briefs.filter((brief) => brief.visibility === "network" && connectedAgencyIds.includes(brief.agencyId));
  return <div className="mx-auto max-w-2xl"><header className="mb-7 flex items-start justify-between"><div><p className="text-sm font-bold tracking-[0.18em] text-brand-blue">ACTOR HOME</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Your next role is waiting.</h1><p className="mt-2 text-slate-600">Fresh casting opportunities from CASTARZ agencies.</p></div><Link href="/actor/inbox" className="relative flex size-11 items-center justify-center rounded-full bg-white text-brand-navy shadow-sm ring-1 ring-brand-silver/70" aria-label="Notifications"><Bell className="size-5" /></Link></header><div className="mb-6 rounded-2xl bg-brand-navy p-5 text-white"><div className="flex items-center gap-2 text-brand-cyan"><Sparkles className="size-5" /><p className="text-sm font-bold">Keep your profile current</p></div><p className="mt-2 text-sm leading-6 text-slate-200">Agents review your headshot, specs, albums, and availability when you apply.</p></div>{notice && <p className="mb-5 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}
    <Link href="/actor/network" className="mb-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-silver/70">
      <div>
        <p className="text-sm font-bold text-brand-blue">Grow your network</p>
        <p className="mt-1 text-sm text-slate-600">Send a connection request to an agency, LinkedIn-style.</p>
      </div>
      <span className="text-sm font-bold text-brand-navy">Connect →</span>
    </Link>
    <section className="space-y-5"><div className="grid grid-cols-2 rounded-xl bg-white p-1 ring-1 ring-brand-silver/70"><button onClick={() => setTab("discover")} className={`min-h-11 rounded-lg text-sm font-bold ${tab === "discover" ? "bg-brand-navy text-white" : "text-slate-500"}`}>Discover</button><button onClick={() => setTab("network")} className={`min-h-11 rounded-lg text-sm font-bold ${tab === "network" ? "bg-brand-navy text-white" : "text-slate-500"}`}>My agencies</button></div><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{tab === "discover" ? "Open opportunities" : "Agency-only opportunities"}</h2><span className="rounded-full bg-brand-cyan/15 px-3 py-1 text-xs font-bold text-brand-navy">{visibleBriefs.length} live</span></div>{visibleBriefs.map((brief, index) => <BriefCard key={brief.id} brief={brief} accent={["bg-brand-blue", "bg-brand-navy", "bg-cyan-600"][index % 3]} applied={appliedIds.includes(brief.id)} loading={applyingId === brief.id} onApply={() => apply(brief)} />)}{!visibleBriefs.length && <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center"><Sparkles className="mx-auto size-8 text-brand-blue" /><h2 className="mt-4 text-xl font-bold">{tab === "discover" ? "No open briefs right now." : "No agency-only briefs yet."}</h2><p className="mt-2 text-slate-600">{tab === "discover" ? "New open opportunities will appear here." : "Once an agency approves your connection, its private briefs will appear here."}</p></div>}</section></div>;
}

function BriefCard({ brief, accent, applied, loading, onApply }: { brief: AgentBrief; accent: string; applied: boolean; loading: boolean; onApply: () => void }) {
  return <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-brand-silver/70"><div className={`h-1.5 ${accent}`} /><div className="p-5 sm:p-6"><div className="flex gap-3"><div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accent} text-sm font-extrabold text-white`}>{brief.agencyName.slice(0, 2).toUpperCase()}</div><div><Link href={`/actor/agencies/${brief.agencyId}`} className="font-bold text-brand-navy hover:text-brand-blue">{brief.agencyName}</Link><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-3.5" />{brief.location || "Location pending"}</p></div></div><h3 className="mt-5 text-xl font-bold text-brand-navy">{brief.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{brief.description}</p><div className="mt-4 flex flex-wrap gap-2">{brief.requirements.map((tag) => <span key={tag} className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-bold text-brand-navy">{tag}</span>)}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4"><div className="flex gap-4 text-sm font-semibold text-slate-600"><span className="flex items-center gap-1"><WalletCards className="size-4 text-brand-blue" />{brief.rate || "Rate pending"}</span><span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{brief.shootDate || "Date pending"}</span></div><button type="button" onClick={onApply} disabled={applied || loading} className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${applied ? "bg-emerald-50 text-emerald-700" : "bg-brand-blue text-white hover:bg-brand-navy"}`}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : applied ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}{applied ? "Applied" : loading ? "Applying…" : "Apply now"}</button></div></div></article>;
}
