"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Building2, Camera, CheckCircle2, LoaderCircle, LogOut, Save } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { MyPostsSection } from "@/components/MyPostsSection";
import { useAuth } from "@/context/AuthContext";
import { compressImageToDataUrl } from "@/lib/actor-profile";
import { db } from "@/lib/firebase";

type AgencyProfile = {
  name: string;
  username: string;
  description: string;
  photo: string;
};

const empty: AgencyProfile = { name: "", username: "", description: "", photo: "" };

export default function AgencyProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [agency, setAgency] = useState<AgencyProfile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    void getDoc(doc(db, "agencies", user.uid)).then((snapshot) => {
      const data = snapshot.data();
      setAgency({
        name: typeof data?.name === "string" ? data.name : "",
        username: typeof data?.username === "string" ? data.username : "",
        description: typeof data?.description === "string" ? data.description : "",
        photo: typeof data?.photo === "string" ? data.photo : "",
      });
    }).catch(() => setNotice("We could not load the agency profile.")).finally(() => setLoading(false));
  }, [user]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setNotice("");
    try {
      await setDoc(doc(db, "agencies", user.uid), {
        uid: user.uid,
        email: user.email ?? "",
        name: agency.name.trim(),
        username: agency.username.trim().replace(/^@/, ""),
        description: agency.description.trim(),
        photo: agency.photo,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice("Agency profile saved. Your posts and briefs now use this identity.");
    } catch {
      setNotice("We could not save the agency profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setNotice("");
    try {
      const photo = await compressImageToDataUrl(file);
      setAgency((current) => ({ ...current, photo }));
      await setDoc(doc(db, "agencies", user.uid), { photo, updatedAt: serverTimestamp() }, { merge: true });
      setNotice("Agency profile photo updated.");
    } catch {
      setNotice("We could not upload that photo. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/auth");
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;

  const displayName = agency.name || "Your agency";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
        <div className="relative h-44 bg-[radial-gradient(circle_at_20%_20%,#7ea2ff_0,#2857df_28%,#071a38_72%)] sm:h-56">
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/60 via-transparent to-white/10" />
        </div>
        <div className="px-5 pb-5 sm:px-7">
          <div className="relative -mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="relative flex size-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-brand-navy text-2xl font-extrabold text-brand-cyan ring-4 ring-white sm:size-32">
              {agency.photo ? <Image src={agency.photo} alt={displayName} fill unoptimized className="object-cover" /> : displayName.slice(0, 2).toUpperCase()}
              <span className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-white text-brand-navy shadow-lg">
                {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </span>
              <input type="file" accept="image/*" onChange={(event) => void uploadPhoto(event)} className="sr-only" />
            </label>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-xs font-bold tracking-[0.18em] text-brand-blue">AGENCY PROFILE</p>
              <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-brand-navy">{displayName}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">{agency.username ? `@${agency.username.replace(/^@/, "")}` : "Casting agency"}</p>
            </div>
            <button type="button" onClick={() => void handleSignOut()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100">
              <LogOut className="size-4" />Log out
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={save} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><Building2 className="size-6" /></div>
          <div>
            <h2 className="font-bold text-brand-navy">Public agency details</h2>
            <p className="text-sm text-slate-600">This identity appears on briefs, posts, and actor-facing pages.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Agency name" value={agency.name} set={(name) => setAgency({ ...agency, name })} placeholder="e.g. Mosaic Casting" required />
          <Field label="Username" value={agency.username} set={(username) => setAgency({ ...agency, username })} placeholder="e.g. mosaiccasting" prefix="@" required />
        </div>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">About your agency</span>
          <textarea value={agency.description} onChange={(event) => setAgency({ ...agency, description: event.target.value })} rows={4} placeholder="Tell actors what your agency is known for." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
        </label>
        {notice && <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}
        <button disabled={saving} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue font-bold text-white hover:bg-brand-navy disabled:opacity-50">
          {saving ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}
          {saving ? "Saving..." : "Save agency profile"}
        </button>
      </form>

      {user && <MyPostsSection userUid={user.uid} />}
    </div>
  );
}

function Field({ label, value, set, placeholder, prefix, required }: { label: string; value: string; set: (value: string) => void; placeholder: string; prefix?: string; required?: boolean }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute inset-y-0 left-4 flex items-center font-bold text-slate-400">{prefix}</span>}
        <input required={required} value={value} onChange={(event) => set(event.target.value)} placeholder={placeholder} className={`min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20 ${prefix ? "pl-8" : ""}`} />
      </div>
    </label>
  );
}
