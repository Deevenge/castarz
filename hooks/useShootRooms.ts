"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { normalizeActorProfile, type ActorProfile } from "@/lib/actor-profile";

export interface ShootRoomActor {
  uid: string;
  name: string;
  photo: string;
  bio: string;
  ageRange: string;
  heightCm: string;
  hairColor: string;
  eyeColor: string;
  credits: Array<{ production: string; year: string; role: string; mediaUrl: string; mediaType: "none" | "image" | "video" }>;
  albums: Record<string, string[]>;
}

export interface ShootRoom {
  id: string;
  agencyId: string;
  agencyName: string;
  briefId: string;
  briefTitle: string;
  participantUids: string[];
  actorSummaries: ShootRoomActor[];
  readBy: string[];
  deletedFor: string[];
  lastMessage: string;
  lastSenderUid: string;
  lastMessageAtMs: number;
  updatedAtMs: number;
}

export interface ShootMessage {
  id: string;
  senderUid: string;
  body: string;
  type: "text";
  createdAtMs: number;
}

function toMillis(value: unknown) {
  return typeof (value as { toMillis?: unknown })?.toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : 0;
}

function actorSummaryFromData(value: unknown): ShootRoomActor | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const uid = typeof data.uid === "string" ? data.uid : "";
  if (!uid) return null;
  const rawAlbums = data.albums && typeof data.albums === "object" ? data.albums as Record<string, unknown> : {};
  const albums = Object.fromEntries(Object.entries(rawAlbums).map(([category, photos]) => [
    category,
    Array.isArray(photos) ? photos.filter((photo): photo is string => typeof photo === "string").slice(0, 3) : [],
  ]));
  return {
    uid,
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Booked actor",
    photo: typeof data.photo === "string" ? data.photo : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    ageRange: typeof data.ageRange === "string" ? data.ageRange : "",
    heightCm: typeof data.heightCm === "string" ? data.heightCm : "",
    hairColor: typeof data.hairColor === "string" ? data.hairColor : "",
    eyeColor: typeof data.eyeColor === "string" ? data.eyeColor : "",
    credits: Array.isArray(data.credits) ? data.credits.map((credit) => {
      const item = credit as Record<string, unknown>;
      const mediaType: ShootRoomActor["credits"][number]["mediaType"] = item.mediaType === "image" || item.mediaType === "video" ? item.mediaType : "none";
      return {
        production: typeof item.production === "string" ? item.production : "",
        year: typeof item.year === "string" ? item.year : "",
        role: typeof item.role === "string" ? item.role : "",
        mediaUrl: typeof item.mediaUrl === "string" ? item.mediaUrl : "",
        mediaType,
      };
    }).filter((credit) => credit.production || credit.year || credit.role).slice(0, 8) : [],
    albums,
  };
}

function zCardHasDetails(actor: ShootRoomActor | null) {
  if (!actor) return false;
  return Boolean(actor.bio || actor.ageRange || actor.heightCm || actor.hairColor || actor.eyeColor || actor.credits.length || Object.values(actor.albums).some((photos) => photos.length));
}

function zCardSnapshotFromActor(uid: string, actor: ActorProfile): ShootRoomActor {
  return {
    uid,
    name: actor.stageName || actor.fullName || "Booked actor",
    photo: actor.headshot,
    bio: actor.bio,
    ageRange: actor.ageRange,
    heightCm: actor.heightCm,
    hairColor: actor.hairColor,
    eyeColor: actor.eyeColor,
    credits: actor.credits.slice(0, 8),
    albums: actor.albums,
  };
}

