"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

export interface ChatConversation {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyPhoto: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  participantUids: string[];
  readBy: string[];
  lastMessage: string;
  lastSenderUid: string;
  lastMessageAtMs: number;
  updatedAtMs: number;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  body: string;
  type: "text";
  createdAtMs: number;
}

function toMillis(value: unknown) {
  return typeof (value as { toMillis?: unknown })?.toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : 0;
}

export function useChats(activeConversationId?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadedUid, setLoadedUid] = useState("");
  const [loadedMessagesFor, setLoadedMessagesFor] = useState("");
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");

  useEffect(() => {
    if (!user) return;

    const conversationsQuery = query(collection(db, "conversations"), where("participantUids", "array-contains", user.uid));
    return onSnapshot(conversationsQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          agencyId: typeof data.agencyId === "string" ? data.agencyId : "",
          agencyName: typeof data.agencyName === "string" ? data.agencyName : "CASTARZ Agency",
          agencyPhoto: typeof data.agencyPhoto === "string" ? data.agencyPhoto : "",
          actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
          actorName: typeof data.actorName === "string" ? data.actorName : "CASTARZ Actor",
          actorPhoto: typeof data.actorPhoto === "string" ? data.actorPhoto : "",
          participantUids: Array.isArray(data.participantUids) ? data.participantUids.filter((uid): uid is string => typeof uid === "string") : [],
          readBy: Array.isArray(data.readBy) ? data.readBy.filter((uid): uid is string => typeof uid === "string") : [],
          lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
          lastSenderUid: typeof data.lastSenderUid === "string" ? data.lastSenderUid : "",
          lastMessageAtMs: toMillis(data.lastMessageAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      next.sort((left, right) => (right.lastMessageAtMs || right.updatedAtMs) - (left.lastMessageAtMs || left.updatedAtMs));
      setConversations(next);
      setError("");
      setLoadedUid(user.uid);
    }, (snapshotError) => {
      console.error("Unable to load chat conversations.", snapshotError);
      setConversations([]);
      setError("We could not load your chats. Please publish the latest Firestore rules if this continues.");
      setLoadedUid(user.uid);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !activeConversationId) return;

    return onSnapshot(collection(db, "conversations", activeConversationId, "messages"), (snapshot) => {
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
      setLoadedMessagesFor(activeConversationId);
    }, (snapshotError) => {
      console.error("Unable to load chat messages.", snapshotError);
      setMessages([]);
      setMessagesError("Messages could not be loaded for this conversation.");
      setLoadedMessagesFor(activeConversationId);
    });
  }, [activeConversationId, user]);

  const visibleConversations = useMemo(() => user ? conversations.filter((item) => item.participantUids.includes(user.uid)) : [], [conversations, user]);
  const unreadChatCount = useMemo(() => user ? visibleConversations.filter((item) => item.lastSenderUid && item.lastSenderUid !== user.uid && !item.readBy.includes(user.uid)).length : 0, [visibleConversations, user]);

  return {
    conversations: visibleConversations,
    messages: activeConversationId ? messages : [],
    loading: user ? loadedUid !== user.uid && !error : false,
    messagesLoading: Boolean(user && activeConversationId && loadedMessagesFor !== activeConversationId && !messagesError),
    error: user ? error : "",
    messagesError,
    unreadChatCount,
  };
}
