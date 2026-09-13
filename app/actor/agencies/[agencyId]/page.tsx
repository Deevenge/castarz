"use client";

import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { Check, CheckCircle2, Clock3, LoaderCircle, MapPin, Maximize2, Send, UserMinus, UsersRound, WalletCards } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgencyHeroCard, LoadingScreen, PhotoLightbox, ProfileTabs } from "@/components/ProfileChrome";
import { StartChatButton } from "@/components/StartChatButton";
import { useAuth } from "@/context/AuthContext";
import { briefCallTimeLabel, briefDateLabel, briefFromDocument, type AgentBrief } from "@/lib/agent-data";
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
    setNotice("");
    try {
      const applicationRef = doc(db, "applications", `${brief.id}_${user.uid}`);
      let createdApplication = false;
      await runTransaction(db, async (transaction) => {
        const briefRef = doc(db, "briefs", brief.id);
        const [freshBrief, existingApplication] = await Promise.all([
          transaction.get(briefRef),
          transaction.get(applicationRef),
        ]);
        if (!freshBrief.exists()) throw new Error("missing-brief");
        if (existingApplication.exists()) return;
        const data = freshBrief.data();
        const talentNeeded = typeof data.talentNeeded === "number" ? data.talentNeeded : 0;
        if (typeof data.applicationCount !== "number") throw new Error("brief-count-missing");
        const applicationCount = data.applicationCount;
        if (talentNeeded > 0 && applicationCount >= talentNeeded) throw new Error("brief-full");
        transaction.set(applicationRef, { briefId: brief.id, actorUid: user.uid, agencyId: brief.agencyId, status: "pending", createdAt: serverTimestamp() });
        transaction.update(briefRef, { applicationCount: applicationCount + 1, updatedAt: serverTimestamp() });
        createdApplication = true;
      });
      if (!createdApplication) {
        setNotice("You have already applied for this brief.");
        return;
      }
      await notifyQuietly({
        recipientUid: brief.agencyId,
        senderUid: user.uid,
        type: "application_received",
        title: "New application",
        body: `An actor applied for ${brief.title}. Open the dossier to review and book.`,
        href: "/agent/applications",
      });
      setNotice("Application sent. Your agent will review your profile and availability.");
    } catch (error) {
      setNotice(error instanceof Error && error.message === "brief-full"
        ? "This brief is full. The agency may close it soon."
        : error instanceof Error && error.message === "brief-count-missing"
          ? "This brief is syncing its availability. Please try again shortly."
          : "We could not send your application. Please try again.");
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
        banner={agency.banner}
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-blue">Agency z-card</p>
              <h2 className="mt-1 text-xl font-bold">About {agency.name}</h2>
            </div>
            {agency.markets && <span className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-navy">{agency.markets}</span>}
          </div>
          <p className="mt-4 leading-7 text-slate-600">{agency.description}</p>
          {(agency.specialties || agency.markets) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {agency.specialties && <InfoTile label="Specialties" value={agency.specialties} />}
              {agency.markets && <InfoTile label="Markets" value={agency.markets} />}
            </div>
          )}
          <div className="mt-7 border-t border-brand-silver/70 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy">Productions and supplied talent</h3>
                <p className="mt-1 text-sm text-slate-500">Shows, campaigns, events, and casting support this agency has worked on.</p>
              </div>
              <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-cyan">{agency.portfolio.length} projects</span>
            </div>
            {agency.portfolio.length ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-brand-silver/70">
                {agency.portfolio.map((credit, index) => (
                  <div key={`${credit.production}-${credit.year}-${index}`} className="border-b border-slate-100 bg-white p-4 last:border-b-0">
                    <div className="grid gap-2 sm:grid-cols-[1fr_90px_1fr_120px]">
                      <p className="font-bold text-brand-navy">{credit.production || "Production"}</p>
                      <p className="text-sm font-semibold text-slate-500">{credit.year || "Year"}</p>
                      <p className="text-sm font-semibold text-slate-700">{credit.supplied || "Talent supplied"}</p>
                      <p className="text-sm font-bold text-brand-blue">{credit.talentCount || "Scale private"}</p>
                    </div>
                    {credit.note && <p className="mt-3 rounded-xl bg-brand-ice/70 p-3 text-sm leading-6 text-slate-600">{credit.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-brand-silver bg-brand-ice/40 p-5 text-sm font-semibold text-slate-500">This agency has not added production credits yet.</p>
            )}
          </div>
        </section>
      )}
      {tab === "briefs" && (
        <div className="space-y-4">
          {visibleBriefs.map((brief) => {
            const applied = appliedIds.includes(brief.id);
            const loading = applyingId === brief.id;
            const remaining = brief.talentNeeded ? Math.max(brief.talentNeeded - brief.applicationCount, 0) : 0;
            const full = Boolean(brief.talentNeeded && remaining === 0);
            return (
              <AgencyBriefCard
                key={brief.id}
                brief={brief}
                agency={agency}
                applied={applied}
                loading={loading}
                full={full}
                remaining={remaining}
                onApply={() => void apply(brief)}
              />
            );
          })}
          {!visibleBriefs.length && <p className="rounded-[28px] border-2 border-dashed border-brand-silver bg-white p-8 text-center text-sm text-slate-600">No live briefs from this agency yet.</p>}
        </div>
      )}
    </div>
  );
}

function AgencyBriefCard({ brief, agency, applied, loading, full, remaining, onApply }: { brief: AgentBrief; agency: DirectoryAgency; applied: boolean; loading: boolean; full: boolean; remaining: number; onApply: () => void }) {
  const [wardrobeOpen, setWardrobeOpen] = useState(false);

  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70">
      <div className="flex gap-3">
        <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-sm font-extrabold text-brand-cyan">
          {agency.photo ? <Image src={agency.photo} alt={`${agency.name} profile photo`} fill unoptimized className="object-cover" /> : agency.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-brand-navy">{brief.title}</h3>
            {brief.visibility === "network" && <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-bold text-brand-cyan">Network</span>}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{agency.name}</p>
        </div>
      </div>
      {brief.description && <p className="mt-4 text-sm leading-6 text-slate-600">{brief.description}</p>}
      {brief.talentNeeded > 0 && (
        <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${full ? "bg-slate-100 text-slate-600" : "bg-brand-ice text-brand-navy"}`}>
          <UsersRound className="size-4 text-brand-blue" />
          <span>{full ? "Full" : `${remaining} ${remaining === 1 ? "spot" : "spots"} remaining`}</span>
          <span className="text-slate-500">of {brief.talentNeeded} actors needed</span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-blue" />{brief.location || "Location pending"}</span>
        <span className="flex items-center gap-1"><WalletCards className="size-4 text-brand-blue" />{brief.rate || "Rate pending"}</span>
        <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{briefDateLabel(brief)} · {briefCallTimeLabel(brief)}</span>
      </div>
      {(brief.ageRange || brief.wardrobe || brief.wardrobeImage) && (
        <div className="mt-4 grid gap-3 rounded-2xl bg-brand-ice/60 p-4 md:grid-cols-[1fr_150px]">
          <div className="space-y-3">
            {brief.ageRange && <InfoTile label="Age range" value={brief.ageRange} />}
            {brief.wardrobe && <InfoTile label="Wardrobe" value={brief.wardrobe} />}
          </div>
          {brief.wardrobeImage && (
            <button type="button" onClick={() => setWardrobeOpen(true)} className="group relative aspect-video overflow-hidden rounded-2xl bg-white text-left" aria-label="Open wardrobe reference">
              <Image src={brief.wardrobeImage} alt="Wardrobe reference" fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/35">
                <Maximize2 className="size-6 opacity-0 transition group-hover:opacity-100" />
              </span>
            </button>
          )}
        </div>
      )}
      <button type="button" disabled={applied || loading || full} onClick={onApply} className={`mt-4 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${applied ? "bg-emerald-50 text-emerald-700" : full ? "bg-slate-100 text-slate-500" : "bg-brand-blue text-white"}`}>
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : applied ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
        {applied ? "Applied" : full ? "Full" : loading ? "Applying..." : "Apply now"}
      </button>
      {brief.wardrobeImage && wardrobeOpen && <PhotoLightbox photo={brief.wardrobeImage} label="Wardrobe reference" close={() => setWardrobeOpen(false)} />}
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-brand-ice/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-brand-navy">{value}</p>
    </div>
  );
}
