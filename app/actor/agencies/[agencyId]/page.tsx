"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Check, CheckCircle2, Clock3, LoaderCircle, MapPin, Send, UserMinus, WalletCards } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgencyHeroCard, LoadingScreen, ProfileTabs } from "@/components/ProfileChrome";
import { StartChatButton } from "@/components/StartChatButton";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { requestAgencyConnection, withdrawAgencyConnection, type ConnectionStatus } from "@/lib/connections";
import { directoryAgencyFromData, type DirectoryAgency } from "@/lib/directory";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

export default function AgencyPublicPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const { user } = useAuth();
  const [agency, setAgency] = useState<DirectoryAgency | null>(null);
  const [tab, setTab] = useState<"about" | "briefs">("about");
  const [status, setStatus] = useState<ConnectionStatus | "">("");
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [networkBriefs, setNetworkBriefs] = useState<AgentBrief[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [applyingId, setApplyingId] = useState("");
  const [actorName, setActorName] = useState("An actor");
  const [actorPhoto, setActorPhoto] = useState("");
  const [notice, setNotice] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!agencyId) return;
    return onSnapshot(doc(db, "agencies", agencyId), (snapshot) => {
      if (!snapshot.exists()) { setMissing(true); setAgency(null); return; }
      setAgency(directoryAgencyFromData(snapshot.id, snapshot.data()));
    });
  }, [agencyId]);

  useEffect(() => {
    if (!user) return;
    const stopActor = onSnapshot(doc(db, "actors", user.uid), (snapshot) => {
      const data = snapshot.data();
      const name = data?.stageName || data?.fullName;
      if (typeof name === "string" && name.trim()) setActorName(name);
      setActorPhoto(typeof data?.headshot === "string" ? data.headshot : "");
    });
    const stopApps = onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), (snapshot) => {
      setAppliedIds(snapshot.docs.map((item) => item.data().briefId).filter((id): id is string => typeof id === "string"));
    });
    return () => { stopActor(); stopApps(); };
  }, [user]);

  useEffect(() => {
    if (!user || !agencyId) return;
    return onSnapshot(doc(db, "connections", `${agencyId}_${user.uid}`), (snapshot) => {
      setStatus((snapshot.data()?.status as ConnectionStatus) || "");
    });
  }, [user, agencyId]);

  useEffect(() => {
    if (!agencyId) return;
    return onSnapshot(
      query(collection(db, "briefs"), where("agencyId", "==", agencyId), where("status", "==", "published"), where("visibility", "==", "public")),
      (snapshot) => setBriefs(snapshot.docs.map((item) => briefFromDocument(item.id, item.data()))),
    );
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId || status !== "approved") return;
    return onSnapshot(
      query(collection(db, "briefs"), where("agencyId", "==", agencyId), where("status", "==", "published"), where("visibility", "==", "network")),
      (snapshot) => setNetworkBriefs(snapshot.docs.map((item) => briefFromDocument(item.id, item.data()))),
    );
  }, [agencyId, status]);

  const visibleBriefs = useMemo(() => status === "approved" ? [...briefs, ...networkBriefs] : briefs, [briefs, networkBriefs, status]);

  async function connect() {
    if (!user || !agency) return;
    setWorking(true);
    setNotice("");
    try {
      await requestAgencyConnection({ agencyId: agency.id, agencyName: agency.name, actorUid: user.uid, actorName });
      setNotice(`Request sent to ${agency.name}.`);
    } catch {
      setNotice("We could not send that request.");
    } finally {
      setWorking(false);
    }
  }

  async function withdraw() {
    if (!user || !agency) return;
    setWorking(true);
    try {
      await withdrawAgencyConnection(agency.id, user.uid);
      setNotice("Request withdrawn.");
    } finally {
      setWorking(false);
    }
  }

  async function apply(brief: AgentBrief) {
    if (!user || appliedIds.includes(brief.id)) return;
    setApplyingId(brief.id);
    try {
      await setDoc(doc(db, "applications", `${brief.id}_${user.uid}`), { briefId: brief.id, actorUid: user.uid, agencyId: brief.agencyId, status: "pending", createdAt: serverTimestamp() });
      await notifyQuietly({
        recipientUid: brief.agencyId,
        senderUid: user.uid,
        type: "application_received",
        title: "New application",
        body: `An actor applied for ${brief.title}. Open the dossier to review and book.`,
        href: "/agent/applications",
      });
    } finally {
      setApplyingId("");
    }
  }

  if (missing) return <p className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center font-semibold text-slate-600">This agency profile is not available.</p>;
  if (!agency) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AgencyHeroCard
        name={agency.name}
        username={agency.username}
        photo={agency.photo}
        backHref="/actor/network"
        actions={
          status === "approved" && user ? (
            <div className="flex flex-wrap gap-2">
              <StartChatButton
                seed={{
                  agencyId: agency.id,
                  agencyName: agency.name,
                  agencyPhoto: agency.photo,
                  actorUid: user.uid,
                  actorName,
                  actorPhoto,
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/15 hover:bg-brand-blue"
              />
              <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700"><Check className="size-4" />Connected</span>
            </div>
          ) : status === "pending" ? (
            <button type="button" disabled={working} onClick={() => void withdraw()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600">
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <UserMinus className="size-4" />}Withdraw
            </button>
          ) : (
            <button type="button" disabled={working} onClick={() => void connect()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white">
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              {status === "declined" || status === "withdrawn" ? "Request again" : "Connect"}
            </button>
          )
        }
        footer={<ProfileTabs tabs={[{ label: "About", active: tab === "about", onClick: () => setTab("about") }, { label: `Briefs (${visibleBriefs.length})`, active: tab === "briefs", onClick: () => setTab("briefs") }]} />}
      />
      {notice && <p className="flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}
      {tab === "about" && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <h2 className="text-lg font-bold">About {agency.name}</h2>
          <p className="mt-2 leading-7 text-slate-600">{agency.description}</p>
        </section>
      )}
      {tab === "briefs" && (
        <div className="space-y-4">
          {visibleBriefs.map((brief) => {
            const applied = appliedIds.includes(brief.id);
            const loading = applyingId === brief.id;
            return (
              <article key={brief.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-brand-navy">{brief.title}</h3>
                  {brief.visibility === "network" && <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-bold text-brand-cyan">Network</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{brief.description}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
                  <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-blue" />{brief.location || "Location pending"}</span>
                  <span className="flex items-center gap-1"><WalletCards className="size-4 text-brand-blue" />{brief.rate || "Rate pending"}</span>
                  <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{brief.shootDate || "Date pending"}</span>
                </div>
                <button type="button" disabled={applied || loading} onClick={() => void apply(brief)} className={`mt-4 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${applied ? "bg-emerald-50 text-emerald-700" : "bg-brand-blue text-white"}`}>
                  {loading ? <LoaderCircle className="size-4 animate-spin" /> : applied ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
                  {applied ? "Applied" : loading ? "Applying…" : "Apply now"}
                </button>
              </article>
            );
          })}
          {!visibleBriefs.length && <p className="rounded-[28px] border-2 border-dashed border-brand-silver bg-white p-8 text-center text-sm text-slate-600">No live briefs from this agency yet.</p>}
        </div>
      )}
    </div>
  );
}
