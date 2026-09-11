"use client";

import { Bell, CheckCircle2, Handshake, LoaderCircle, MessageCircle, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { type InboxItem, useInbox } from "@/hooks/useInbox";
import { db } from "@/lib/firebase";
import type { NotificationType } from "@/lib/notify";

const tone: Record<NotificationType, string> = {
  connection_request: "bg-brand-cyan/20 text-brand-blue",
  connection_approved: "bg-emerald-100 text-emerald-700",
  connection_declined: "bg-slate-100 text-slate-600",
  application_received: "bg-brand-ice text-brand-navy",
  application_standby: "bg-amber-100 text-amber-700",
  application_rejected: "bg-red-50 text-red-700",
  booking_confirmed: "bg-emerald-100 text-emerald-700",
};

const icon: Record<NotificationType, typeof Bell> = {
  connection_request: UserPlus,
  connection_approved: Handshake,
  connection_declined: UserPlus,
  application_received: Sparkles,
  application_standby: Bell,
  application_rejected: Bell,
  booking_confirmed: CheckCircle2,
};

function timeLabel(ms: number) {
  if (!ms) return "Just now";
  const delta = Date.now() - ms;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString();
}

export function InboxWorkspace({ eyebrow, title, empty }: { eyebrow: string; title: string; empty: string }) {
  const { items, loading } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  async function openItem(item: InboxItem) {
    setSelectedId(item.id);
    if (item.read) return;
    try {
      await updateDoc(doc(db, "notifications", item.id), { read: true });
    } catch (error) {
      console.error("Unable to mark notification as read.", error);
    }
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-slate-600">Live updates from connections, applications, and bookings.</p>
      </header>
      {!items.length ? (
        <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
          <MessageCircle className="mx-auto size-9 text-brand-blue" />
          <h2 className="mt-4 text-xl font-bold">You are all caught up</h2>
          <p className="mt-2 text-slate-600">{empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-brand-silver/70 md:grid md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.3fr)]">
          <section className="border-b border-brand-silver/60 md:border-b-0 md:border-r">
            <div className="border-b border-brand-silver/60 px-5 py-4">
              <h2 className="font-bold">Inbox</h2>
            </div>
            {items.map((item) => {
              const Icon = icon[item.type];
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openItem(item)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition ${active ? "bg-brand-ice" : "hover:bg-slate-50"}`}
                >
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone[item.type]}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-brand-navy">{item.title}</p>
                      <span className="text-xs text-slate-400">{timeLabel(item.createdAtMs)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{item.body}</p>
                  </div>
                  {!item.read && <span className="size-2 shrink-0 rounded-full bg-brand-blue" />}
                </button>
              );
            })}
          </section>
          {selected && (
            <article className="flex min-h-[380px] flex-col p-6 sm:p-8">
              <div className="flex items-center gap-3 border-b border-brand-silver/60 pb-5">
                <div className={`flex size-12 items-center justify-center rounded-2xl ${tone[selected.type]}`}>
                  {(() => { const Icon = icon[selected.type]; return <Icon className="size-5" />; })()}
                </div>
                <div>
                  <p className="font-bold text-brand-navy">{selected.title}</p>
                  <p className="text-sm text-slate-500">{timeLabel(selected.createdAtMs)}</p>
                </div>
              </div>
              <div className="mt-7 max-w-lg rounded-2xl rounded-tl-sm bg-brand-ice p-5">
                <p className="leading-6 text-slate-700">{selected.body}</p>
              </div>
              {selected.href && (
                <Link href={selected.href} className="mt-6 inline-flex min-h-11 w-fit items-center rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
                  Open related workspace
                </Link>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  );
}
