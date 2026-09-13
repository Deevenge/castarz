"use client";

import { LoaderCircle, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ensureConversation, type ConversationSeed } from "@/lib/chat";

export function StartChatButton({
  seed,
  label = "Message",
  className = "inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-blue",
}: {
  seed: Omit<ConversationSeed, "starterUid">;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [working, setWorking] = useState(false);

  async function startChat() {
    if (!user || working) return;
    setWorking(true);
    try {
      const conversationId = await ensureConversation({ ...seed, starterUid: user.uid });
      router.push(`/${seed.agencyId === user.uid ? "agent" : "actor"}/inbox?chat=${conversationId}`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <button type="button" disabled={working} onClick={() => void startChat()} className={className} aria-label={label}>
      {working ? <LoaderCircle className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      {label}
    </button>
  );
}
