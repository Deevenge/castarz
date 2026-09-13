"use client";

import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function sendShootMessage(roomId: string, senderUid: string, body: string) {
  const text = body.trim();
  if (!text) return;

  const roomRef = doc(db, "shootRooms", roomId);
  await addDoc(collection(roomRef, "messages"), {
    senderUid,
    body: text,
    type: "text",
    createdAt: serverTimestamp(),
  });
  await updateDoc(roomRef, {
    lastMessage: text,
    lastSenderUid: senderUid,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: [senderUid],
    deletedFor: [],
  });
}

export async function markShootRoomRead(roomId: string, uid: string) {
  await updateDoc(doc(db, "shootRooms", roomId), {
    readBy: arrayUnion(uid),
  });
}

export async function deleteShootRoomForMe(roomId: string, uid: string) {
  await updateDoc(doc(db, "shootRooms", roomId), {
    deletedFor: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}
