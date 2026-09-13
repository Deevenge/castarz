import { type DocumentData } from "firebase/firestore";
import { emptyActorProfile, normalizeActorProfile, type ActorProfile } from "@/lib/actor-profile";

export interface DirectoryActor extends ActorProfile {
  uid: string;
}

export interface DirectoryAgency {
  id: string;
  name: string;
  email: string;
  username: string;
  description: string;
  photo: string;
  banner: string;
}

export function directoryActorFromData(uid: string, data: DocumentData | undefined): DirectoryActor {
  return { uid, ...normalizeActorProfile(data as Partial<ActorProfile> | undefined) };
}

export function directoryAgencyFromData(id: string, data: DocumentData | undefined): DirectoryAgency {
  return {
    id,
    name: typeof data?.name === "string" && data.name.trim() ? data.name : "CASTARZ Agency",
    email: typeof data?.email === "string" ? data.email : "",
    username: typeof data?.username === "string" ? data.username : "",
    description: typeof data?.description === "string" && data.description.trim() ? data.description : "Casting agency on CASTARZ",
    photo: typeof data?.photo === "string" ? data.photo : "",
    banner: typeof data?.banner === "string" ? data.banner : "",
  };
}

export function searchHaystack(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function matchesQuery(query: string, ...parts: Array<string | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return searchHaystack(...parts).includes(needle);
}

export function actorDisplayName(actor: Pick<DirectoryActor, "fullName" | "stageName">) {
  return actor.stageName || actor.fullName || "CASTARZ Actor";
}

export function actorCover(actor: Pick<DirectoryActor, "banner" | "headshot" | "albums">) {
  return actor.banner || actor.albums.Formal[1] || actor.albums.Casual[1] || actor.albums.Commercial[1] || actor.albums.Fitness[1] || actor.headshot;
}

export const emptyDirectoryActor: DirectoryActor = { uid: "", ...emptyActorProfile };
