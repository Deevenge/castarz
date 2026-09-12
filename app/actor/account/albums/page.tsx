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

  async function upload(event: ChangeEvent<HTMLInputElement>, slotIndex: number) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (slotIndex === 1 && !actor.albums[category][0]) {
      setNotice(`Add the ${category} headshot before the full length photo.`);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setNotice("");
    try {
      const compressed = await compressImageToDataUrl(file);
      const categoryPhotos = [...actor.albums[category].slice(0, maxPhotosPerCategory)];
      categoryPhotos[slotIndex] = compressed;
      const next = { ...actor, albums: { ...actor.albums, [category]: categoryPhotos.slice(0, maxPhotosPerCategory) } };
      setActor(next);
      await persist(next);
      setNotice(`${photoSlotLabels[slotIndex]} saved to ${category}.`);
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
          <p className="mt-1 text-sm text-slate-600">Keep this category tight: one headshot and one full length photo.</p>
        </div>
        <span className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-navy">2 max</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {photoSlotLabels.map((label, index) => (
          <div key={label} className={`group relative min-h-44 overflow-hidden rounded-2xl border ${photos[index] ? "border-brand-silver bg-white" : "border-dashed border-brand-silver bg-brand-ice/60 hover:border-brand-blue"}`}>
            <label className="absolute inset-0 flex cursor-pointer flex-col justify-between p-4">
              {photos[index] ? <Image src={photos[index]} alt={`${category} ${label}`} fill unoptimized className="object-cover" /> : null}
              <span className={`relative z-10 inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${photos[index] ? "bg-black/45 text-white backdrop-blur" : "bg-white text-brand-blue"}`}>{label}</span>
              <span className={`relative z-10 flex items-center gap-2 text-sm font-bold ${photos[index] ? "text-white drop-shadow" : "text-brand-navy"}`}>
                <ImagePlus className="size-5" />{uploading ? "Preparing..." : photos[index] ? "Replace photo" : `Upload ${label.toLowerCase()}`}
              </span>
              <input type="file" accept="image/*" disabled={uploading} onChange={(event) => void upload(event, index)} className="sr-only" />
              {photos[index] && <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />}
            </label>
            {photos[index] && (
              <button type="button" onClick={() => void remove(index)} className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm" aria-label={`Remove ${label}`}>
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {notice && <p className="mt-4 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy">{notice}</p>}
    </section>
  );
}
