"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, LoaderCircle, PlaySquare, X } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ActorReliabilityPanel, type ReliabilityApplication } from "@/components/ActorReliabilityPanel";
import { ActorHeroCard, LoadingScreen, PhotoGrid, ProfileTabs, SpecChips } from "@/components/ProfileChrome";
import { StartChatButton } from "@/components/StartChatButton";
import { useAuth } from "@/context/AuthContext";
import { albumCategories } from "@/lib/actor-profile";
import { type ConnectionStatus } from "@/lib/connections";
import { actorDisplayName, directoryActorFromData, type DirectoryActor } from "@/lib/directory";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

export default function TalentProfilePage() {
  const { actorId } = useParams<{ actorId: string }>();
  const { user } = useAuth();
  const [actor, setActor] = useState<DirectoryActor | null>(null);
  const [tab, setTab] = useState<"about" | "photos">("about");
  const [status, setStatus] = useState<ConnectionStatus | "">("");
  const [working, setWorking] = useState(false);
  const [missing, setMissing] = useState(false);
  const [category, setCategory] = useState<(typeof albumCategories)[number]>("Formal");
  const [agencyName, setAgencyName] = useState("CASTARZ Agency");
  const [agencyPhoto, setAgencyPhoto] = useState("");
  const [actorApplications, setActorApplications] = useState<ReliabilityApplication[]>([]);

  useEffect(() => {
    if (!actorId) return;
    return onSnapshot(doc(db, "actors", actorId), (snapshot) => {
      if (!snapshot.exists()) { setMissing(true); setActor(null); return; }
      setActor(directoryActorFromData(snapshot.id, snapshot.data()));
    });
  }, [actorId]);

  useEffect(() => {
    if (!user || !actorId) return;
    return onSnapshot(doc(db, "connections", `${user.uid}_${actorId}`), (snapshot) => {
      setStatus((snapshot.data()?.status as ConnectionStatus) || "");
    });
  }, [user, actorId]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "agencies", user.uid), (snapshot) => {
      const data = snapshot.data();
      setAgencyName(typeof data?.name === "string" && data.name.trim() ? data.name : "CASTARZ Agency");
      setAgencyPhoto(typeof data?.photo === "string" ? data.photo : "");
    });
  }, [user]);

  useEffect(() => {
    if (!user || !actorId) return;
    return onSnapshot(query(collection(db, "applications"), where("agencyId", "==", user.uid)), (snapshot) => {
      setActorApplications(snapshot.docs
        .map((item) => ({
          actorUid: String(item.data().actorUid ?? ""),
          status: String(item.data().status ?? ""),
          cancelledAtMs: item.data().cancelledAt?.toMillis?.() ?? 0,
        }))
        .filter((application) => application.actorUid === actorId));
    });
  }, [user, actorId]);

  async function decide(next: "approved" | "declined") {
    if (!user || !actorId) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "connections", `${user.uid}_${actorId}`), { status: next, decidedAt: serverTimestamp() });
      await notifyQuietly({
        recipientUid: actorId,
        senderUid: user.uid,
        type: next === "approved" ? "connection_approved" : "connection_declined",
        title: next === "approved" ? "You are connected" : "Connection update",
        body: next === "approved"
          ? "An agency approved your request. Their private briefs can now appear in My agencies."
          : "An agency declined your connection request. You can request again later from Network.",
        href: "/actor/network",
        connectionId: `${user.uid}_${actorId}`,
      });
    } finally {
      setWorking(false);
    }
  }

  if (missing) return <p className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center font-semibold text-slate-600">This actor profile is not available.</p>;
  if (!actor) return <LoadingScreen />;

  const photos = albumCategories.flatMap((item) => actor.albums[item]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ActorHeroCard
        actor={actor}
        backHref="/agent/network"
        actions={
          status === "approved" && user && actorId ? (
            <div className="flex flex-wrap gap-2">
              <StartChatButton
                seed={{
                  agencyId: user.uid,
                  agencyName,
                  agencyPhoto,
                  actorUid: actorId,
                  actorName: actorDisplayName(actor),
                  actorPhoto: actor.headshot,
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/15 hover:bg-brand-blue"
              />
              <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700"><Check className="size-4" />In your network</span>
            </div>
          ) : status === "pending" ? (
            <div className="flex gap-2">
              <button type="button" disabled={working} onClick={() => void decide("declined")} className="flex size-11 items-center justify-center rounded-xl border border-slate-300 text-slate-500"><X className="size-4" /></button>
              <button type="button" disabled={working} onClick={() => void decide("approved")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white">
                {working ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Approve
              </button>
            </div>
          ) : null
        }
        footer={<ProfileTabs tabs={[{ label: "About", active: tab === "about", onClick: () => setTab("about") }, { label: `Photos (${photos.length})`, active: tab === "photos", onClick: () => setTab("photos") }]} />}
      />
      {tab === "about" && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-blue">Actor z-card</p>
              <h2 className="mt-1 text-xl font-bold text-brand-navy">About</h2>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-navy">{actor.representationStatus}</span>
          </div>
          <p className="mt-4 leading-7 text-slate-600">{actor.bio || "This actor has not added a bio yet."}</p>
          <div className="mt-5"><SpecChips actor={actor} /></div>
          {actor.availabilityNote && <p className="mt-4 rounded-2xl bg-brand-ice/70 p-4 text-sm font-semibold text-slate-600">{actor.availabilityNote}</p>}
          <div className="mt-5">
            <ActorReliabilityPanel applications={actorApplications} />
          </div>
          <div className="mt-7 border-t border-brand-silver/70 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy">Screen and stage credits</h3>
                <p className="mt-1 text-sm text-slate-500">Shows, commercials, theatre, film, and featured work.</p>
              </div>
              <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-cyan">{actor.credits.length} credits</span>
            </div>
            {actor.credits.length ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-brand-silver/70">
                {actor.credits.map((credit, index) => (
                  <div key={`${credit.production}-${credit.year}-${index}`} className="grid gap-4 border-b border-slate-100 bg-white p-4 last:border-b-0 md:grid-cols-[140px_1fr]">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-brand-ice">
                      {credit.mediaType === "image" && credit.mediaUrl ? (
                        <Image src={credit.mediaUrl} alt={`${credit.production || "Credit"} media`} fill unoptimized className="object-cover" />
                      ) : credit.mediaType === "video" && credit.mediaUrl ? (
                        <video src={credit.mediaUrl} controls playsInline className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-brand-blue"><PlaySquare className="size-6" /></div>
                      )}
                    </div>
                    <div className="grid gap-1 sm:grid-cols-[1fr_90px_1fr] sm:items-center">
                      <p className="font-bold text-brand-navy">{credit.production || "Untitled production"}</p>
                      <p className="text-sm font-semibold text-slate-500">{credit.year || "Year"}</p>
                      <p className="text-sm font-semibold text-slate-700">{credit.role || "Role not specified"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-brand-silver bg-brand-ice/40 p-5 text-sm font-semibold text-slate-500">No credits listed yet.</p>
            )}
          </div>
        </section>
      )}
      {tab === "photos" && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {albumCategories.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${category === item ? "bg-brand-navy text-white" : "bg-brand-ice text-slate-600"}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <PhotoGrid photos={actor.albums[category]} emptyLabel={`No ${category.toLowerCase()} photos yet.`} />
          </div>
        </section>
      )}
    </div>
  );
}
