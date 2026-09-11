"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Download, LoaderCircle, Maximize2, UserRound, X, XCircle, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookingConfirmDialog } from "@/components/BookingConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";
import { albumCategories, type AlbumCategory } from "@/lib/actor-profile";

type Status = "pending" | "standby" | "booked" | "rejected";
type Application = { id: string; briefId: string; actorUid: string; status: Status };
type Actor = { fullName: string; stageName: string; bio: string; headshot: string; heightCm: string; hairColor: string; eyeColor: string; ageRange: string; availabilityStatus: string; albums: Record<AlbumCategory, string[]> };

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [actors, setActors] = useState<Record<string, Actor>>({});
  const [active, setActive] = useState<Application | null>(null);
  const [working, setWorking] = useState("");
  const [bookingApp, setBookingApp] = useState<Application | null>(null);
  const [agencyName, setAgencyName] = useState("Your agency");

  useEffect(() => {
    if (!user) return;
    const appStop = onSnapshot(query(collection(db, "applications"), where("agencyId", "==", user.uid)), async (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, briefId: item.data().briefId as string, actorUid: item.data().actorUid as string, status: item.data().status as Status }));
      setApps(next);
      setActors(Object.fromEntries(await Promise.all(next.map(async (app) => [app.actorUid, await loadActor(app.actorUid)] as const))));
    });
    const briefStop = onSnapshot(query(collection(db, "briefs"), where("agencyId", "==", user.uid)), (snapshot) => setBriefs(snapshot.docs.map((item) => briefFromDocument(item.id, item.data()))));
    const agencyStop = onSnapshot(doc(db, "agencies", user.uid), (snapshot) => {
      const name = snapshot.data()?.name;
      if (typeof name === "string" && name.trim()) setAgencyName(name);
    });
    return () => { appStop(); briefStop(); agencyStop(); };
  }, [user]);

  const groups = useMemo(() => briefs.map((brief) => ({ brief, entries: apps.filter((app) => app.briefId === brief.id) })).filter((group) => group.entries.length), [apps, briefs]);
  const bookingBrief = bookingApp ? briefs.find((brief) => brief.id === bookingApp.briefId) : undefined;
  const bookingActor = bookingApp ? actors[bookingApp.actorUid] : undefined;

  async function persistDecision(application: Application, status: Status) {
    if (!user) return;
    const brief = briefs.find((item) => item.id === application.briefId);
    const actor = actors[application.actorUid];
    const actorName = actor?.stageName || actor?.fullName || "Actor";
    setWorking(application.id);
    try {
      await updateDoc(doc(db, "applications", application.id), { status, decidedAt: serverTimestamp() });
      if (status === "booked") {
        await setDoc(doc(db, "bookings", application.id), {
          applicationId: application.id,
          briefId: application.briefId,
          actorUid: application.actorUid,
          agencyId: user.uid,
          agencyName,
          actorName,
          briefTitle: brief?.title ?? "Casting brief",
          location: brief?.location ?? "",
          shootDate: brief?.shootDate ?? "",
          rate: brief?.rate ?? "",
          status: "confirmed",
          confirmedAt: serverTimestamp(),
        });
      }
      const messages = {
        standby: { type: "application_standby" as const, title: "You are on stand-by", body: `${agencyName} placed you on stand-by for ${brief?.title ?? "a brief"}. Stay available.` },
        booked: { type: "booking_confirmed" as const, title: "Booking confirmed", body: `${agencyName} confirmed your booking for ${brief?.title ?? "a brief"}. Check date, location, and rate on your applications.` },
        rejected: { type: "application_rejected" as const, title: "Application update", body: `${agencyName} completed selections for ${brief?.title ?? "a brief"}. Keep your profile ready for the next one.` },
        pending: null,
      };
      const message = messages[status];
      if (message) {
        await notifyQuietly({
          recipientUid: application.actorUid,
          senderUid: user.uid,
          type: message.type,
          title: message.title,
          body: message.body,
          href: "/actor/briefs",
        });
      }
      setActive((current) => current?.id === application.id ? { ...current, status } : current);
      setBookingApp(null);
    } finally {
      setWorking("");
    }
  }

  function requestDecision(application: Application, status: Status) {
    if (status === "booked" && application.status !== "booked") {
      setBookingApp(application);
      return;
    }
    void persistDecision(application, status);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">APPLICATIONS</p>
        <h1 className="mt-1 text-3xl font-bold">Make the casting call.</h1>
        <p className="mt-2 text-slate-600">Open a complete actor dossier, view every portfolio image, then confirm the booking.</p>
      </header>
      <section className="mt-7 space-y-6">
        {groups.map(({ brief, entries }) => (
          <article key={brief.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-7">
            <p className="text-sm font-bold text-brand-blue">{entries.length} application{entries.length === 1 ? "" : "s"}</p>
            <h2 className="mt-1 text-xl font-bold">{brief.title}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {entries.map((application) => <ActorCard key={application.id} application={application} actor={actors[application.actorUid]} open={() => setActive(application)} />)}
            </div>
          </article>
        ))}
        {!groups.length && (
          <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
            <ClipboardCheck className="mx-auto size-9 text-brand-blue" />
            <h2 className="mt-4 text-xl font-bold">No applications yet</h2>
            <p className="mt-2 text-slate-600">Actor applications will arrive here as soon as they apply.</p>
          </div>
        )}
      </section>
      {active && <ActorDossier application={active} actor={actors[active.actorUid]} close={() => setActive(null)} working={working === active.id} decide={requestDecision} />}
      {bookingApp && (
        <BookingConfirmDialog
          actorName={bookingActor?.stageName || bookingActor?.fullName || "This actor"}
          headshot={bookingActor?.headshot}
          briefTitle={bookingBrief?.title || "Casting brief"}
          location={bookingBrief?.location || ""}
          shootDate={bookingBrief?.shootDate || ""}
          rate={bookingBrief?.rate || ""}
          working={working === bookingApp.id}
          onClose={() => setBookingApp(null)}
          onConfirm={() => void persistDecision(bookingApp, "booked")}
        />
      )}
    </div>
  );
}

