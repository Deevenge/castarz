"use client";

import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { CheckCircle2, Clock3, Images, LoaderCircle, LockKeyhole, MapPin, PlaySquare, Send, ShieldCheck, UserRound, X, XCircle, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

const albumCategories = ["Formal", "Casual", "Commercial", "Fitness"] as const;
type AlbumCategory = (typeof albumCategories)[number];

interface SharedCredit {
  production: string;
  year: string;
  role: string;
  mediaUrl: string;
  mediaType: "none" | "image" | "video";
}

interface SharedActor {
  uid: string;
  applicationId: string;
  fullName: string;
  stageName: string;
  headshot: string;
  bio: string;
  heightCm: string;
  hairColor: string;
  eyeColor: string;
  ageRange: string;
  credits: SharedCredit[];
  albums: Record<AlbumCategory, string[]>;
}

interface SharedShortlist {
  id: string;
  briefTitle: string;
  production: string;
  location: string;
  shootDate: string;
  publicActors: SharedActor[];
  selectedActorUids: string[];
  submittedAtMs: number;
  expiresAtMs: number;
  productionName: string;
}

export default function SharedShortlistPage({ params }: { params: Promise<{ shortlistId: string }> }) {
  const [shortlist, setShortlist] = useState<SharedShortlist | null>(null);
  const [shortlistId, setShortlistId] = useState("");
  const [selectedActorUids, setSelectedActorUids] = useState<string[]>([]);
  const [productionName, setProductionName] = useState("");
  const [productionNote, setProductionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nowMs] = useState(() => Date.now());
  const [previewActor, setPreviewActor] = useState<SharedActor | null>(null);

  useEffect(() => {
    let active = true;
    void params.then(async ({ shortlistId: id }) => {
      setShortlistId(id);
      try {
        const snapshot = await getDoc(doc(db, "shortlists", id));
        if (snapshot.exists() && active) {
          const data = snapshot.data();
          const next = {
            id,
            briefTitle: typeof data.briefTitle === "string" ? data.briefTitle : "Casting shortlist",
            production: typeof data.production === "string" ? data.production : "",
            location: typeof data.location === "string" ? data.location : "",
            shootDate: typeof data.shootDate === "string" ? data.shootDate : "",
            publicActors: Array.isArray(data.publicActors) ? data.publicActors.filter((actor): actor is SharedActor => typeof actor?.uid === "string").map(normalizeSharedActor) : [],
            selectedActorUids: Array.isArray(data.selectedActorUids) ? data.selectedActorUids.filter((uid): uid is string => typeof uid === "string") : [],
            submittedAtMs: data.submittedAt?.toMillis?.() ?? 0,
            expiresAtMs: data.expiresAt?.toMillis?.() ?? 0,
            productionName: typeof data.productionName === "string" ? data.productionName : "",
          };
          setShortlist(next);
          setSelectedActorUids(next.selectedActorUids);
          setProductionName(next.productionName);
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [params]);

  const submitted = Boolean(shortlist?.submittedAtMs);
  const expired = Boolean(shortlist?.expiresAtMs && shortlist.expiresAtMs < nowMs && !submitted);
  const selectedActors = useMemo(() => shortlist?.publicActors.filter((actor) => selectedActorUids.includes(actor.uid)) ?? [], [shortlist, selectedActorUids]);

  function toggleActor(uid: string) {
    if (submitted || expired) return;
    setSelectedActorUids((current) => current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]);
  }

  async function submitSelection() {
    if (!shortlist || !shortlistId || submitted || expired) return;
    if (!selectedActorUids.length) {
      setError("Select at least one actor before submitting production preferences.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await updateDoc(doc(db, "shortlists", shortlistId), {
        selectedActorUids,
        productionName: productionName.trim(),
        productionNote: productionNote.trim(),
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShortlist({ ...shortlist, selectedActorUids, productionName: productionName.trim(), submittedAtMs: Date.now() });
    } catch (submitError) {
      console.error("Unable to submit production selection.", submitError);
      setError("This link may already be used or expired. Please ask your casting agency for a fresh link.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="flex min-h-dvh items-center justify-center bg-brand-ice"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></main>;
  if (!shortlist) return <Unavailable title="This shortlist is unavailable." body="Please ask your casting contact for a current guest link." />;
  if (expired) return <Unavailable title="This production link expired." body="For talent privacy, production review links are time-limited. Ask the agency for a fresh one-time link." />;

  return (
    <main className="min-h-dvh bg-brand-ice pb-28">
      <header className="bg-brand-navy px-4 py-7 text-white sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-brand-cyan"><LockKeyhole className="size-4" />CASTARZ private production review</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{shortlist.briefTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Review the agency shortlist and submit your preferred actors once. Your choices go directly back to casting.</p>
            </div>
            <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${submitted ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/25" : "bg-white/10 text-brand-cyan ring-1 ring-white/10"}`}>
              {submitted ? <CheckCircle2 className="mb-1 size-5" /> : <ShieldCheck className="mb-1 size-5" />}
              {submitted ? "Selection submitted" : "One-time selection link"}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
            {shortlist.production && <span className="rounded-full bg-white/10 px-3 py-1.5">{shortlist.production}</span>}
            {shortlist.location && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5"><MapPin className="size-4" />{shortlist.location}</span>}
            {shortlist.shootDate && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5"><Clock3 className="size-4" />{shortlist.shootDate}</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {submitted && (
          <section className="mb-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
            <p className="flex items-center gap-2 font-black"><CheckCircle2 className="size-5" />Production selection received</p>
            <p className="mt-2 text-sm font-semibold">Preferred: {selectedActors.length ? selectedActors.map((actor) => actor.stageName || actor.fullName).join(", ") : "No actors selected"}.</p>
          </section>
        )}

        {!submitted && (
          <section className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-silver/70 sm:grid-cols-[1fr_1.4fr] sm:p-5">
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Production contact <span className="font-semibold text-slate-400">(optional)</span></span>
              <input value={productionName} onChange={(event) => setProductionName(event.target.value)} placeholder="Name or production team" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Selection note <span className="font-semibold text-slate-400">(optional)</span></span>
              <input value={productionNote} onChange={(event) => setProductionNote(event.target.value)} placeholder="Example: Prefer the first two, keep third as backup" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            </label>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortlist.publicActors.map((actor) => {
            const selected = selectedActorUids.includes(actor.uid);
            return (
              <article key={actor.uid} className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 transition ${selected ? "ring-2 ring-brand-blue shadow-lg shadow-brand-blue/10" : "ring-brand-silver/70 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-navy/10"}`}>
                <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-brand-ice text-left">
                  {actor.headshot ? <Image src={actor.headshot} alt={actor.stageName || actor.fullName} width={700} height={525} unoptimized className="size-full object-contain object-top" /> : <UserRound className="size-12 text-brand-blue" />}
                  <button type="button" disabled={submitted} onClick={() => toggleActor(actor.uid)} className={`absolute right-3 top-3 flex size-10 items-center justify-center rounded-full shadow-sm transition disabled:cursor-default ${selected ? "bg-brand-blue text-white" : "bg-white text-slate-300 ring-1 ring-brand-silver/70 hover:text-brand-blue"}`} aria-label={`${selected ? "Remove" : "Select"} ${actor.stageName || actor.fullName}`}>
                    <CheckCircle2 className="size-5" />
                  </button>
                  <button type="button" onClick={() => setPreviewActor(actor)} className="absolute bottom-3 left-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/95 px-3 text-xs font-black text-brand-navy shadow-sm ring-1 ring-brand-silver/70 backdrop-blur hover:bg-brand-ice" aria-label={`View ${actor.stageName || actor.fullName} z-card`}>
                    <ZoomIn className="size-4 text-brand-blue" />View z-card
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-bold text-brand-navy">{actor.stageName || actor.fullName}</h2>
                      {actor.stageName && <p className="mt-1 truncate text-sm text-slate-500">{actor.fullName}</p>}
                    </div>
                    {selected && <span className="rounded-full bg-brand-ice px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-brand-blue">Preferred</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{[actor.ageRange, actor.heightCm && `${actor.heightCm}cm`, actor.hairColor, actor.eyeColor].filter(Boolean).map((spec) => <span key={spec} className="rounded-full bg-brand-ice px-3 py-1 text-xs font-bold text-brand-navy">{spec}</span>)}</div>
                  {actor.bio && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{actor.bio}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPreviewActor(actor)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 text-sm font-bold text-white hover:bg-brand-blue">
                      <Images className="size-4" />Open z-card
                    </button>
                    <button type="button" disabled={submitted} onClick={() => toggleActor(actor.uid)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-60 ${selected ? "bg-emerald-50 text-emerald-800" : "bg-brand-ice text-brand-navy hover:bg-brand-cyan/20"}`}>
                      <CheckCircle2 className="size-4" />{selected ? "Preferred" : "Select"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {!shortlist.publicActors.length && <div className="mt-7 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-brand-silver"><MapPin className="mx-auto size-8 text-brand-blue" /><p className="mt-4 font-bold">This shortlist has no actors yet.</p></div>}
      </div>

      {!submitted && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-silver/70 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-brand-navy">{selectedActorUids.length} selected</p>
              <p className="text-xs font-semibold text-slate-500">Submit once when production is ready.</p>
            </div>
            <button type="button" disabled={submitting || !selectedActorUids.length} onClick={() => void submitSelection()} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white hover:bg-brand-navy disabled:opacity-50 sm:flex-none">
              {submitting ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}
              {submitting ? "Submitting..." : "Submit selection"}
            </button>
          </div>
          {error && <p className="mx-auto mt-2 max-w-6xl text-sm font-bold text-red-700">{error}</p>}
        </div>
      )}
      {previewActor && <ProductionZCard actor={previewActor} close={() => setPreviewActor(null)} />}
    </main>
  );
}

function normalizeSharedActor(actor: SharedActor): SharedActor {
  const albums = actor.albums ?? {};
  return {
    ...actor,
    applicationId: typeof actor.applicationId === "string" ? actor.applicationId : "",
    fullName: typeof actor.fullName === "string" ? actor.fullName : "Actor",
    stageName: typeof actor.stageName === "string" ? actor.stageName : "",
    headshot: typeof actor.headshot === "string" ? actor.headshot : "",
    bio: typeof actor.bio === "string" ? actor.bio : "",
    heightCm: typeof actor.heightCm === "string" ? actor.heightCm : "",
    hairColor: typeof actor.hairColor === "string" ? actor.hairColor : "",
    eyeColor: typeof actor.eyeColor === "string" ? actor.eyeColor : "",
    ageRange: typeof actor.ageRange === "string" ? actor.ageRange : "",
    credits: Array.isArray(actor.credits) ? actor.credits.filter((credit): credit is SharedCredit => typeof credit?.production === "string").slice(0, 8) : [],
    albums: Object.fromEntries(albumCategories.map((category) => [category, Array.isArray(albums[category]) ? albums[category].filter((source): source is string => typeof source === "string").slice(0, 4) : []])) as Record<AlbumCategory, string[]>,
  };
}

function ProductionZCard({ actor, close }: { actor: SharedActor; close: () => void }) {
  const actorName = actor.stageName || actor.fullName || "Actor";
  const photos = albumCategories.flatMap((category) => actor.albums[category].map((source) => ({ category, source })));
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-brand-navy/60 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue">Production z-card</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-brand-navy sm:text-3xl">{actorName}</h2>
            {actor.stageName && <p className="mt-1 text-sm font-semibold text-slate-500">{actor.fullName}</p>}
          </div>
          <button type="button" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand-navy hover:bg-slate-100" aria-label="Close z-card">
            <X className="size-5" />
          </button>
        </header>

        <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-brand-ice">
            {actor.headshot ? <Image src={actor.headshot} alt={`${actorName} headshot`} fill unoptimized className="object-contain object-top" /> : <div className="flex size-full items-center justify-center"><UserRound className="size-14 text-brand-blue" /></div>}
          </div>
          <div className="self-center">
            <p className="text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{actor.bio || "No bio supplied for this z-card."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[actor.ageRange, actor.heightCm && `${actor.heightCm} cm`, actor.hairColor, actor.eyeColor].filter(Boolean).map((item) => <span key={item} className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{item}</span>)}
            </div>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-brand-navy">Portfolio album</h3>
              <p className="mt-1 text-sm text-slate-600">Recent profile photos supplied by the actor.</p>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{photos.length} photos</span>
          </div>
          <div className="mt-5 space-y-6">
            {albumCategories.map((category) => {
              const categoryPhotos = actor.albums[category];
              if (!categoryPhotos.length) return null;
              return (
                <div key={category}>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-brand-blue">{category}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {categoryPhotos.map((source, index) => (
                      <a key={`${category}-${index}-${source.slice(-12)}`} href={source} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-2xl bg-brand-ice">
                        <Image src={source} alt={`${actorName} ${category} photo`} fill unoptimized className="object-contain object-top transition duration-300 group-hover:scale-105" />
                        <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/35"><ZoomIn className="size-7 opacity-0 transition group-hover:opacity-100" /></span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
            {!photos.length && <p className="rounded-2xl border border-dashed border-brand-silver bg-brand-ice/40 p-5 text-sm font-semibold text-slate-500">No album photos were attached to this production link.</p>}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-brand-navy">Credits</h3>
              <p className="mt-1 text-sm text-slate-600">Screen, commercial, stage, or supplied media references.</p>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1.5 text-sm font-bold text-brand-navy">{actor.credits.length} credits</span>
          </div>
          {actor.credits.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-brand-silver/70">
              {actor.credits.map((credit, index) => (
                <div key={`${credit.production}-${credit.year}-${index}`} className="grid gap-4 border-b border-slate-100 bg-white p-4 last:border-b-0 sm:grid-cols-[140px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-brand-ice">
                    {credit.mediaType === "image" && credit.mediaUrl ? <Image src={credit.mediaUrl} alt={`${credit.production} media`} fill unoptimized className="object-cover" /> : credit.mediaType === "video" && credit.mediaUrl ? <video src={credit.mediaUrl} controls playsInline className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-brand-blue"><PlaySquare className="size-6" /></div>}
                  </div>
                  <div className="grid gap-1 self-center sm:grid-cols-[1fr_90px_1fr]">
                    <p className="font-bold text-brand-navy">{credit.production || "Untitled production"}</p>
                    <p className="text-sm font-semibold text-slate-500">{credit.year || "Year"}</p>
                    <p className="text-sm font-semibold text-slate-700">{credit.role || "Role not specified"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-brand-silver bg-brand-ice/40 p-5 text-sm font-semibold text-slate-500">No credits were attached to this production link.</p>
          )}
        </section>
      </section>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-ice p-5">
      <section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-silver">
        <XCircle className="mx-auto size-10 text-red-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand-navy">{title}</h1>
        <p className="mt-3 text-slate-600">{body}</p>
      </section>
    </main>
  );
}
