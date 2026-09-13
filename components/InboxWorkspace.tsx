"use client";

import { ArrowLeft, ArrowUpRight, Bell, CheckCheck, CheckCircle2, Handshake, LoaderCircle, MessageCircle, Search, Send, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { type InboxItem, useInbox } from "@/hooks/useInbox";
import { type ChatConversation, useChatMessages, useChats } from "@/hooks/useChats";
import { deleteConversationForMe, markConversationRead, sendChatMessage } from "@/lib/chat";
import { db } from "@/lib/firebase";
import type { NotificationType } from "@/lib/notify";

const tone: Record<NotificationType, string> = {
  connection_request: "bg-brand-cyan/20 text-brand-blue",
  connection_approved: "bg-emerald-100 text-emerald-700",
  connection_declined: "bg-slate-100 text-slate-600",
  application_received: "bg-brand-ice text-brand-navy",
  application_shortlisted: "bg-amber-100 text-amber-700",
  application_standby: "bg-amber-100 text-amber-700",
  application_rejected: "bg-red-50 text-red-700",
  booking_confirmed: "bg-emerald-100 text-emerald-700",
  brief_deleted: "bg-red-50 text-red-700",
  brief_closed: "bg-brand-navy text-brand-cyan",
};

const icon: Record<NotificationType, typeof Bell> = {
  connection_request: UserPlus,
  connection_approved: Handshake,
  connection_declined: UserPlus,
  application_received: Sparkles,
  application_shortlisted: Bell,
  application_standby: Bell,
  application_rejected: Bell,
  booking_confirmed: CheckCircle2,
  brief_deleted: X,
  brief_closed: Handshake,
};

const quickPrompts = [
  "Hi, I would love to chat about availability and fit for your next brief.",
  "Thanks for connecting. Can you share what kind of roles you are currently casting?",
  "Great profile. Are you available for a quick casting conversation this week?",
];

type DeleteTarget = {
  kind: "chat" | "notification";
  id: string;
  title: string;
  body: string;
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

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CA";
}

function otherParty(conversation: ChatConversation, uid: string) {
  const isAgent = uid === conversation.agencyId;
  return {
    name: isAgent ? conversation.actorName : conversation.agencyName,
    photo: isAgent ? conversation.actorPhoto : conversation.agencyPhoto,
    role: isAgent ? "Actor" : "Agency",
    profileHref: isAgent ? `/agent/talent/${conversation.actorUid}` : `/actor/agencies/${conversation.agencyId}`,
  };
}

export function InboxWorkspace({ eyebrow, title, empty }: { eyebrow: string; title: string; empty: string }) {
  const searchParams = useSearchParams();
  const requestedChat = searchParams.get("chat") ?? "";
  const { user } = useAuth();
  const [tab, setTab] = useState<"chats" | "notifications">("chats");
  const [selectedChatId, setSelectedChatId] = useState("");
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ignoredRequestedChat, setIgnoredRequestedChat] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const { items, loading: notificationsLoading, error: notificationsError, unreadCount } = useInbox();
  const { conversations, loading: chatsLoading, error: chatsError, unreadChatCount } = useChats();
  const requestedOrSelectedChat = selectedChatId || (requestedChat === ignoredRequestedChat ? "" : requestedChat);
  const activeChatId = conversations.some((item) => item.id === requestedOrSelectedChat) ? requestedOrSelectedChat : "";
  const { messages, messagesLoading, messagesError } = useChatMessages(activeChatId);
  const selectedChat = conversations.find((item) => item.id === activeChatId) ?? null;
  const selectedNotification = selectedNotificationId ? items.find((item) => item.id === selectedNotificationId) ?? null : null;
  const activeConversationId = selectedChat?.id ?? "";

  const filteredConversations = useMemo(() => {
    if (!user) return [];
    const needle = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const party = otherParty(conversation, user.uid);
      return !needle || `${party.name} ${party.role} ${conversation.lastMessage}`.toLowerCase().includes(needle);
    });
  }, [conversations, search, user]);

  useEffect(() => {
    if (!user || !selectedChat) return;
    if (selectedChat.lastSenderUid && selectedChat.lastSenderUid !== user.uid && !selectedChat.readBy.includes(user.uid)) {
      void markConversationRead(selectedChat.id, user.uid);
    }
  }, [selectedChat, user]);

  async function openNotification(item: InboxItem) {
    setSelectedNotificationId(item.id);
    if (item.read) return;
    try {
      await updateDoc(doc(db, "notifications", item.id), { read: true });
    } catch (error) {
      console.error("Unable to mark notification as read.", error);
    }
  }

  function startLongPress(action: () => void) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      action();
    }, 650);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    setTimeout(() => { longPressFired.current = false; }, 120);
  }

  function longPressHandlers(action: () => void) {
    return {
      onPointerDown: () => startLongPress(action),
      onPointerUp: cancelLongPress,
      onPointerLeave: cancelLongPress,
      onPointerCancel: cancelLongPress,
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        action();
      },
    };
  }

  function ignoreClickAfterLongPress(event: MouseEvent) {
    if (!longPressFired.current) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  async function confirmDeleteTarget() {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "chat") {
        await deleteConversationForMe(deleteTarget.id, user.uid);
        if (activeChatId === deleteTarget.id) {
          setIgnoredRequestedChat(requestedChat);
          setSelectedChatId("");
        }
      } else {
        await deleteDoc(doc(db, "notifications", deleteTarget.id));
        if (selectedNotificationId === deleteTarget.id) setSelectedNotificationId(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error("Unable to delete inbox item.", error);
    } finally {
      setDeleting(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !activeConversationId || !draft.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(activeConversationId, user.uid, draft);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  if (chatsLoading || notificationsLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="size-7 animate-spin text-brand-blue" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Private casting conversations, smart follow-ups, and every important update in one polished workspace.</p>
        </div>
        <div className="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-navy/15">
          {unreadChatCount + unreadCount} unread
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-brand-silver/70">
        <button type="button" onClick={() => setTab("chats")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${tab === "chats" ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:bg-brand-ice"}`}>
          <MessageCircle className="size-4" />Chats
          {unreadChatCount > 0 && <span className="rounded-full bg-brand-cyan px-1.5 text-[10px] leading-4 text-brand-navy">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>}
        </button>
        <button type="button" onClick={() => setTab("notifications")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${tab === "notifications" ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:bg-brand-ice"}`}>
          <Bell className="size-4" />Notifications
          {unreadCount > 0 && <span className="rounded-full bg-brand-cyan px-1.5 text-[10px] leading-4 text-brand-navy">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
      </div>

      {tab === "chats" ? (
        chatsError ? (
          <ErrorPanel icon={MessageCircle} title="Chats unavailable" body={chatsError} />
        ) : !conversations.length ? (
          <EmptyChatPanel />
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70 lg:grid lg:min-h-[640px] lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className={`border-b border-brand-silver/70 bg-white lg:block lg:border-b-0 lg:border-r ${selectedChat ? "hidden" : "block"}`}>
              <div className="border-b border-brand-silver/70 p-4">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-h-11 w-full rounded-2xl border border-slate-200 bg-brand-ice/60 pl-10 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                </label>
              </div>
              <div className="max-h-[420px] overflow-y-auto lg:max-h-[580px]">
                {filteredConversations.map((conversation) => {
                  if (!user) return null;
                  const party = otherParty(conversation, user.uid);
                  const unread = Boolean(conversation.lastSenderUid && conversation.lastSenderUid !== user.uid && !conversation.readBy.includes(user.uid));
                  const lastFromMe = conversation.lastSenderUid === user.uid;
                  const status = lastFromMe ? deliveryLabel(conversation, user.uid) : null;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={(event) => { if (!ignoreClickAfterLongPress(event)) setSelectedChatId(conversation.id); }}
                      className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition ${unread ? "bg-brand-ice/80" : "hover:bg-slate-50"}`}
                      {...longPressHandlers(() => setDeleteTarget({ kind: "chat", id: conversation.id, title: party.name, body: "Delete this chat from your inbox. New messages can bring the conversation back." }))}
                    >
                      <Avatar name={party.name} photo={party.photo} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-brand-navy ${unread ? "font-extrabold" : "font-bold"}`}>{party.name}</p>
                          <span className={`text-xs ${unread ? "font-bold text-brand-blue" : "text-slate-400"}`}>{timeLabel(conversation.lastMessageAtMs || conversation.updatedAtMs)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {status && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-blue"><CheckCheck className="size-3.5" />{status}</span>}
                          <p className={`truncate text-sm ${unread ? "font-extrabold text-brand-navy" : "text-slate-500"}`}>{conversation.lastMessage || "Conversation ready"}</p>
                        </div>
                      </div>
                      {unread && <span className="mt-2 flex min-w-5 items-center justify-center rounded-full bg-brand-blue px-1.5 text-[10px] font-bold leading-5 text-white">1</span>}
                    </button>
                  );
                })}
                {!filteredConversations.length && <p className="p-6 text-center text-sm text-slate-500">No conversations match that search.</p>}
              </div>
            </aside>

            {selectedChat && user ? (
              <section className="flex min-h-[620px] flex-col bg-[#fbfcff]">
                <ChatHeader conversation={selectedChat} uid={user.uid} onBack={() => { setIgnoredRequestedChat(requestedChat); setSelectedChatId(""); }} />
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                  {messagesLoading ? (
                    <div className="flex min-h-60 items-center justify-center"><LoaderCircle className="size-6 animate-spin text-brand-blue" /></div>
                  ) : messagesError ? (
                    <ErrorPanel icon={MessageCircle} title="Messages unavailable" body={messagesError} />
                  ) : messages.length ? (
                    messages.map((message, index) => {
                      const mine = message.senderUid === user.uid;
                      const showStatus = mine && index === messages.length - 1;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-[70%] ${mine ? "rounded-br-md bg-brand-blue text-white" : "rounded-bl-md bg-white text-slate-700 ring-1 ring-brand-silver/70"}`}>
                            <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                            <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? "text-white/75" : "text-slate-400"}`}>
                              {timeLabel(message.createdAtMs)}
                              {showStatus && <span className="inline-flex items-center gap-0.5"><CheckCheck className="size-3.5" />{deliveryLabel(selectedChat, user.uid)}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-10 text-center">
                      <div className="flex size-16 items-center justify-center rounded-3xl bg-brand-navy text-brand-cyan shadow-lg shadow-brand-navy/15"><Sparkles className="size-7" /></div>
                      <h2 className="mt-5 text-2xl font-bold text-brand-navy">Start with intent</h2>
                      <p className="mt-2 text-slate-600">Make the first message specific, warm, and casting-ready.</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-brand-silver/70 bg-white p-4 sm:p-5">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {quickPrompts.map((prompt) => (
                      <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="min-h-9 shrink-0 rounded-full border border-brand-silver bg-brand-ice/70 px-3 text-xs font-bold text-brand-navy hover:border-brand-cyan hover:bg-white">
                        {prompt.slice(0, 42)}...
                      </button>
                    ))}
                  </div>
                  <form onSubmit={submitMessage} className="flex items-end gap-2">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} maxLength={1000} placeholder="Write a polished casting message..." className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-brand-ice/50 px-4 py-3 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-4 focus:ring-brand-cyan/20" />
                    <button type="submit" disabled={sending || !draft.trim()} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message">
                      {sending ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}
                    </button>
                  </form>
                </div>
              </section>
            ) : (
              <section className="hidden min-h-[620px] flex-col items-center justify-center bg-[#fbfcff] px-8 text-center lg:flex">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-brand-navy text-brand-cyan shadow-lg shadow-brand-navy/15"><MessageCircle className="size-7" /></div>
                <h2 className="mt-5 text-2xl font-bold text-brand-navy">Select a conversation</h2>
                <p className="mt-2 max-w-sm text-slate-600">Open a person from the chat list to view messages, reply, and mark the conversation as opened.</p>
              </section>
            )}
          </div>
        )
      ) : notificationsError ? (
        <ErrorPanel icon={Bell} title="Inbox unavailable" body={notificationsError} />
      ) : !items.length ? (
        <div className="rounded-[28px] border-2 border-dashed border-brand-silver bg-white p-10 text-center">
          <Bell className="mx-auto size-9 text-brand-blue" />
          <h2 className="mt-4 text-xl font-bold">No notifications yet</h2>
          <p className="mt-2 text-slate-600">{empty}</p>
        </div>
      ) : (
        <>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
          <section>
            <div className="border-b border-brand-silver/60 px-5 py-4">
              <h2 className="font-bold">Notifications</h2>
              <p className="mt-1 text-sm text-slate-500">Tap any update to read the full message and jump into the right workspace.</p>
            </div>
            {items.map((item) => {
              const Icon = icon[item.type];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(event) => { if (!ignoreClickAfterLongPress(event)) void openNotification(item); }}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-brand-ice/70 ${item.read ? "bg-white" : "bg-brand-ice/45"}`}
                  {...longPressHandlers(() => setDeleteTarget({ kind: "notification", id: item.id, title: item.title, body: "Delete this notification from your inbox." }))}
                >
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone[item.type]}`}><Icon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-brand-navy ${item.read ? "font-bold" : "font-extrabold"}`}>{item.title}</p>
                      <span className={`text-xs ${item.read ? "text-slate-400" : "font-bold text-brand-blue"}`}>{timeLabel(item.createdAtMs)}</span>
                    </div>
                    <p className={`mt-1 truncate text-sm ${item.read ? "text-slate-600" : "font-bold text-brand-navy"}`}>{item.body}</p>
                  </div>
                  {!item.read && <span className="size-2 shrink-0 rounded-full bg-brand-blue" />}
                </button>
              );
            })}
          </section>
        </div>
        {selectedNotification && <NotificationDetail item={selectedNotification} close={() => setSelectedNotificationId(null)} />}
        </>
      )}
      {deleteTarget && <DeleteInboxItemDialog target={deleteTarget} deleting={deleting} close={() => setDeleteTarget(null)} confirm={() => void confirmDeleteTarget()} />}
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-sm font-extrabold text-brand-cyan">
      {photo ? <Image src={photo} alt="" fill unoptimized className="object-cover" /> : initials(name)}
    </div>
  );
}

function deliveryLabel(conversation: ChatConversation, uid: string) {
  if (conversation.lastSenderUid !== uid) return "";
  return conversation.readBy.some((readerUid) => readerUid !== uid) ? "Opened" : "Sent";
}

function ChatHeader({ conversation, uid, onBack }: { conversation: ChatConversation; uid: string; onBack: () => void }) {
  const party = otherParty(conversation, uid);
  return (
    <header className="flex items-center justify-between gap-3 border-b border-brand-silver/70 bg-white px-4 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-ice text-brand-navy lg:hidden" aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={party.name} photo={party.photo} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-brand-navy">{party.name}</h2>
          <p className="text-sm font-semibold text-slate-500">{party.role} conversation</p>
        </div>
      </div>
      <Link href={party.profileHref} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-brand-silver px-3 text-sm font-bold text-brand-navy hover:bg-brand-ice">
        Profile <ArrowUpRight className="size-4" />
      </Link>
    </header>
  );
}

function EmptyChatPanel() {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-brand-silver/70">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-brand-navy p-8 text-white sm:p-10">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-brand-cyan text-brand-navy shadow-xl shadow-black/10"><MessageCircle className="size-8" /></div>
          <h2 className="mt-7 text-3xl font-bold tracking-tight">Start the conversation where the casting decision happens.</h2>
          <p className="mt-4 leading-7 text-slate-300">Open an agency or actor profile and use the Message button. CASTARZ will create a private thread instantly for connected talent and agencies.</p>
        </div>
        <div className="p-8 sm:p-10">
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">CASTING CHAT</p>
          <div className="mt-5 space-y-3">
            {["Profile-first messaging", "Unread conversation tracking", "Quick prompts for professional openers", "Booking links and notifications beside chats"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-brand-ice/70 p-4 font-semibold text-brand-navy">
                <CheckCircle2 className="size-5 text-brand-blue" />{item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorPanel({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return (
    <div className="rounded-[28px] border border-red-100 bg-red-50 p-8 text-center text-red-700 shadow-sm">
      <Icon className="mx-auto size-9" />
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm">{body}</p>
    </div>
  );
}

function DeleteInboxItemDialog({ target, deleting, close, confirm }: { target: DeleteTarget; deleting: boolean; close: () => void; confirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-brand-navy/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <Trash2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Delete {target.kind}</p>
            <h2 className="mt-1 truncate text-xl font-bold text-brand-navy">{target.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{target.body}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={close} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={deleting} onClick={confirm} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

function NotificationDetail({ item, close }: { item: InboxItem; close: () => void }) {
  const Icon = icon[item.type];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <article className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-brand-silver/60 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone[item.type]}`}><Icon className="size-5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue">Notification</p>
              <h2 className="mt-1 truncate text-xl font-bold text-brand-navy">{item.title}</h2>
              <p className="text-sm text-slate-500">{timeLabel(item.createdAtMs)}</p>
            </div>
          </div>
          <button type="button" onClick={close} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand-navy hover:bg-slate-100" aria-label="Close notification">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-7 rounded-2xl rounded-tl-sm bg-brand-ice p-5">
          <p className="whitespace-pre-wrap leading-7 text-slate-700">{item.body}</p>
        </div>
        {item.href && (
          item.href.startsWith("http") ? (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">Booked cast communication</p>
              <a href={item.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                <MessageCircle className="size-4" />Join WhatsApp group
              </a>
              <p className="mt-2 break-all text-xs text-emerald-700">{item.href}</p>
            </div>
          ) : (
            <Link href={item.href} className="mt-6 inline-flex min-h-11 w-fit items-center rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
              View more
            </Link>
          )
        )}
      </article>
    </div>
  );
}
