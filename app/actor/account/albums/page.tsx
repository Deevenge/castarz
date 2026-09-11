"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { albumCategories, compressImageToDataUrl, emptyActorProfile, normalizeActorProfile, type AlbumCategory, type ActorProfile } from "@/lib/actor-profile";

export default function AlbumsPage() {
  const { user } = useAuth();
  const [actor, setActor] = useState<ActorProfile>(emptyActorProfile);
  const [category, setCategory] = useState<AlbumCategory>("Formal");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      if (!user) { setLoading(false); return; }
      try {
        const snapshot = await getDoc(doc(db, "actors", user.uid));
        setActor(normalizeActorProfile(snapshot.data() as Partial<ActorProfile> | undefined));
      } catch {
        setNotice("We could not load your albums. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  async function persist(next: ActorProfile) {
    if (!user) return;
    await setDoc(doc(db, "actors", user.uid), { albums: next.albums, updatedAt: serverTimestamp() }, { merge: true });
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setNotice("");
    try {
      const compressed = await Promise.all(files.map(compressImageToDataUrl));
      const next = { ...actor, albums: { ...actor.albums, [category]: [...actor.albums[category], ...compressed] } };
      setActor(next);
      await persist(next);
      setNotice(`${compressed.length} photo${compressed.length > 1 ? "s" : ""} added to ${category}.`);
    } catch {
      setNotice("One or more photos could not be uploaded. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function remove(index: number) {
    const next = { ...actor, albums: { ...actor.albums, [category]: actor.albums[category].filter((_, photoIndex) => photoIndex !== index) } };
    setActor(next);
    try {
      await persist(next);
    } catch {
      setNotice("We could not remove that photo. Please refresh and try again.");
    }
  }

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;
  const photos = actor.albums[category];

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {albumCategories.map((tab) => (
          <button key={tab} onClick={() => setCategory(tab)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${category === tab ? "bg-brand-navy text-white" : "bg-brand-ice text-slate-600"}`}>
            {tab}<span className="ml-2 text-xs opacity-70">{actor.albums[tab].length}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{category}</h2>
          <p className="mt-1 text-sm text-slate-600">Photos are compressed before they are saved.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">
          <ImagePlus className="size-4" />{uploading ? "Preparing…" : "Add photos"}
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={upload} className="sr-only" />
        </label>
      </div>
      {notice && <p className="mt-4 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy">{notice}</p>}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <figure key={`${photo.slice(-24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-brand-ice">
            <Image src={photo} alt={`${category} portfolio photo ${index + 1}`} fill unoptimized className="object-cover" />
            <button type="button" onClick={() => remove(index)} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm" aria-label="Remove photo">
              <Trash2 className="size-4" />
            </button>
          </figure>
        ))}
        {photos.length === 0 && (
          <div className="col-span-full flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/50 text-center">
            <ImagePlus className="size-8 text-brand-blue" />
            <p className="mt-3 font-bold text-brand-navy">Your {category.toLowerCase()} album is empty</p>
            <p className="mt-1 px-5 text-sm text-slate-600">Add clear, recent photos that show this side of your look.</p>
          </div>
        )}
      </div>
    </section>
  );
}
