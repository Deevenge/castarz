"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

export interface ShootRoomActor {
  uid: string;
  name: string;
  photo: string;
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
  return {
    uid,
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Booked actor",
    photo: typeof data.photo === "string" ? data.photo : "",
  };
}

export function useShootRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ShootRoom[]>([]);
  const [loadedUid, setLoadedUid] = useState("");
  const [error, setError] = useState("");

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
