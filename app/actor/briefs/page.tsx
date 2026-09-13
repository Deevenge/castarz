"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Trash2, WalletCards, X, XCircle } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";

type Application = {
  id: string;
  briefId: string;
  agencyId: string;
  status: "pending" | "standby" | "selected" | "booked" | "rejected";
  actorDeleted: boolean;
};

type Booking = {
  briefTitle: string;
  location: string;
  shootDate: string;
  rate: string;
  agencyName: string;
};

type JourneyTab = "active" | "booked" | "notSelected";

export default function MyApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [briefs, setBriefs] = useState<Record<string, AgentBrief>>({});
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [tab, setTab] = useState<JourneyTab>("active");
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [hiding, setHiding] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    if (!user) return;
    const stopApps = onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), async (snapshot) => {
      const apps = snapshot.docs.map((item) => ({
        id: item.id,
        briefId: item.data().briefId as string,
        agencyId: item.data().agencyId as string,
        status: item.data().status as Application["status"],
        actorDeleted: item.data().actorDeleted === true,
      }));
      setApplications(apps);
      const pairs = await Promise.all(apps.map(async (application) => {
        const brief = await getDoc(doc(db, "briefs", application.briefId));
        return [application.briefId, brief.exists() ? briefFromDocument(brief.id, brief.data()) : undefined] as const;
      }));
      setBriefs(Object.fromEntries(pairs.filter((pair): pair is [string, AgentBrief] => Boolean(pair[1]))));
    });
    const stopBookings = onSnapshot(query(collection(db, "bookings"), where("actorUid", "==", user.uid)), (snapshot) => {
      setBookings(Object.fromEntries(snapshot.docs.map((item) => {
        const data = item.data();
        return [item.id, {
          briefTitle: typeof data.briefTitle === "string" ? data.briefTitle : "",
          location: typeof data.location === "string" ? data.location : "",
          shootDate: typeof data.shootDate === "string" ? data.shootDate : "",
          rate: typeof data.rate === "string" ? data.rate : "",
          agencyName: typeof data.agencyName === "string" ? data.agencyName : "",
        }];
      })));
    });
    return () => {
      stopApps();
      stopBookings();
    };
  }, [user]);

  const visibleApplications = useMemo(() => applications.filter((application) => !application.actorDeleted), [applications]);
  const activeApplications = useMemo(() => visibleApplications.filter((application) => application.status === "pending" || application.status === "standby" || application.status === "selected"), [visibleApplications]);
  const bookedApplications = useMemo(() => visibleApplications.filter((application) => application.status === "booked"), [visibleApplications]);
  const notSelectedApplications = useMemo(() => visibleApplications.filter((application) => application.status === "rejected"), [visibleApplications]);
  const displayedApplications = tab === "booked" ? bookedApplications : tab === "notSelected" ? notSelectedApplications : activeApplications;

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

  async function hideJourneyItem() {
    if (!deleteTarget) return;
    setHiding(true);
    try {
      await updateDoc(doc(db, "applications", deleteTarget.id), {
        actorDeleted: true,
        actorDeletedAt: serverTimestamp(),
      });
      setDeleteTarget(null);
    } finally {
      setHiding(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">MY APPLICATIONS</p>
        <h1 className="mt-1 text-3xl font-bold">Your casting journey.</h1>
        <p className="mt-2 text-slate-600">Follow every application from submission to the final agency decision.</p>
      </header>
      <nav className="mt-6 grid gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-brand-silver/70 sm:grid-cols-3">
        <JourneyTabButton icon={Clock3} label="Active" count={activeApplications.length} active={tab === "active"} choose={() => setTab("active")} />
        <JourneyTabButton icon={CheckCircle2} label="Booked" count={bookedApplications.length} active={tab === "booked"} choose={() => setTab("booked")} />
        <JourneyTabButton icon={XCircle} label="Not selected" count={notSelectedApplications.length} active={tab === "notSelected"} choose={() => setTab("notSelected")} />
      </nav>
      <section className="mt-7 space-y-4">
        {displayedApplications.map((application) => {
          const brief = briefs[application.briefId];
          const booking = bookings[application.id];
          const showCastComms = application.status === "booked" && brief?.status === "closed" && (brief.closeMessage || brief.whatsappLink || brief.shootRoomId);

          return (
            <article
              key={application.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 transition hover:shadow-lg hover:shadow-brand-navy/5"
              {...longPressHandlers(() => setDeleteTarget(application))}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brand-blue">{brief?.agencyName || booking?.agencyName || "Casting agency"}</p>
                  <h2 className="mt-1 text-xl font-bold text-brand-navy">{brief?.title || "Loading brief..."}</h2>
                  <p className="mt-2 text-sm text-slate-600">{statusCopy(application.status)}</p>

                  {application.status === "booked" && booking && (
                    <div className="mt-4 grid gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                      <p className="flex items-center gap-2"><MapPin className="size-4" />{booking.location || "Location to follow"}</p>
                      <p className="flex items-center gap-2"><CalendarDays className="size-4" />{booking.shootDate || "Date to follow"}</p>
                      <p className="flex items-center gap-2"><WalletCards className="size-4" />{booking.rate || "Rate to follow"}</p>
                    </div>
                  )}

                  {showCastComms && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><MessageCircle className="size-5" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-brand-navy">Booked cast communication</p>
                          {brief.closeMessage && <p className="mt-1 text-sm leading-6 text-slate-600">{brief.closeMessage}</p>}
                          {brief.whatsappLink && (
                            <>
                              <a href={brief.whatsappLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                                <MessageCircle className="size-4" />Join WhatsApp group
                              </a>
                              <p className="mt-2 break-all text-xs text-emerald-700">{brief.whatsappLink}</p>
                            </>
                          )}
                          {!brief.whatsappLink && brief.shootRoomId && (
                            <Link href={`/actor/inbox?shoot=${brief.shootRoomId}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
                              <MessageCircle className="size-4" />Open shoot room
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Status status={application.status} />
              </div>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">Press and hold to remove this item from your journey history.</p>
            </article>
          );
        })}
        {!displayedApplications.length && (
          <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-9 text-brand-blue" />
            <h2 className="mt-4 text-xl font-bold">{emptyTitle(tab)}</h2>
            <p className="mt-2 text-slate-600">{emptyCopy(tab)}</p>
          </div>
        )}
      </section>
      {deleteTarget && (
        <DeleteJourneyDialog
          application={deleteTarget}
          title={briefs[deleteTarget.briefId]?.title || bookings[deleteTarget.id]?.briefTitle || "this application"}
          hiding={hiding}
          close={() => setDeleteTarget(null)}
          confirm={() => void hideJourneyItem()}
        />
      )}
    </div>
  );
}

function JourneyTabButton({ icon: Icon, label, count, active, choose }: { icon: typeof Clock3; label: string; count: number; active: boolean; choose: () => void }) {
  return (
    <button type="button" onClick={choose} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${active ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:bg-brand-ice hover:text-brand-navy"}`}>
      <Icon className="size-4" />
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-brand-cyan text-brand-navy" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );
}

function Status({ status }: { status: Application["status"] }) {
  const style = status === "booked" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "standby" || status === "selected" ? "bg-amber-50 text-amber-700" : "bg-brand-ice text-brand-navy";
  const Icon = status === "booked" ? CheckCircle2 : status === "rejected" ? XCircle : Clock3;
  return <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${style}`}><Icon className="size-4" />{status === "pending" ? "Under review" : status === "standby" || status === "selected" ? "Shortlisted" : status === "booked" ? "Booked" : "Not selected"}</span>;
}

function statusCopy(status: Application["status"]) {
  return status === "booked"
    ? "Congratulations, your agency has booked you for this brief. More final details should follow in less than 24hrs, so stay on the lookout for the WhatsApp link or production message."
    : status === "rejected"
      ? "The agency has completed this selection. Keep your profile current for the next opportunity."
      : status === "standby" || status === "selected"
        ? "You have been shortlisted. Keep your availability close and stay on the lookout for the final booking update."
        : "Your application has been received and is waiting for agency review.";
}

function emptyTitle(tab: JourneyTab) {
  return tab === "booked" ? "No booked shoots yet" : tab === "notSelected" ? "No not-selected history" : "No active applications";
}

function emptyCopy(tab: JourneyTab) {
  return tab === "booked"
    ? "Booked shoots will appear here once an agency confirms you in the final cast."
    : tab === "notSelected"
      ? "Final decisions you did not make will appear here, unless you remove them from your history."
      : "Explore open opportunities on Home and apply when a role fits.";
}

function DeleteJourneyDialog({ application, title, hiding, close, confirm }: { application: Application; title: string; hiding: boolean; close: () => void; confirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Remove history</p>
              <h2 className="mt-1 truncate text-xl font-bold text-brand-navy">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">This removes the {statusLabel(application.status).toLowerCase()} item from your journey screen only. The agency record stays intact.</p>
            </div>
          </div>
          <button type="button" onClick={close} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand-navy hover:bg-slate-100" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={close} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={hiding} onClick={confirm} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {hiding ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {hiding ? "Removing..." : "Remove"}
          </button>
        </div>
      </section>
    </div>
  );
}

function statusLabel(status: Application["status"]) {
  return status === "pending" ? "Under review" : status === "standby" || status === "selected" ? "Shortlisted" : status === "booked" ? "Booked" : "Not selected";
}
