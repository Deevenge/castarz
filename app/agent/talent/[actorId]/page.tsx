"use client";

import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Check, LoaderCircle, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
          <h2 className="text-lg font-bold">About</h2>
          <p className="mt-2 leading-7 text-slate-600">{actor.bio || "This actor has not added a bio yet."}</p>
          <div className="mt-4"><SpecChips actor={actor} /></div>
          {actor.availabilityNote && <p className="mt-4 text-sm text-slate-500">{actor.availabilityNote}</p>}
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