function ActorCard({ application, actor, open }: { application: Application; actor?: Actor; open: () => void }) {
  return (
    <button type="button" onClick={open} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-blue hover:bg-brand-ice">
      <Avatar actor={actor} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Loading actor…"}</span>
        <span className="mt-1 block text-sm text-slate-500">Open profile & portfolio</span>
      </span>
      <StatusBadge status={application.status} />
    </button>
  );
}

function ActorDossier({ application, actor, close, working, decide }: { application: Application; actor?: Actor; close: () => void; working: boolean; decide: (app: Application, status: Status) => void }) {
  const photos = albumCategories.flatMap((category) => (actor?.albums?.[category] ?? []).map((source) => ({ category, source })));
  const [viewer, setViewer] = useState<number | null>(null);
  const activePhoto = viewer === null ? null : photos[viewer];
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-brand-navy/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-8">
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-brand-blue">ACTOR DOSSIER</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Actor profile"}</h2>
            <div className="mt-3"><StatusBadge status={application.status} /></div>
          </div>
          <button onClick={close} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close profile"><X className="size-5" /></button>
        </header>
        <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl bg-brand-ice">
            {actor?.headshot ? <Image src={actor.headshot} alt="Actor headshot" width={360} height={480} unoptimized className="size-full object-cover" /> : <UserRound className="size-12 text-brand-blue" />}
          </div>
          <div>
            <p className="leading-7 text-slate-600">{actor?.bio || "No bio added yet."}</p>
            <div className="mt-5 flex flex-wrap gap-2">{[actor?.ageRange, actor?.heightCm && `${actor.heightCm} cm`, actor?.hairColor, actor?.eyeColor, actor?.availabilityStatus].filter(Boolean).map((item) => <span key={item} className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{item}</span>)}</div>
          </div>
        </div>
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Portfolio</h3>
              <p className="mt-1 text-sm text-slate-600">Click any photo to view it full-screen, browse, zoom, or download.</p>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{photos.length} photos</span>
          </div>
          <div className="mt-5 space-y-7">
            {albumCategories.map((category) => {
              const images = actor?.albums?.[category] ?? [];
              return images.length ? (
                <div key={category}>
                  <h4 className="mb-3 text-sm font-bold tracking-[0.12em] text-brand-blue">{category.toUpperCase()} · {images.length}</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((source) => {
                      const globalIndex = photos.findIndex((photo) => photo.source === source);
                      return (
                        <button type="button" key={source} onClick={() => setViewer(globalIndex)} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-brand-ice">
                          <Image src={source} alt={`${category} portfolio photo`} width={320} height={427} unoptimized className="size-full object-cover transition duration-300 group-hover:scale-105" />
                          <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/40"><ZoomIn className="size-7 opacity-0 transition group-hover:opacity-100" /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })}
            {!photos.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No portfolio photos uploaded yet.</p>}
          </div>
        </section>
        <DecisionBar current={application.status} working={working} decide={(status) => decide(application, status)} />
      </section>
      {activePhoto && <PhotoViewer photo={activePhoto} index={viewer ?? 0} total={photos.length} close={() => setViewer(null)} previous={() => setViewer((current) => current === null ? null : (current - 1 + photos.length) % photos.length)} next={() => setViewer((current) => current === null ? null : (current + 1) % photos.length)} />}
    </div>
  );
}

function DecisionBar({ current, working, decide }: { current: Status; working: boolean; decide: (status: Status) => void }) {
  const actions: Array<{ status: Status; label: string; icon: typeof Clock3; active: string; idle: string }> = [
    { status: "standby", label: "Stand by", icon: Clock3, active: "bg-amber-500 text-white ring-4 ring-amber-100", idle: "bg-amber-100 text-amber-800" },
    { status: "booked", label: current === "booked" ? "Booking confirmed" : "Book actor", icon: CheckCircle2, active: "bg-emerald-600 text-white ring-4 ring-emerald-100", idle: "bg-emerald-600 text-white" },
    { status: "rejected", label: "Reject", icon: XCircle, active: "bg-red-600 text-white ring-4 ring-red-100", idle: "bg-red-50 text-red-700" },
  ];
  return (
    <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
      {actions.map(({ status, label, icon: Icon, active, idle }) => (
        <button key={status} disabled={working || (status === "booked" && current === "booked")} onClick={() => decide(status)} className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-300 disabled:opacity-50 ${current === status ? active : idle}`}>
          {working ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
          {current === status && status !== "booked" ? `${label} selected` : label}
        </button>
      ))}
    </div>
  );
}

function PhotoViewer({ photo, index, total, close, previous, next }: { photo: { category: AlbumCategory; source: string }; index: number; total: number; close: () => void; previous: () => void; next: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
      <div className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white">{photo.category} · {index + 1} / {total}</div>
      <button onClick={close} className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close photo"><X className="size-6" /></button>
      <a href={photo.source} download={`${photo.category.toLowerCase()}-portfolio-photo.jpg`} className="absolute right-20 top-5 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Download photo"><Download className="size-5" /></a>
      <button onClick={previous} className="absolute left-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-8" aria-label="Previous photo"><ChevronLeft className="size-7" /></button>
      <div className="relative max-h-[82dvh] max-w-[82vw] overflow-auto rounded-xl">
        <Image src={photo.source} alt={`${photo.category} actor portfolio`} width={1200} height={1600} unoptimized className="h-auto max-h-[82dvh] w-auto max-w-full cursor-zoom-in rounded-xl object-contain transition-transform hover:scale-125" />
        <Maximize2 className="absolute bottom-3 right-3 size-5 text-white drop-shadow" />
      </div>
      <button onClick={next} className="absolute right-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-8" aria-label="Next photo"><ChevronRight className="size-7" /></button>
    </div>
  );
}

function Avatar({ actor }: { actor?: Actor }) {
  return <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">{actor?.headshot ? <Image src={actor.headshot} alt="" width={48} height={48} unoptimized className="size-full object-cover" /> : <UserRound className="size-5" />}</div>;
}

function StatusBadge({ status }: { status: Status }) {
  const tone = status === "booked" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "standby" ? "bg-amber-50 text-amber-700" : "bg-brand-ice text-brand-navy";
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{status === "pending" ? "Under review" : status === "booked" ? "Booked" : status}</span>;
}

async function loadActor(uid: string): Promise<Actor> {
  const snapshot = await getDoc(doc(db, "actors", uid));
  const data = snapshot.data();
  return {
    fullName: typeof data?.fullName === "string" ? data.fullName : "Unnamed actor",
    stageName: typeof data?.stageName === "string" ? data.stageName : "",
    bio: typeof data?.bio === "string" ? data.bio : "",
    headshot: typeof data?.headshot === "string" ? data.headshot : "",
    heightCm: typeof data?.heightCm === "string" ? data.heightCm : "",
    hairColor: typeof data?.hairColor === "string" ? data.hairColor : "",
    eyeColor: typeof data?.eyeColor === "string" ? data.eyeColor : "",
    ageRange: typeof data?.ageRange === "string" ? data.ageRange : "",
    availabilityStatus: typeof data?.availabilityStatus === "string" ? data.availabilityStatus : "",
    albums: {
      Formal: Array.isArray(data?.albums?.Formal) ? data.albums.Formal : [],
      Casual: Array.isArray(data?.albums?.Casual) ? data.albums.Casual : [],
      Commercial: Array.isArray(data?.albums?.Commercial) ? data.albums.Commercial : [],
      Fitness: Array.isArray(data?.albums?.Fitness) ? data.albums.Fitness : [],
    },
  };
}
