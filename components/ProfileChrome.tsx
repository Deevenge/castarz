"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronLeft, ChevronRight, Download, ImagePlus, LoaderCircle, Maximize2, UserRound, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { actorCover, actorDisplayName, type DirectoryActor } from "@/lib/directory";

export function ProfileCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-brand-navy via-brand-blue to-[#8eb0ff] sm:h-56">
      {src ? <Image src={src} alt={alt} fill unoptimized className="object-cover" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/55 via-brand-navy/10 to-transparent" />
    </div>
  );
}

export function ProfileAvatar({ src, name, onUpload }: { src: string; name: string; onUpload?: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-ice ring-4 ring-white sm:size-32">
      {src ? <Image src={src} alt={name} fill unoptimized className="object-cover" /> : <UserRound className="m-auto size-12 text-brand-blue" />}
      {onUpload && (
        <label className="absolute bottom-1 right-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-brand-navy text-white shadow-lg">
          <Camera className="size-4" />
          <input type="file" accept="image/*" onChange={onUpload} className="sr-only" />
        </label>
      )}
    </div>
  );
}

export function ProfileTabs({ tabs }: { tabs: Array<{ href?: string; label: string; active: boolean; onClick?: () => void }> }) {
  return (
    <div className="mt-4 flex gap-1 border-t border-slate-100">
      {tabs.map((tab) => {
        const className = `relative flex min-h-12 flex-1 items-center justify-center text-sm font-bold ${tab.active ? "text-brand-blue" : "text-slate-500"}`;
        const underline = tab.active ? <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-brand-blue" /> : null;
        if (tab.href) {
          return (
            <Link key={tab.label} href={tab.href} className={className}>
              {tab.label}{underline}
            </Link>
          );
        }
        return (
          <button type="button" key={tab.label} onClick={tab.onClick} className={className}>
            {tab.label}{underline}
          </button>
        );
      })}
    </div>
  );
}

export function ActorHeroCard({
  actor,
  backHref,
  actions,
  onUploadHeadshot,
  footer,
}: {
  actor: DirectoryActor;
  backHref?: string;
  actions?: ReactNode;
  onUploadHeadshot?: (event: ChangeEvent<HTMLInputElement>) => void;
  footer?: ReactNode;
}) {
  const name = actorDisplayName(actor);
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
      <ProfileCover src={actorCover(actor)} alt="" />
      {backHref && (
        <Link href={backHref} className="absolute left-3 top-3 z-10 inline-flex min-h-10 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold text-brand-navy shadow-sm">
          <ChevronLeft className="size-4" />Back
        </Link>
      )}
      <div className="px-4 pb-2 sm:px-6">
        <div className="relative -mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3">
            <ProfileAvatar src={actor.headshot} name={name} onUpload={onUploadHeadshot} />
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold tracking-tight text-brand-navy">{name}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {actor.availabilityStatus || "Availability not set"}
                {actor.representationStatus ? ` · ${actor.representationStatus}` : ""}
              </p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2 pb-1">{actions}</div>}
        </div>
        {footer}
      </div>
    </section>
  );
}

export function SpecChips({ actor }: { actor: DirectoryActor }) {
  const chips = [
    actor.ageRange,
    actor.heightCm && `${actor.heightCm} cm`,
    actor.hairColor,
    actor.eyeColor,
    actor.availableFrom && `From ${actor.availableFrom}`,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-brand-ice px-3 py-1.5 text-xs font-bold text-brand-navy">{chip}</span>
      ))}
    </div>
  );
}

export function PhotoGrid({ photos, emptyLabel }: { photos: string[]; emptyLabel: string }) {
  const [viewer, setViewer] = useState<number | null>(null);
  const activePhoto = viewer === null ? "" : photos[viewer];

  if (!photos.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/40 text-center">
        <ImagePlus className="size-7 text-brand-blue" />
        <p className="mt-2 text-sm font-semibold text-slate-600">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        {photos.map((photo, index) => (
          <button type="button" key={`${photo.slice(-20)}-${index}`} onClick={() => setViewer(index)} className="group relative aspect-square overflow-hidden bg-brand-ice text-left first:rounded-tl-2xl last:rounded-br-2xl">
            <Image src={photo} alt="" fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 text-white transition group-hover:bg-brand-navy/35">
              <Maximize2 className="size-6 opacity-0 transition group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>
      {activePhoto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
          <div className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white">{(viewer ?? 0) + 1} / {photos.length}</div>
          <button type="button" onClick={() => setViewer(null)} className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close photo"><X className="size-6" /></button>
          <a href={activePhoto} download="castarz-portfolio-photo.jpg" className="absolute right-20 top-5 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Download photo"><Download className="size-5" /></a>
          <button type="button" onClick={() => setViewer((current) => current === null ? null : (current - 1 + photos.length) % photos.length)} className="absolute left-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-8" aria-label="Previous photo"><ChevronLeft className="size-7" /></button>
          <div className="max-h-[82dvh] max-w-[88vw] overflow-auto rounded-2xl">
            <Image src={activePhoto} alt="Portfolio photo" width={1200} height={1200} unoptimized className="h-auto max-h-[82dvh] w-auto max-w-full cursor-zoom-in rounded-2xl object-contain transition-transform hover:scale-125" />
          </div>
          <button type="button" onClick={() => setViewer((current) => current === null ? null : (current + 1) % photos.length)} className="absolute right-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-8" aria-label="Next photo"><ChevronRight className="size-7" /></button>
        </div>
      )}
    </>
  );
}

export function AgencyHeroCard({
  name,
  username,
  photo,
  backHref,
  actions,
  footer,
}: {
  name: string;
  username?: string;
  photo?: string;
  backHref?: string;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
      <div className="h-44 bg-gradient-to-br from-brand-navy via-[#12305f] to-brand-blue sm:h-52" />
      {backHref && (
        <Link href={backHref} className="absolute left-3 top-3 z-10 inline-flex min-h-10 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold text-brand-navy shadow-sm">
          <ChevronLeft className="size-4" />Back
        </Link>
      )}
      <div className="px-4 pb-2 sm:px-6">
        <div className="relative -mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3">
            <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-navy text-2xl font-extrabold text-brand-cyan ring-4 ring-white sm:size-32">
              {photo ? <Image src={photo} alt={name} fill unoptimized className="object-cover" /> : name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold tracking-tight text-brand-navy">{name}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">{username ? `@${username}` : "Casting agency"}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2 pb-1">{actions}</div>}
        </div>
        {footer}
      </div>
    </section>
  );
}

export function LoadingScreen() {
  return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;
}
