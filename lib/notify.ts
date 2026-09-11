"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationType =
  | "connection_request"
  | "connection_approved"
  | "connection_declined"
  | "application_received"
  | "application_standby"
  | "application_rejected"
  | "booking_confirmed";

export interface NotificationPayload {
  recipientUid: string;
  senderUid: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
}

export async function sendNotification(payload: NotificationPayload) {
  if (!payload.recipientUid || payload.recipientUid === payload.senderUid) return;
  await addDoc(collection(db, "notifications"), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyQuietly(payload: NotificationPayload) {
  try {
    await sendNotification(payload);
  } catch (error) {
    console.error("Unable to send notification.", error);
  }
}
