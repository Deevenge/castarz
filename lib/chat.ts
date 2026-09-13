"use client";

import { addDoc, arrayUnion, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ConversationSeed {
  agencyId: string;
  agencyName: string;
  agencyPhoto: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  starterUid: string;
}

export function conversationIdFor(agencyId: string, actorUid: string) {
  return `${agencyId}_${actorUid}`;
}

export async function ensureConversation(seed: ConversationSeed) {
  const conversationId = conversationIdFor(seed.agencyId, seed.actorUid);
  const conversationRef = doc(db, "conversations", conversationId);
  const existing = await getDoc(conversationRef);

  if (existing.exists()) return conversationId;

  await setDoc(conversationRef, {
    agencyId: seed.agencyId,
    agencyName: seed.agencyName,
    agencyPhoto: seed.agencyPhoto,
    actorUid: seed.actorUid,
    actorName: seed.actorName,
    actorPhoto: seed.actorPhoto,
    participantUids: [seed.agencyId, seed.actorUid],
    readBy: [seed.starterUid],
    lastMessage: "",
    lastSenderUid: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return conversationId;
}

export async function sendChatMessage(conversationId: string, senderUid: string, body: string) {
  const text = body.trim();
  if (!text) return;

  const conversationRef = doc(db, "conversations", conversationId);
  await addDoc(collection(conversationRef, "messages"), {
    senderUid,
    body: text,
    type: "text",
    createdAt: serverTimestamp(),
  });
  await updateDoc(conversationRef, {
    lastMessage: text,
    lastSenderUid: senderUid,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: [senderUid],
    deletedFor: [],
  });
}

export async function markConversationRead(conversationId: string, uid: string) {
  await updateDoc(doc(db, "conversations", conversationId), {
    readBy: arrayUnion(uid),
  });
}

export async function deleteConversationForMe(conversationId: string, uid: string) {
  await updateDoc(doc(db, "conversations", conversationId), {
    deletedFor: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}
