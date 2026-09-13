"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { NotificationType } from "@/lib/notify";

export interface InboxItem {
  id: string;
  recipientUid: string;
  senderUid: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAtMs: number;
}

function asNotificationType(value: unknown): NotificationType {
  const allowed: NotificationType[] = [
    "connection_request",
    "connection_approved",
    "connection_declined",
    "application_received",
    "application_standby",
    "application_rejected",
    "booking_confirmed",
    "brief_closed",
  ];
  return allowed.includes(value as NotificationType) ? (value as NotificationType) : "application_received";
}

export function useInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState("");
  const [loadedUid, setLoadedUid] = useState("");

  useEffect(() => {
    if (!user) return;

    const inboxQuery = query(collection(db, "notifications"), where("recipientUid", "==", user.uid));
    return onSnapshot(inboxQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          recipientUid: typeof data.recipientUid === "string" ? data.recipientUid : "",
          senderUid: typeof data.senderUid === "string" ? data.senderUid : "",
          type: asNotificationType(data.type),
          title: typeof data.title === "string" ? data.title : "CASTARZ update",
          body: typeof data.body === "string" ? data.body : "",
          href: typeof data.href === "string" ? data.href : "",
          read: data.read === true,
          createdAtMs: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0,
        };
      });
      next.sort((left, right) => right.createdAtMs - left.createdAtMs);
      setItems(next);
      setError("");
      setLoadedUid(user.uid);
    }, (snapshotError) => {
      console.error("Unable to load inbox notifications.", snapshotError);
      setItems([]);
      setError("We could not load your inbox. Please check that the latest Firestore rules are published.");
      setLoadedUid(user.uid);
    });
  }, [user]);

  const visibleItems = useMemo(() => user ? items.filter((item) => item.recipientUid === user.uid) : [], [items, user]);
  const unreadCount = useMemo(() => visibleItems.filter((item) => !item.read).length, [visibleItems]);
  return { items: visibleItems, loading: user ? loadedUid !== user.uid && !error : false, unreadCount, error: user ? error : "" };
}
