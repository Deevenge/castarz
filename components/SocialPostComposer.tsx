"use client";

import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ImagePlus, LoaderCircle, PlaySquare, Send, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { compressImageToDataUrl } from "@/lib/actor-profile";
import { db } from "@/lib/firebase";
import { type SocialPostRole } from "@/lib/social-posts";

type ComposerProfile = {
  name: string;
  photo: string;
};

export function SocialPostComposer({ userUid, role, profile, compact = false }: { userUid: string; role: SocialPostRole; profile: ComposerProfile; compact?: boolean }) {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userUid || (!caption.trim() && !image && !videoUrl.trim())) {
      setNotice("Add a thought, photo, or video link before posting.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const mediaUrl = image || videoUrl.trim();
      const mediaType = image ? "image" : videoUrl.trim() ? "video" : "none";
      const fallbackName = role === "agent" ? "CASTARZ Agency" : "CASTARZ Actor";
      const savedProfile = await getDoc(doc(db, role === "agent" ? "agencies" : "actors", userUid));
      const data = savedProfile.data();
      const authorName = typeof data?.name === "string" && data.name.trim()
        ? data.name
        : typeof data?.stageName === "string" && data.stageName.trim()
          ? data.stageName
          : typeof data?.fullName === "string" && data.fullName.trim()
            ? data.fullName
            : profile.name || fallbackName;
      const authorPhoto = typeof data?.photo === "string" && data.photo
        ? data.photo
        : typeof data?.headshot === "string" && data.headshot
          ? data.headshot
          : profile.photo;

      await addDoc(collection(db, "posts"), {
        authorUid: userUid,
        authorRole: role,
        authorName,
        authorPhoto,
        actorUid: role === "actor" ? userUid : "",
        agencyId: role === "agent" ? userUid : "",
        caption: caption.trim(),
        mediaUrl,
        mediaType,
        visibility: "public",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCaption("");
      setImage("");
      setVideoUrl("");
      setNotice("Posted to the CASTARZ feed.");
    } catch {
      setNotice("We could not publish this post. Check that the latest Firestore rules are live.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    setNotice("");
    try {
      setImage(await compressImageToDataUrl(file));
      setVideoUrl("");
    } catch {
      setNotice("We could not prepare that image.");
    }
  }

  return (
    <form onSubmit={publish} className={`rounded-2xl bg-white shadow-sm ring-1 ring-brand-silver/70 ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-sm font-extrabold text-white">
          {profile.photo ? <img src={profile.photo} alt="" className="size-full object-cover" /> : (profile.name || "C").slice(0, 1).toUpperCase()}
        </div>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Post caption</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={compact ? 2 : 3}
            maxLength={360}
            placeholder={role === "agent" ? "Share new work, cast wins, behind-the-scenes moments..." : "Share a set day, new look, reel update, or what you are working on..."}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-brand-ice/70 px-4 py-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20"
          />
        </label>
      </div>

      {image && (
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-100">
          <img src={image} alt="" className="max-h-80 w-full object-cover" />
          <button type="button" onClick={() => setImage("")} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-brand-navy shadow-sm" aria-label="Remove image">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand-navy hover:bg-brand-ice">
          <ImagePlus className="size-4 text-brand-blue" />
          Photo
          <input type="file" accept="image/*" onChange={(event) => void chooseImage(event.target.files?.[0])} className="sr-only" />
        </label>
        <label className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand-navy">
          <PlaySquare className="size-4 shrink-0 text-brand-blue" />
          <input
            value={videoUrl}
            disabled={Boolean(image)}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="Video link"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
        </label>
        <button disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy disabled:opacity-60">
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          Post
        </button>
      </div>

      {notice && <p className="mt-3 text-sm font-semibold text-brand-blue">{notice}</p>}
    </form>
  );
}
