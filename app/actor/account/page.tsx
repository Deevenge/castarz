"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { SpecChips } from "@/components/ProfileChrome";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { emptyActorProfile, normalizeActorProfile, type ActorProfile, type AvailabilityStatus } from "@/lib/actor-profile";

export default function ActorProfilePage() {
  const { user } = useAuth();
  const [actor, setActor] = useState<ActorProfile>(emptyActorProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) { setLoading(false); return; }
      try {
        const snapshot = await getDoc(doc(db, "actors", user.uid));
        const next = normalizeActorProfile(snapshot.data() as Partial<ActorProfile> | undefined);
        setActor(next);
        setEditing(!next.fullName);
      } catch {
        setNotice("We could not load your profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  function update<K extends keyof ActorProfile>(key: K, value: ActorProfile[K]) {
    setActor((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setNotice("");
    try {
      await setDoc(doc(db, "actors", user.uid), { ...actor, uid: user.uid, email: auth.currentUser?.email ?? "", updatedAt: serverTimestamp() }, { merge: true });
      setNotice("Your actor profile is live and up to date.");
      setEditing(false);
    } catch {
      setNotice("We could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;

  const fields: Array<{ key: keyof ActorProfile; label: string; placeholder: string; type?: string }> = [
    { key: "fullName", label: "Full name", placeholder: "Your full name" },
    { key: "stageName", label: "Stage name", placeholder: "Name used on set" },
    { key: "heightCm", label: "Height (cm)", placeholder: "e.g. 172", type: "number" },
    { key: "hairColor", label: "Hair color", placeholder: "e.g. Dark brown" },
    { key: "eyeColor", label: "Eye color", placeholder: "e.g. Brown" },
    { key: "ageRange", label: "Age range", placeholder: "e.g. 25–35" },
  ];

  return (
    <div className="space-y-5">
      {!editing && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">About</h2>
              <p className="mt-2 leading-7 text-slate-600">{actor.bio || "Add a short bio so agencies get a feel for you on set."}</p>
            </div>
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-xl bg-brand-ice px-3 py-2 text-sm font-bold text-brand-navy">Edit</button>
          </div>
          <div className="mt-4"><SpecChips actor={{ uid: user?.uid ?? "", ...actor }} /></div>
          {actor.availabilityNote && <p className="mt-4 text-sm text-slate-500">{actor.availabilityNote}</p>}
        </section>
      )}
      {editing && (
        <form onSubmit={save} className="space-y-5">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
            <h2 className="text-lg font-bold">Profile details</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {fields.map(({ key, label, placeholder, type }) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
                  <input type={type ?? "text"} value={actor[key] as string} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                </label>
              ))}
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Bio</span>
              <textarea value={actor.bio} onChange={(event) => update("bio", event.target.value)} rows={4} placeholder="Share a little about your look, experience, and energy on set." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Representation status</span>
              <select value={actor.representationStatus} onChange={(event) => update("representationStatus", event.target.value as ActorProfile["representationStatus"])} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20">
                <option>Freelancer</option>
                <option>Multi-Agency</option>
                <option>Exclusive</option>
              </select>
            </label>
          </section>
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
            <h2 className="text-lg font-bold">Casting availability</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Current status</span>
                <select value={actor.availabilityStatus} onChange={(event) => update("availabilityStatus", event.target.value as AvailabilityStatus)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20">
                  <option>Available</option>
                  <option>Limited availability</option>
                  <option>Unavailable</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Available from</span>
                <input type="date" value={actor.availableFrom} onChange={(event) => update("availableFrom", event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
              </label>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Availability note <span className="font-normal text-slate-400">(optional)</span></span>
              <input value={actor.availabilityNote} onChange={(event) => update("availabilityNote", event.target.value)} placeholder="For example: unavailable on weekdays until 15:00" className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            </label>
          </section>
          {notice && <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${notice.includes("live") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><CheckCircle2 className="size-5" />{notice}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 font-bold text-slate-600">Cancel</button>
            <button disabled={saving} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue font-bold text-white hover:bg-brand-navy disabled:opacity-60">{saving ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
