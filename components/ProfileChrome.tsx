"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronLeft, ImagePlus, LoaderCircle, UserRound } from "lucide-react";
import { type ChangeEvent, type ReactNode } from "react";
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
  if (!photos.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/40 text-center">
        <ImagePlus className="size-7 text-brand-blue" />
        <p className="mt-2 text-sm font-semibold text-slate-600">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {photos.map((photo, index) => (
        <figure key={`${photo.slice(-20)}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-brand-ice">
          <Image src={photo} alt="" fill unoptimized className="object-cover" />
        </figure>
      ))}
    </div>
  );
}

export function AgencyHeroCard({
  name,
  username,
  backHref,
  actions,
  footer,
}: {
  name: string;
  username?: string;
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
            <div className="flex size-28 shrink-0 items-center justify-center rounded-full bg-brand-navy text-2xl font-extrabold text-brand-cyan ring-4 ring-white sm:size-32">
              {name.slice(0, 2).toUpperCase()}
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