async function hydrateActorZCard(roomId: string, actor: ShootRoomActor) {
  const snapshot = await getDoc(doc(db, "actors", actor.uid));
  if (!snapshot.exists()) return null;
  const profile = zCardSnapshotFromActor(actor.uid, normalizeActorProfile(snapshot.data()));
  await setDoc(doc(db, "shootRooms", roomId, "actorZCards", actor.uid), { ...profile, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
  return profile;
}

export function useShootRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ShootRoom[]>([]);
  const [loadedUid, setLoadedUid] = useState("");
  const [error, setError] = useState("");
  const hydratedOwnZCards = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const roomsQuery = query(collection(db, "shootRooms"), where("participantUids", "array-contains", user.uid));
    return onSnapshot(roomsQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          agencyId: typeof data.agencyId === "string" ? data.agencyId : "",
          agencyName: typeof data.agencyName === "string" ? data.agencyName : "CASTARZ Agency",
          briefId: typeof data.briefId === "string" ? data.briefId : "",
          briefTitle: typeof data.briefTitle === "string" ? data.briefTitle : "Shoot room",
          participantUids: Array.isArray(data.participantUids) ? data.participantUids.filter((uid): uid is string => typeof uid === "string") : [],
          actorSummaries: Array.isArray(data.actorSummaries) ? data.actorSummaries.map(actorSummaryFromData).filter((actor): actor is ShootRoomActor => Boolean(actor)) : [],
          readBy: Array.isArray(data.readBy) ? data.readBy.filter((uid): uid is string => typeof uid === "string") : [],
          deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor.filter((uid): uid is string => typeof uid === "string") : [],
          lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
          lastSenderUid: typeof data.lastSenderUid === "string" ? data.lastSenderUid : "",
          lastMessageAtMs: toMillis(data.lastMessageAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      next.sort((left, right) => (right.lastMessageAtMs || right.updatedAtMs) - (left.lastMessageAtMs || left.updatedAtMs));
      setRooms(next);
      setError("");
      setLoadedUid(user.uid);
    }, (snapshotError) => {
      console.error("Unable to load shoot rooms.", snapshotError);
      setRooms([]);
      setError("We could not load shoot rooms. Please publish the latest Firestore rules if this continues.");
      setLoadedUid(user.uid);
    });
  }, [user]);

  const visibleRooms = useMemo(() => user ? rooms.filter((room) => room.participantUids.includes(user.uid) && !room.deletedFor.includes(user.uid)) : [], [rooms, user]);
  const unreadShootCount = useMemo(() => user ? visibleRooms.filter((room) => room.lastSenderUid && room.lastSenderUid !== user.uid && !room.readBy.includes(user.uid)).length : 0, [visibleRooms, user]);

  useEffect(() => {
    if (!user) return;
    visibleRooms.forEach((room) => {
      const ownSummary = room.actorSummaries.find((actor) => actor.uid === user.uid) ?? null;
      const key = `${room.id}:${user.uid}`;
      if (!ownSummary || zCardHasDetails(ownSummary) || hydratedOwnZCards.current.has(key)) return;
      hydratedOwnZCards.current.add(key);
      void hydrateActorZCard(room.id, ownSummary).catch(() => undefined);
    });
  }, [visibleRooms, user]);

  return {
    rooms: visibleRooms,
    loading: user ? loadedUid !== user.uid && !error : false,
    error: user ? error : "",
    unreadShootCount,
  };
}

export function useShootMessages(activeRoomId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ShootMessage[]>([]);
  const [loadedMessagesFor, setLoadedMessagesFor] = useState("");
  const [messagesError, setMessagesError] = useState("");

  useEffect(() => {
    if (!user || !activeRoomId) return;
    return onSnapshot(collection(db, "shootRooms", activeRoomId, "messages"), (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          senderUid: typeof data.senderUid === "string" ? data.senderUid : "",
          body: typeof data.body === "string" ? data.body : "",
          type: "text" as const,
          createdAtMs: toMillis(data.createdAt),
        };
      });
      next.sort((left, right) => left.createdAtMs - right.createdAtMs);
      setMessages(next);
      setMessagesError("");
      setLoadedMessagesFor(activeRoomId);
    }, (snapshotError) => {
      console.error("Unable to load shoot messages.", snapshotError);
      setMessages([]);
      setMessagesError("Messages could not be loaded for this shoot room.");
      setLoadedMessagesFor(activeRoomId);
    });
  }, [activeRoomId, user]);

  return {
    messages: activeRoomId ? messages : [],
    messagesLoading: Boolean(user && activeRoomId && loadedMessagesFor !== activeRoomId && !messagesError),
    messagesError,
  };
}

export function useShootRoomActorZCard(roomId: string, actor: ShootRoomActor | null) {
  const { user } = useAuth();
  const [zCardResult, setZCardResult] = useState<{ key: string; card: ShootRoomActor | null }>({ key: "", card: null });
  const key = roomId && actor?.uid ? `${roomId}:${actor.uid}` : "";

  useEffect(() => {
    if (!user || !roomId || !actor?.uid) return;
    return onSnapshot(doc(db, "shootRooms", roomId, "actorZCards", actor.uid), (snapshot) => {
      const next = actorSummaryFromData({ ...actor, ...snapshot.data(), uid: actor.uid });
      setZCardResult({ key: `${roomId}:${actor.uid}`, card: next });
      if (!zCardHasDetails(next ?? actor)) {
        void hydrateActorZCard(roomId, actor).then((profile) => {
          if (profile) setZCardResult({ key: `${roomId}:${actor.uid}`, card: profile });
        }).catch(() => undefined);
      }
    }, (snapshotError) => {
      console.error("Unable to load shoot room z-card.", snapshotError);
      setZCardResult({ key: `${roomId}:${actor.uid}`, card: null });
    });
  }, [actor, roomId, user]);

  const zCard = zCardResult.key === key && zCardResult.card ? zCardResult.card : actor;
  return { zCard, loading: Boolean(key && zCardResult.key !== key) };
}
