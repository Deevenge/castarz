"use client";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { BriefcaseBusiness, CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";

type Application = { id: string; briefId: string; agencyId: string; status: "pending" | "standby" | "booked" | "rejected" };

export default function MyApplicationsPage() {
  const { user } = useAuth(); const [applications, setApplications] = useState<Application[]>([]); const [briefs, setBriefs] = useState<Record<string, AgentBrief>>({});
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), async (snapshot) => {
      const apps = snapshot.docs.map((item) => ({ id: item.id, briefId: item.data().briefId as string, agencyId: item.data().agencyId as string, status: item.data().status as Application["status"] }));
      setApplications(apps);
      const pairs = await Promise.all(apps.map(async (application) => {
        const brief = await getDoc(doc(db, "briefs", application.briefId));
        return [application.briefId, brief.exists() ? briefFromDocument(brief.id, brief.data()) : undefined] as const;
      }));
      setBriefs(Object.fromEntries(pairs.filter((pair): pair is [string, AgentBrief] => Boolean(pair[1]))));
    });
  }, [user]);
  return <div className="mx-auto max-w-3xl"><header><p className="text-sm font-bold tracking-[0.18em] text-brand-blue">MY APPLICATIONS</p><h1 className="mt-1 text-3xl font-bold">Your casting journey.</h1><p className="mt-2 text-slate-600">Follow every application from submission to the final agency decision.</p></header><section className="mt-7 space-y-4">{applications.map((application) => { const brief = briefs[application.briefId]; return <article key={application.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-brand-blue">{brief?.agencyName || "Casting agency"}</p><h2 className="mt-1 text-xl font-bold text-brand-navy">{brief?.title || "Loading brief…"}</h2><p className="mt-2 text-sm text-slate-600">{statusCopy(application.status)}</p></div><Status status={application.status} /></div></article>; })}{!applications.length && <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center"><BriefcaseBusiness className="mx-auto size-9 text-brand-blue" /><h2 className="mt-4 text-xl font-bold">No applications yet</h2><p className="mt-2 text-slate-600">Explore open opportunities on Home and apply when a role fits.</p></div>}</section></div>;
}
function Status({ status }: { status: Application["status"] }) { const style = status === "booked" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "standby" ? "bg-amber-50 text-amber-700" : "bg-brand-ice text-brand-navy"; const Icon = status === "booked" ? CheckCircle2 : status === "rejected" ? XCircle : Clock3; return <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${style}`}><Icon className="size-4" />{status === "pending" ? "Under review" : status === "standby" ? "Stand by" : status === "booked" ? "Booked" : "Not selected"}</span>; }
function statusCopy(status: Application["status"]) { return status === "booked" ? "Congratulations — your agency has booked you for this brief." : status === "rejected" ? "The agency has completed this selection. Keep your profile current for the next opportunity." : status === "standby" ? "You remain in consideration. Your agency may update you soon." : "Your application has been received and is waiting for agency review."; }
