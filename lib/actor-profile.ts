"use client";

import imageCompression from "browser-image-compression";

export const albumCategories = ["Formal", "Casual", "Commercial", "Fitness"] as const;
export const maxPhotosPerAlbumCategory = 2;
export type AlbumCategory = (typeof albumCategories)[number];
export type AvailabilityStatus = "Available" | "Limited availability" | "Unavailable";

export interface ActorCredit {
  production: string;
  year: string;
  role: string;
}

export interface ActorProfile {
  fullName: string;
  stageName: string;
  bio: string;
  heightCm: string;
  hairColor: string;
  eyeColor: string;
  ageRange: string;
  representationStatus: "Freelancer" | "Multi-Agency" | "Exclusive";
  availabilityStatus: AvailabilityStatus;
  availableFrom: string;
  availabilityNote: string;
  headshot: string;
  banner: string;
  credits: ActorCredit[];
  albums: Record<AlbumCategory, string[]>;
}

export const emptyActorProfile: ActorProfile = {
  fullName: "",
  stageName: "",
  bio: "",
  heightCm: "",
  hairColor: "",
  eyeColor: "",
  ageRange: "",
  representationStatus: "Freelancer",
  availabilityStatus: "Available",
  availableFrom: "",
  availabilityNote: "",
  headshot: "",
  banner: "",
  credits: [],
  albums: { Formal: [], Casual: [], Commercial: [], Fitness: [] },
};

export async function compressImageToDataUrl(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.06,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("We could not read that image."));
    reader.readAsDataURL(compressed);
  });
}

export function normalizeActorProfile(data: Partial<ActorProfile> | undefined): ActorProfile {
  const albums = { ...emptyActorProfile.albums, ...data?.albums };
  const credits = Array.isArray(data?.credits)
    ? data.credits.map((credit) => ({
      production: typeof credit?.production === "string" ? credit.production : "",
      year: typeof credit?.year === "string" ? credit.year : "",
      role: typeof credit?.role === "string" ? credit.role : "",
    })).filter((credit) => credit.production.trim() || credit.year.trim() || credit.role.trim()).slice(0, 12)
    : [];
  return {
    ...emptyActorProfile,
    ...data,
    banner: typeof data?.banner === "string" ? data.banner : "",
    credits,
    albums: Object.fromEntries(albumCategories.map((category) => [category, (albums[category] ?? []).slice(0, maxPhotosPerAlbumCategory)])) as ActorProfile["albums"],
  };
}
