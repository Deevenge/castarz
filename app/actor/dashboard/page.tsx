"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { Bell, BriefcaseBusiness, Building2, CheckCircle2, Clock3, Grid3X3, LoaderCircle, MapPin, Maximize2, Send, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/ProfileChrome";
import { SocialPostComposer } from "@/components/SocialPostComposer";
import { SocialPostGrid } from "@/components/SocialPostGrid";
import { useAuth } from "@/context/AuthContext";
import { briefCallTimeLabel, briefDateLabel, briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { normalizeActorProfile } from "@/lib/actor-profile";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";
import { socialPostFromDocument, sortPostsNewestFirst, type SocialPost } from "@/lib/social-posts";

type HomeTab = "all" | "network" | "spotlight";

export default function ActorDashboardPage() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [tab, setTab] = useState<HomeTab>("all");
  const [connectedAgencyIds, setConnectedAgencyIds] = useState<string[]>([]);
  const connectedKey = connectedAgencyIds.join("|");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [agencyPosts, setAgencyPosts] = useState<SocialPost[]>([]);
  const [actorName, setActorName] = useState("");
  const [actorPhoto, setActorPhoto] = useState("");
  const [applyingId, setApplyingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "actors", user.uid), (snapshot) => {
      const actor = normalizeActorProfile(snapshot.data());
      setActorName(actor.stageName || actor.fullName);
      setActorPhoto(actor.headshot);
    });
  }, [user]);

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
    if (!connectedAgencyIds.length) return;
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
  }, [connectedKey, connectedAgencyIds]);

  useEffect(() => onSnapshot(query(collection(db, "posts"), where("authorRole", "==", "agent"), where("visibility", "==", "public")), (snapshot) => {
    setAgencyPosts(sortPostsNewestFirst(snapshot.docs.map((item) => socialPostFromDocument(item.id, item.data()))));
  }, () => setNotice("We could not load agency spotlight posts. Publish the latest Firestore rules if this continues.")), []);

  async function apply(brief: AgentBrief) {
    if (!user || appliedIds.includes(brief.id)) return;
    setApplyingId(brief.id);
    setNotice("");
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
        applicationId: applicationRef.id,
        briefId: brief.id,
      });
      setNotice("Application sent. Your agent will review your profile and availability.");
    } catch {
      setNotice("We could not send your application. Please try again.");
    } finally {
      setApplyingId("");
    }
  }

  const sortedBriefs = useMemo(() => [...briefs].sort((left, right) => (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0)), [briefs]);
  const visibleBriefs = tab === "all" ? sortedBriefs.filter((brief) => brief.visibility === "public") : sortedBriefs.filter((brief) => brief.visibility === "network" && connectedAgencyIds.includes(brief.agencyId));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">ACTOR HOME</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Briefs, buzz, and your next moment.</h1>
        </div>
        <Link href="/actor/inbox" className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-navy shadow-sm ring-1 ring-brand-silver/70" aria-label="Notifications"><Bell className="size-5" /></Link>
      </header>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.25fr]">
        <div className="space-y-5">
          <SocialPostComposer userUid={user?.uid ?? ""} role="actor" profile={{ name: actorName || "CASTARZ Actor", photo: actorPhoto }} />
          <Link href="/actor/network" className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-silver/70">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><UsersRound className="size-5" /></div>
              <div className="min-w-0">
                <p className="font-bold text-brand-navy">Build your agency network</p>
                <p className="mt-1 text-sm text-slate-600">Connect with agencies for private briefs.</p>
              </div>
            </div>
            <span className="text-sm font-bold text-brand-blue">Open</span>
          </Link>
        </div>

        <section className="min-w-0">
          {notice && <p className="mb-5 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-sm ring-1 ring-brand-silver/70"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}

          <div className="mb-6 grid grid-cols-3 rounded-xl bg-white p-1 ring-1 ring-brand-silver/70">
            <TabButton active={tab === "all"} icon={BriefcaseBusiness} label="All briefs" onClick={() => setTab("all")} />
            <TabButton active={tab === "network"} icon={Building2} label="Network briefs" onClick={() => setTab("network")} />
            <TabButton active={tab === "spotlight"} icon={Grid3X3} label="Spotlight" onClick={() => setTab("spotlight")} />
          </div>

          {tab === "spotlight" ? (
            <SocialPostGrid posts={agencyPosts} currentUserUid={user?.uid ?? ""} currentUserName={actorName || "CASTARZ Actor"} allowManage emptyTitle="No agency posts yet" emptyCopy="When agencies share cast wins, TV moments, behind-the-scenes work, or video links, they will appear here." />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{tab === "all" ? "Open casting briefs" : "Your network briefs"}</h2>
                <span className="rounded-full bg-brand-cyan/15 px-3 py-1 text-xs font-bold text-brand-navy">{visibleBriefs.length} live</span>
              </div>
              {visibleBriefs.map((brief, index) => <BriefCard key={brief.id} brief={brief} accent={["bg-brand-blue", "bg-brand-navy", "bg-cyan-600"][index % 3]} applied={appliedIds.includes(brief.id)} loading={applyingId === brief.id} onApply={() => apply(brief)} />)}
              {!visibleBriefs.length && (
                <div className="rounded-2xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
                  <Sparkles className="mx-auto size-8 text-brand-blue" />
                  <h2 className="mt-4 text-xl font-bold">{tab === "all" ? "No open briefs right now." : "No network briefs yet."}</h2>
                  <p className="mt-2 text-slate-600">{tab === "all" ? "New open opportunities will appear here." : "When connected agencies publish private briefs, they will appear here."}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof BriefcaseBusiness; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold sm:text-sm ${active ? "bg-brand-navy text-white" : "text-slate-500"}`}>
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function BriefCard({ brief, accent, applied, loading, onApply }: { brief: AgentBrief; accent: string; applied: boolean; loading: boolean; onApply: () => void }) {
  const ageTags = brief.ageRange ? [brief.ageRange] : brief.requirements;
  const [fetchedAgencyPhoto, setFetchedAgencyPhoto] = useState("");
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const agencyPhoto = brief.agencyPhoto || fetchedAgencyPhoto;

  useEffect(() => {
    if (brief.agencyPhoto || !brief.agencyId) return;
    let active = true;
    void getDoc(doc(db, "agencies", brief.agencyId)).then((snapshot) => {
      const photo = snapshot.data()?.photo;
      if (active && typeof photo === "string") setFetchedAgencyPhoto(photo);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [brief.agencyId, brief.agencyPhoto]);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-silver/70">
      <div className={`h-1.5 ${accent}`} />
      <div className="p-5 sm:p-6">
        <div className="flex gap-3">
          <Link href={`/actor/agencies/${brief.agencyId}`} className={`relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${accent} text-sm font-extrabold text-white`}>
            {agencyPhoto ? <Image src={agencyPhoto} alt={`${brief.agencyName} profile photo`} fill unoptimized className="object-cover" /> : brief.agencyName.slice(0, 2).toUpperCase()}
          </Link>
          <div>
            <Link href={`/actor/agencies/${brief.agencyId}`} className="font-bold text-brand-navy hover:text-brand-blue">{brief.agencyName}</Link>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-3.5" />{brief.location || "Location pending"}</p>
          </div>
        </div>
        <h3 className="mt-5 text-xl font-bold text-brand-navy">{brief.title}</h3>
        {brief.description && <p className="mt-2 text-sm leading-6 text-slate-600">{brief.description}</p>}
        {brief.talentNeeded > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy">
            <UsersRound className="size-4 text-brand-blue" />
            <span>{brief.talentNeeded} {brief.talentNeeded === 1 ? "role" : "roles"} requested</span>
            <span className="text-slate-500">Applications stay open until the agency closes the brief.</span>
          </div>
        )}
        {!!ageTags.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ageTags.map((tag) => <span key={tag} className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-bold text-brand-navy">{tag}</span>)}
          </div>
        )}
        {(brief.wardrobe || brief.wardrobeImage) && (
          <div className="mt-4 grid gap-3 rounded-2xl bg-brand-ice/60 p-3 sm:grid-cols-[1fr_130px]">
            {brief.wardrobe && (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue">Wardrobe</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{brief.wardrobe}</p>
              </div>
            )}
            {brief.wardrobeImage && (
              <button type="button" onClick={() => setWardrobeOpen(true)} className="group relative aspect-video overflow-hidden rounded-xl bg-white text-left" aria-label="Open wardrobe reference">
                <Image src={brief.wardrobeImage} alt="Wardrobe reference" fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
                <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/35">
                  <Maximize2 className="size-6 opacity-0 transition group-hover:opacity-100" />
                </span>
              </button>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex gap-4 text-sm font-semibold text-slate-600">
            <span className="flex items-center gap-1"><WalletCards className="size-4 text-brand-blue" />{brief.rate || "Rate pending"}</span>
            <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{briefDateLabel(brief)} · {briefCallTimeLabel(brief)}</span>
          </div>
          <button type="button" onClick={onApply} disabled={applied || loading} className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${applied ? "bg-emerald-50 text-emerald-700" : "bg-brand-blue text-white hover:bg-brand-navy"}`}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : applied ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
            {applied ? "Applied" : loading ? "Applying..." : "Apply now"}
          </button>
        </div>
      </div>
      {brief.wardrobeImage && wardrobeOpen && <PhotoLightbox photo={brief.wardrobeImage} label="Wardrobe reference" close={() => setWardrobeOpen(false)} />}
    </article>
  );
}
