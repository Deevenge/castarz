"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { CheckCircle2, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { SpecChips } from "@/components/ProfileChrome";
import { MyPostsSection } from "@/components/MyPostsSection";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { emptyActorProfile, normalizeActorProfile, type ActorCredit, type ActorProfile, type AvailabilityStatus } from "@/lib/actor-profile";

function helpForField(key: keyof ActorProfile) {
  const help: Partial<Record<keyof ActorProfile, string>> = {
    fullName: "Use your legal or professional full name for bookings and agency records.",
    stageName: "Optional. Add the name casting teams should remember or search for.",
    heightCm: "Useful for wardrobe, blocking, and matching brief requirements.",
    hairColor: "Keep this current so agencies can match your look accurately.",
    eyeColor: "A quick casting detail that helps agents scan your z-card.",
    ageRange: "Use the age range you can realistically play on camera.",
  };
  return help[key] ?? "Add clear information that helps casting teams understand your profile.";
}

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

  function updateCredit(index: number, key: keyof ActorCredit, value: string) {
    setActor((current) => ({
      ...current,
      credits: current.credits.map((credit, creditIndex) => creditIndex === index ? { ...credit, [key]: value } : credit),
    }));
  }

  function addCredit() {
    setActor((current) => ({ ...current, credits: [...current.credits, { production: "", year: "", role: "" }] }));
  }

  function removeCredit(index: number) {
    setActor((current) => ({ ...current, credits: current.credits.filter((_, creditIndex) => creditIndex !== index) }));
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
          <div className="mt-6 border-t border-brand-silver/70 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy">Screen and stage credits</h3>
                <p className="mt-1 text-sm text-slate-500">Optional z-card experience for productions, campaigns, shows, or theatre work.</p>
              </div>
              <span className="rounded-full bg-brand-ice px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-blue">{actor.credits.length} listed</span>
            </div>
            {actor.credits.length ? (
              <div className="mt-4 grid gap-3">
                {actor.credits.map((credit, index) => (
                  <div key={`${credit.production}-${credit.year}-${index}`} className="grid gap-2 rounded-2xl bg-brand-ice/70 p-4 sm:grid-cols-[1fr_90px_1fr]">
                    <p className="font-bold text-brand-navy">{credit.production || "Untitled production"}</p>
                    <p className="text-sm font-semibold text-slate-500">{credit.year || "Year"}</p>
                    <p className="text-sm font-semibold text-slate-700">{credit.role || "Role not specified"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-brand-silver p-4 text-sm font-semibold text-slate-500">No credits added yet. You can still have a strong CASTARZ profile with photos, specs, and a clear bio.</p>
            )}
          </div>
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
                  <p className="mt-2 text-xs font-semibold text-slate-500">{helpForField(key)}</p>
                </label>
              ))}
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Bio</span>
              <textarea value={actor.bio} onChange={(event) => update("bio", event.target.value)} rows={4} placeholder="Share a little about your look, experience, set etiquette, languages, accents, and the type of work you are ready for." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
              <p className="mt-2 text-xs font-semibold text-slate-500">This is your first z-card impression. Keep it concise, confident, and casting-friendly.</p>
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Representation status</span>
              <select value={actor.representationStatus} onChange={(event) => update("representationStatus", event.target.value as ActorProfile["representationStatus"])} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20">
                <option>Freelancer</option>
                <option>Multi-Agency</option>
                <option>Exclusive</option>
              </select>
              <p className="mt-2 text-xs font-semibold text-slate-500">Helps agencies understand whether they can contact you directly or through representation.</p>
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
                <p className="mt-2 text-xs font-semibold text-slate-500">Choose the option that best describes your current booking availability.</p>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Available from</span>
                <input type="date" value={actor.availableFrom} onChange={(event) => update("availableFrom", event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                <p className="mt-2 text-xs font-semibold text-slate-500">Leave blank if you are available immediately.</p>
              </label>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Availability note <span className="font-normal text-slate-400">(optional)</span></span>
              <input value={actor.availabilityNote} onChange={(event) => update("availabilityNote", event.target.value)} placeholder="For example: unavailable on weekdays until 15:00, but open for weekend shoots." className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
              <p className="mt-2 text-xs font-semibold text-slate-500">Add anything an agency should know before shortlisting or booking you.</p>
            </label>
          </section>
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Z-card credits</h2>
                <p className="mt-1 text-sm text-slate-600">Optional. Add productions, shows, commercials, theatre, or featured work that strengthens your profile.</p>
              </div>
              <button type="button" onClick={addCredit} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white">
                <Plus className="size-4" />Add credit
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {actor.credits.map((credit, index) => (
                <div key={index} className="rounded-2xl border border-brand-silver/70 bg-brand-ice/40 p-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_110px_1fr_auto] sm:items-start">
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-700">Show or production</span>
                      <input value={credit.production} onChange={(event) => updateCredit(index, "production", event.target.value)} placeholder="e.g. Muvhango, Blood & Water, TV commercial, theatre production" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">Name the production, campaign, series, film, or stage work.</p>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-700">Year</span>
                      <input value={credit.year} onChange={(event) => updateCredit(index, "year", event.target.value)} placeholder="e.g. 2025" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">Use the release, shoot, or performance year.</p>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-700">Role</span>
                      <input value={credit.role} onChange={(event) => updateCredit(index, "role", event.target.value)} placeholder="e.g. Supporting actor, featured extra, lead, dancer" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">Describe your part clearly so casting teams can scan it fast.</p>
                    </label>
                    <button type="button" onClick={() => removeCredit(index)} className="flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-700 sm:mt-7" aria-label="Remove credit">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!actor.credits.length && <p className="rounded-2xl border border-dashed border-brand-silver p-5 text-sm font-semibold text-slate-500">No credits yet. Add one when you have work you want casting teams to notice.</p>}
            </div>
          </section>
          {notice && <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${notice.includes("live") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><CheckCircle2 className="size-5" />{notice}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 font-bold text-slate-600">Cancel</button>
            <button disabled={saving} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue font-bold text-white hover:bg-brand-navy disabled:opacity-60">{saving ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}
      {user && <MyPostsSection userUid={user.uid} />}
    </div>
  );
}
