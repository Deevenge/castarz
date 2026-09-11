"use client";

import imageCompression from "browser-image-compression";

export const albumCategories = ["Formal", "Casual", "Commercial", "Fitness"] as const;
export type AlbumCategory = (typeof albumCategories)[number];
export type AvailabilityStatus = "Available" | "Limited availability" | "Unavailable";

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
  return {
    ...emptyActorProfile,
    ...data,
    albums: { ...emptyActorProfile.albums, ...data?.albums },
  };
}
