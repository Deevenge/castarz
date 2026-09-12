"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { albumCategories, compressImageToDataUrl, emptyActorProfile, maxPhotosPerAlbumCategory, normalizeActorProfile, type AlbumCategory, type ActorProfile } from "@/lib/actor-profile";

const maxPhotosPerCategory = maxPhotosPerAlbumCategory;
const photoSlotLabels = ["Headshot", "Full length"];

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
    const albums = Object.fromEntries(albumCategories.map((item) => [item, next.albums[item].slice(0, maxPhotosPerCategory)])) as ActorProfile["albums"];
    await setDoc(doc(db, "actors", user.uid), { albums, updatedAt: serverTimestamp() }, { merge: true });
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const remainingSlots = maxPhotosPerCategory - actor.albums[category].length;
    if (remainingSlots <= 0) {
      setNotice(`${category} already has its headshot and full length photo.`);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setNotice("");
    try {
      const selected = files.slice(0, remainingSlots);
      const compressed = await Promise.all(selected.map(compressImageToDataUrl));
      const next = { ...actor, albums: { ...actor.albums, [category]: [...actor.albums[category], ...compressed].slice(0, maxPhotosPerCategory) } };
      setActor(next);
      await persist(next);
      setNotice(files.length > remainingSlots ? `${compressed.length} photo${compressed.length > 1 ? "s" : ""} added to ${category}. Each category is limited to 2.` : `${compressed.length} photo${compressed.length > 1 ? "s" : ""} added to ${category}.`);
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
  const remainingSlots = maxPhotosPerCategory - photos.length;

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
          <p className="mt-1 text-sm text-slate-600">Keep this category tight: one headshot and one full length photo.</p>
        </div>
        <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${remainingSlots > 0 ? "cursor-pointer bg-brand-blue text-white hover:bg-brand-navy" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>
          <ImagePlus className="size-4" />{uploading ? "Preparing..." : remainingSlots > 0 ? `Add ${remainingSlots}` : "Complete"}
          <input type="file" accept="image/*" multiple disabled={uploading || remainingSlots <= 0} onChange={upload} className="sr-only" />
        </label>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {photoSlotLabels.map((label, index) => (
          <div key={label} className={`rounded-2xl border p-3 ${photos[index] ? "border-brand-silver bg-white" : "border-dashed border-brand-silver bg-brand-ice/50"}`}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue">{label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{photos[index] ? "Uploaded" : "Empty slot"}</p>
          </div>
        ))}
      </div>
      {notice && <p className="mt-4 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy">{notice}</p>}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <figure key={`${photo.slice(-24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-brand-ice">
            <Image src={photo} alt={`${category} portfolio photo ${index + 1}`} fill unoptimized className="object-cover" />
            <figcaption className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white backdrop-blur">{photoSlotLabels[index] ?? "Photo"}</figcaption>
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
