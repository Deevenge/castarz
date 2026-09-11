"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { Camera, LoaderCircle, LogOut, PencilLine } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";
import { ProfileTabs } from "@/components/ProfileChrome";
import { useAuth } from "@/context/AuthContext";
import { compressImageToDataUrl, emptyActorProfile, normalizeActorProfile, type ActorProfile } from "@/lib/actor-profile";
import { actorCover, actorDisplayName } from "@/lib/directory";
import { db } from "@/lib/firebase";

export default function ActorAccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [actor, setActor] = useState<ActorProfile>(emptyActorProfile);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "actors", user.uid), (snapshot) => {
      setActor(normalizeActorProfile(snapshot.data() as Partial<ActorProfile> | undefined));
    });
  }, [user]);

  async function uploadHeadshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const headshot = await compressImageToDataUrl(file);
      await setDoc(doc(db, "actors", user.uid), { headshot, updatedAt: serverTimestamp() }, { merge: true });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/auth");
  }

  const photosTab = pathname.startsWith("/actor/account/albums");
  const name = actorDisplayName(actor);
  const cover = actorCover(actor);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
        <div className="relative h-44 bg-gradient-to-br from-brand-navy via-brand-blue to-[#8eb0ff] sm:h-52">
          {cover ? <Image src={cover} alt="" fill unoptimized className="object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/50 via-transparent to-black/10" />
        </div>
        <div className="px-4 sm:px-6">
          <div className="relative -mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3">
              <label className="relative size-28 shrink-0 cursor-pointer overflow-hidden rounded-full bg-brand-ice ring-4 ring-white sm:size-32">
                {actor.headshot ? <Image src={actor.headshot} alt={name} fill unoptimized className="object-cover" /> : <span className="flex size-full items-center justify-center text-3xl font-extrabold text-brand-blue">{name.slice(0, 1).toUpperCase()}</span>}
                <span className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-brand-navy text-white shadow-md">
                  {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />}
                </span>
                <input type="file" accept="image/*" onChange={(event) => void uploadHeadshot(event)} className="sr-only" />
              </label>
              <div className="min-w-0 pb-1">
                <p className="text-xs font-bold tracking-[0.16em] text-brand-blue">ACCOUNT</p>
                <h1 className="truncate text-2xl font-bold text-brand-navy">{name === "CASTARZ Actor" ? "Your profile" : name}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">{actor.availabilityStatus} · {actor.representationStatus}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              <Link href={photosTab ? "/actor/account" : "/actor/account/albums"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ice px-4 text-sm font-bold text-brand-navy">
                <PencilLine className="size-4" />{photosTab ? "Edit profile" : "Manage photos"}
              </Link>
              <button type="button" onClick={() => void handleSignOut()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700">
                <LogOut className="size-4" />Log out
              </button>
            </div>
          </div>
          <ProfileTabs
            tabs={[
              { href: "/actor/account", label: "Profile", active: !photosTab },
              { href: "/actor/account/albums", label: "Albums", active: photosTab },
            ]}
          />
        </div>
      </section>
      <div className="mt-5">{children}</div>
    </div>
  );
}
