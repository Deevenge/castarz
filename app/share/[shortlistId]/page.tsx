"use client";

import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { CheckCircle2, Clock3, LoaderCircle, LockKeyhole, MapPin, Send, ShieldCheck, UserRound, XCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

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
            publicActors: Array.isArray(data.publicActors) ? data.publicActors.filter((actor): actor is SharedActor => typeof actor?.uid === "string") : [],
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
                <button type="button" disabled={submitted} onClick={() => toggleActor(actor.uid)} className="relative flex aspect-[4/3] w-full items-center justify-center bg-brand-ice text-left disabled:cursor-default" aria-label={`Select ${actor.stageName || actor.fullName}`}>
                  {actor.headshot ? <Image src={actor.headshot} alt={actor.stageName || actor.fullName} width={700} height={525} unoptimized className="size-full object-contain object-top" /> : <UserRound className="size-12 text-brand-blue" />}
                  <span className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full shadow-sm ${selected ? "bg-brand-blue text-white" : "bg-white text-slate-300 ring-1 ring-brand-silver/70"}`}>
                    <CheckCircle2 className="size-5" />
                  </span>
                </button>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-bold text-brand-navy">{actor.stageName || actor.fullName}</h2>
                      {actor.stageName && <p className="mt-1 truncate text-sm text-slate-500">{actor.fullName}</p>}
                    </div>
                    {selected && <span className="rounded-full bg-brand-ice px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-brand-blue">Preferred</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{[actor.ageRange, actor.heightCm && `${actor.heightCm}cm`, actor.hairColor, actor.eyeColor].filter(Boolean).map((spec) => <span key={spec} className="rounded-full bg-brand-ice px-3 py-1 text-xs font-bold text-brand-navy">{spec}</span>)}</div>
                  {actor.bio && <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">{actor.bio}</p>}
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
    </main>
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
