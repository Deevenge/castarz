"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

export type ConnectionStatus = "pending" | "approved" | "declined" | "withdrawn";

export function connectionDocId(agencyId: string, actorUid: string) {
  return `${agencyId}_${actorUid}`;
}

export async function requestAgencyConnection(options: {
  agencyId: string;
  agencyName: string;
  actorUid: string;
  actorName: string;
}) {
  await setDoc(doc(db, "connections", connectionDocId(options.agencyId, options.actorUid)), {
    agencyId: options.agencyId,
    actorUid: options.actorUid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await notifyQuietly({
    recipientUid: options.agencyId,
    senderUid: options.actorUid,
    type: "connection_request",
    title: "New connection request",
    body: `${options.actorName} wants to join your private talent network.`,
    href: "/agent/network",
  });
}

export async function withdrawAgencyConnection(agencyId: string, actorUid: string) {
  await setDoc(doc(db, "connections", connectionDocId(agencyId, actorUid)), {
    agencyId,
    actorUid,
    status: "withdrawn",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
