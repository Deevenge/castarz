"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Download, ExternalLink, LayoutGrid, LoaderCircle, Maximize2, Search, UserRound, X, XCircle, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookingConfirmDialog } from "@/components/BookingConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";
import { albumCategories, normalizeActorProfile, type AlbumCategory } from "@/lib/actor-profile";

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
  const [selectedBriefId, setSelectedBriefId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

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
  const activeBrief = selectedBriefId === "all" ? null : briefs.find((brief) => brief.id === selectedBriefId);
  const filteredApps = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return apps.filter((application) => {
      const actor = actors[application.actorUid];
      const brief = briefs.find((item) => item.id === application.briefId);
      const matchesBrief = selectedBriefId === "all" || application.briefId === selectedBriefId;
      const matchesStatus = statusFilter === "all" || application.status === statusFilter;
      const matchesSearch = !needle || [actor?.fullName, actor?.stageName, actor?.availabilityStatus, brief?.title].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesBrief && matchesStatus && matchesSearch;
    });
  }, [apps, actors, briefs, search, selectedBriefId, statusFilter]);
  const statusCounts = useMemo(() => apps.reduce<Record<Status, number>>((counts, application) => ({ ...counts, [application.status]: counts[application.status] + 1 }), { pending: 0, standby: 0, booked: 0, rejected: 0 }), [apps]);
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
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">APPLICATIONS</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">Make the casting call.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Open a complete actor dossier, view every portfolio image, then confirm the booking.</p>
        </div>
        <div className="grid w-full grid-cols-4 gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-brand-silver/70 sm:w-auto">
          <MiniStat label="New" value={statusCounts.pending} tone="text-brand-blue" />
          <MiniStat label="Standby" value={statusCounts.standby} tone="text-amber-600" />
          <MiniStat label="Booked" value={statusCounts.booked} tone="text-emerald-600" />
          <MiniStat label="Rejected" value={statusCounts.rejected} tone="text-red-600" />
        </div>
      </header>

      <section className="mt-7 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-brand-silver/70 sm:p-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setSelectedBriefId("all")} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${selectedBriefId === "all" ? "bg-brand-navy text-white" : "bg-brand-ice text-brand-navy"}`}>All briefs <span className="ml-2 opacity-70">{apps.length}</span></button>
          {groups.map(({ brief, entries }) => (
            <button key={brief.id} type="button" onClick={() => setSelectedBriefId(brief.id)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${selectedBriefId === brief.id ? "bg-brand-navy text-white" : "bg-brand-ice text-brand-navy"}`}>
              {brief.title}<span className="ml-2 opacity-70">{entries.length}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant, availability, or brief" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-brand-ice pl-12 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
          </label>
          <div className="grid grid-cols-5 rounded-2xl bg-brand-ice p-1">
            {(["all", "pending", "standby", "booked", "rejected"] as const).map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`min-h-10 rounded-xl px-2 text-xs font-bold capitalize ${statusFilter === status ? "bg-white text-brand-navy shadow-sm" : "text-slate-500"}`}>
                {status === "pending" ? "New" : status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-brand-silver/70 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-brand-blue">{filteredApps.length} visible</p>
            <h2 className="mt-1 text-xl font-bold text-brand-navy">{activeBrief?.title || "All applications"}</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy"><LayoutGrid className="size-4 text-brand-blue" />Review board</div>
        </div>
        {filteredApps.length ? (
          <>
            <ApplicantStoryRail applications={filteredApps} actors={actors} open={setActive} />
            <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
              {filteredApps.map((application) => <ActorCard key={application.id} application={application} actor={actors[application.actorUid]} open={() => setActive(application)} />)}
            </div>
          </>
        ) : groups.length ? (
          <div className="rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/40 p-10 text-center">
            <Search className="mx-auto size-8 text-brand-blue" />
            <h2 className="mt-4 text-xl font-bold text-brand-navy">No matching applications</h2>
            <p className="mt-2 text-sm text-slate-600">Adjust the brief, status, or search filter.</p>
          </div>
        ) : (
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

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-16 rounded-xl bg-brand-ice px-3 py-2 text-center">
      <p className={`text-xl font-black ${tone}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
    </div>
  );
}

function ApplicantStoryRail({ applications, actors, open }: { applications: Application[]; actors: Record<string, Actor>; open: (application: Application) => void }) {
  return (
    <div className="md:hidden">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {applications.map((application) => {
          const actor = actors[application.actorUid];
          return (
            <div key={application.id} className="w-20 shrink-0 text-center">
              <button type="button" onClick={() => open(application)} className={`relative mx-auto flex size-16 items-center justify-center rounded-full p-0.5 ${statusRing(application.status)}`} aria-label={`Review ${actor?.stageName || actor?.fullName || "actor"}`}>
                <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-white p-0.5">
                  <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-brand-ice text-brand-blue">
                    {actor?.headshot ? <Image src={actor.headshot} alt="" width={64} height={64} unoptimized className="size-full object-cover" /> : <UserRound className="size-6" />}
                  </span>
                </span>
                <span className="absolute -bottom-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black uppercase text-brand-navy shadow-sm ring-1 ring-brand-silver">{application.status === "pending" ? "New" : application.status}</span>
              </button>
              <p className="mt-2 truncate text-xs font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Actor"}</p>
              <Link href={`/agent/talent/${application.actorUid}`} className="mt-0.5 block text-[11px] font-bold text-brand-blue">Profile</Link>
            </div>
          );
        })}
      </div>
      <p className="mt-2 rounded-2xl bg-brand-ice px-3 py-2 text-xs font-semibold text-slate-600">Tap a circle to review. Open Profile for the full actor page.</p>
    </div>
  );
}

function ActorCard({ application, actor, open }: { application: Application; actor?: Actor; open: () => void }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-lg hover:shadow-brand-navy/10">
      <Link href={`/agent/talent/${application.actorUid}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-brand-ice">
        <Avatar actor={actor} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Loading actor..."}</span>
          <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-brand-blue"><ExternalLink className="size-3.5" />View full profile</span>
        </span>
        <StatusBadge status={application.status} />
      </Link>
      <button type="button" onClick={open} className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl bg-brand-navy px-4 text-xs font-bold text-white hover:bg-brand-blue">
        Review application
      </button>
    </div>
  );
}

function statusRing(status: Status) {
  if (status === "booked") return "bg-emerald-500";
  if (status === "standby") return "bg-amber-500";
  if (status === "rejected") return "bg-red-500";
  return "bg-brand-blue";
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
        <div className="mt-6 grid grid-cols-[108px_1fr] gap-4 sm:grid-cols-[140px_1fr] md:grid-cols-[180px_1fr] md:gap-6">
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-brand-ice sm:h-44 md:aspect-[3/4] md:h-auto md:rounded-3xl">
            {actor?.headshot ? <Image src={actor.headshot} alt="Actor headshot" width={360} height={480} unoptimized className="size-full object-cover" /> : <UserRound className="size-12 text-brand-blue" />}
          </div>
          <div className="min-w-0 self-center">
            <p className="line-clamp-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{actor?.bio || "No bio added yet."}</p>
            <div className="mt-4 flex flex-wrap gap-2">{[actor?.ageRange, actor?.heightCm && `${actor.heightCm} cm`, actor?.hairColor, actor?.eyeColor, actor?.availabilityStatus].filter(Boolean).map((item) => <span key={item} className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-bold text-brand-navy sm:text-sm">{item}</span>)}</div>
          </div>
        </div>
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Portfolio</h3>
              <p className="mt-1 text-sm text-slate-600">A profile-style grid for fast scanning. Open any photo for full-screen review.</p>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{photos.length} photos</span>
          </div>
          <div className="mt-5 space-y-6">
            {albumCategories.map((category) => {
              const categoryPhotos = photos.filter((photo) => photo.category === category);
              if (!categoryPhotos.length) return null;
              return (
                <div key={category}>
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue">{category}</h4>
                    <span className="rounded-full bg-brand-ice px-2 py-0.5 text-[11px] font-bold text-brand-navy">{categoryPhotos.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                    {categoryPhotos.map((photo) => {
                      const index = photos.findIndex((item) => item.source === photo.source);
                      return (
                        <button type="button" key={`${photo.source.slice(-24)}-${index}`} onClick={() => setViewer(index)} className="group relative aspect-square overflow-hidden rounded-xl bg-brand-ice sm:rounded-2xl">
                          <Image src={photo.source} alt={`${photo.category} portfolio photo`} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
                          <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/35"><ZoomIn className="size-7 opacity-0 transition group-hover:opacity-100" /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
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
  const data = normalizeActorProfile(snapshot.data());
  return {
    fullName: data.fullName || "Unnamed actor",
    stageName: data.stageName,
    bio: data.bio,
    headshot: data.headshot,
    heightCm: data.heightCm,
    hairColor: data.hairColor,
    eyeColor: data.eyeColor,
    ageRange: data.ageRange,
    availabilityStatus: data.availabilityStatus,
    albums: data.albums,
  };
}
