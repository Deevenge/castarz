"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { AlertTriangle, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Radio, Trash2, WalletCards, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";
import { notifyQuietly, sendNotification } from "@/lib/notify";

type ApplicationStatus = "pending" | "standby" | "selected" | "booked" | "rejected" | "cancelled" | "replacement_available";

type Application = {
  id: string;
  briefId: string;
  agencyId: string;
  status: ApplicationStatus;
  actorDeleted: boolean;
  cancelReason: string;
  replacementRequestId: string;
  replacementOriginalStatus: ApplicationStatus | "";
};

type Booking = {
  briefTitle: string;
  location: string;
  shootDate: string;
  rate: string;
  agencyName: string;
};

type JourneyTab = "active" | "booked" | "notSelected";

const replacementCancelReasons = [
  "No longer available",
  "Transport issue",
  "Illness",
  "No response",
  "Agency removed",
  "Other",
];

export default function MyApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [briefs, setBriefs] = useState<Record<string, AgentBrief>>({});
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [tab, setTab] = useState<JourneyTab>("active");
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Application | null>(null);
  const [hiding, setHiding] = useState(false);
  const [replacementWorkingId, setReplacementWorkingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    const stopApps = onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), async (snapshot) => {
      const apps: Application[] = snapshot.docs.map((item) => {
        const status = item.data().status;
        const replacementOriginalStatus = item.data().replacementOriginalStatus;
        return {
          id: item.id,
          briefId: item.data().briefId as string,
          agencyId: item.data().agencyId as string,
          status: isApplicationStatus(status) ? status : "pending",
          actorDeleted: item.data().actorDeleted === true,
          cancelReason: typeof item.data().cancelReason === "string" ? item.data().cancelReason : "",
          replacementRequestId: typeof item.data().replacementRequestId === "string" ? item.data().replacementRequestId : "",
          replacementOriginalStatus: isApplicationStatus(replacementOriginalStatus) ? replacementOriginalStatus : "",
        };
      });
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
  const activeApplications = useMemo(() => visibleApplications.filter((application) => application.status === "pending" || application.status === "standby" || application.status === "selected" || application.status === "replacement_available"), [visibleApplications]);
  const bookedApplications = useMemo(() => visibleApplications.filter((application) => application.status === "booked"), [visibleApplications]);
  const notSelectedApplications = useMemo(() => visibleApplications.filter((application) => application.status === "rejected" || application.status === "cancelled"), [visibleApplications]);
  const displayedApplications = tab === "booked" ? bookedApplications : tab === "notSelected" ? notSelectedApplications : activeApplications;

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

  async function cancelBookingForReplacement(application: Application, reason: string) {
    if (!user) return;
    const brief = briefs[application.briefId];
    const finalReason = reason.trim();
    if (!brief || !finalReason) return;
    const replacementRequestId = `replacement_${application.id}_${Date.now()}`;
    const deadline = defaultReplacementDeadline();
    setReplacementWorkingId(application.id);
    setNotice("");
    try {
      const actorSnapshot = await getDoc(doc(db, "actors", user.uid));
      const actorData = actorSnapshot.data();
      const actorName = typeof actorData?.stageName === "string" && actorData.stageName.trim()
        ? actorData.stageName
        : typeof actorData?.fullName === "string" && actorData.fullName.trim()
          ? actorData.fullName
          : "A booked actor";
      const batch = writeBatch(db);
      batch.update(doc(db, "applications", application.id), {
        status: "cancelled",
        cancelReason: finalReason,
        cancelledAt: serverTimestamp(),
        replacementRequestId,
        replacementDeadlineAt: deadline,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, "briefs", application.briefId), {
        replacementOpen: true,
        replacementRequestId,
        replacementReason: finalReason,
        replacementDeadlineAt: deadline,
        replacementCancelledActorUid: user.uid,
        replacementCancelledApplicationId: application.id,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setCancelTarget(null);
      try {
        await sendNotification({
          recipientUid: application.agencyId,
          senderUid: user.uid,
          type: "replacement_needed",
          title: `${actorName} wants to cancel: ${brief.title}`,
          body: `${actorName} requested a replacement for ${brief.title}. Reason: ${finalReason}. Open Casting Briefs to review the replacement pool and choose the final actor by ${formatDate(deadline)}.`,
          href: `/agent/briefs?replacement=${encodeURIComponent(application.briefId)}`,
          applicationId: application.id,
          briefId: application.briefId,
        });
        setNotice("Your agency has been alerted and a replacement slot is open.");
      } catch (notificationError) {
        console.error("Replacement slot opened, but notification failed.", notificationError);
        setNotice("Replacement slot opened, but the inbox alert was blocked. Publish the latest Firestore rules, then ask the agency to open Casting Briefs.");
      }
    } catch (error) {
      console.error("Unable to request replacement.", error);
      setNotice("We could not request a replacement. Please check that the latest Firestore rules are published, then try again.");
    } finally {
      setReplacementWorkingId("");
    }
  }

  async function offerAsReplacement(application: Application) {
    if (!user) return;
    const brief = briefs[application.briefId];
    if (!brief?.replacementOpen || !brief.replacementRequestId) return;
    setReplacementWorkingId(application.id);
    setNotice("");
    try {
      await updateDoc(doc(db, "applications", application.id), {
        status: "replacement_available",
        replacementRequestId: brief.replacementRequestId,
        replacementOriginalStatus: application.status,
        replacementAvailableAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await notifyQuietly({
        recipientUid: application.agencyId,
        senderUid: user.uid,
        type: "replacement_available",
        title: `Available as replacement: ${brief.title}`,
        body: `An actor has confirmed they are available as an emergency replacement for ${brief.title}.`,
        href: `/agent/briefs?replacement=${encodeURIComponent(application.briefId)}`,
        applicationId: application.id,
        briefId: application.briefId,
      });
      setNotice("You are in the replacement queue. The agency will confirm if they choose you.");
    } catch {
      setNotice("We could not send your availability. Please try again.");
    } finally {
      setReplacementWorkingId("");
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
      {notice && <p className="mt-5 flex items-center gap-2 rounded-2xl bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"><Radio className="size-4 text-brand-blue" />{notice}</p>}
      <section className="mt-7 space-y-4">
        {displayedApplications.map((application) => {
          const brief = briefs[application.briefId];
          const booking = bookings[application.id];
          const showCastComms = application.status === "booked" && brief?.status === "closed" && (brief.closeMessage || brief.whatsappLink || brief.shootRoomId);
          const canRequestReplacement = application.status === "booked" && brief?.status === "closed";
          const canOfferReplacement = Boolean(
            user &&
            brief?.replacementOpen &&
            brief.replacementRequestId &&
            brief.replacementCancelledActorUid !== user.uid &&
            application.status !== "booked" &&
            application.status !== "cancelled" &&
            application.status !== "replacement_available",
          );

          return (
            <article
              key={application.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 transition hover:shadow-lg hover:shadow-brand-navy/5"
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

                  {canRequestReplacement && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 font-bold text-red-800"><AlertTriangle className="size-4" />Can’t make this shoot?</p>
                          <p className="mt-1 text-sm leading-6 text-red-700">Cancel with a reason and CASTARZ will open an emergency replacement slot for your agency.</p>
                        </div>
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setCancelTarget(application);
                          }}
                          className="inline-flex min-h-11 items-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
                        >
                          Request replacement
                        </button>
                      </div>
                    </div>
                  )}

                  {canOfferReplacement && (
                    <div className="mt-4 rounded-2xl border border-brand-cyan/40 bg-brand-ice p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-bold text-brand-navy"><Radio className="size-4 text-brand-blue" />Emergency replacement slot</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {brief?.title || "This brief"} needs a replacement{brief?.replacementDeadlineAt ? ` by ${formatTimestamp(brief.replacementDeadlineAt)}` : ""}. Match notes: {brief?.ageRange || "age range open"} · {brief?.location || "location to confirm"}.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={replacementWorkingId === application.id}
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            void offerAsReplacement(application);
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy disabled:opacity-60"
                        >
                          {replacementWorkingId === application.id ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                          I’m available
                        </button>
                      </div>
                    </div>
                  )}

                  {application.status === "replacement_available" && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                      You’re in the emergency replacement queue. The agency will confirm the replacement booking if they select you.
                    </div>
                  )}
                </div>
                <Status status={application.status} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-400">Remove only hides this item from your journey history.</p>
                <button type="button" onClick={() => setDeleteTarget(application)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="size-3.5" />Remove
                </button>
              </div>
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
      {cancelTarget && (
        <CancelReplacementDialog
          application={cancelTarget}
          title={briefs[cancelTarget.briefId]?.title || bookings[cancelTarget.id]?.briefTitle || "this shoot"}
          working={replacementWorkingId === cancelTarget.id}
          close={() => setCancelTarget(null)}
          confirm={(reason) => void cancelBookingForReplacement(cancelTarget, reason)}
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
  const style = status === "booked" ? "bg-emerald-50 text-emerald-700" : status === "rejected" || status === "cancelled" ? "bg-red-50 text-red-700" : status === "standby" || status === "selected" ? "bg-amber-50 text-amber-700" : status === "replacement_available" ? "bg-brand-ice text-brand-blue" : "bg-brand-ice text-brand-navy";
  const Icon = status === "booked" ? CheckCircle2 : status === "rejected" || status === "cancelled" ? XCircle : status === "replacement_available" ? Radio : Clock3;
  return <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${style}`}><Icon className="size-4" />{statusLabel(status)}</span>;
}

function statusCopy(status: Application["status"]) {
  return status === "booked"
    ? "Congratulations, your agency has booked you for this brief. More final details should follow in less than 24hrs, so stay on the lookout for the WhatsApp link or production message."
    : status === "cancelled"
      ? "You cancelled this booking and your agency was alerted to find a replacement."
      : status === "replacement_available"
        ? "You have raised your hand as an emergency replacement. The agency will confirm if they select you."
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
  return status === "pending"
    ? "Under review"
    : status === "standby" || status === "selected"
      ? "Shortlisted"
      : status === "booked"
        ? "Booked"
        : status === "cancelled"
          ? "Cancelled"
          : status === "replacement_available"
            ? "Available"
            : "Not selected";
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return value === "pending"
    || value === "standby"
    || value === "selected"
    || value === "booked"
    || value === "rejected"
    || value === "cancelled"
    || value === "replacement_available";
}

function defaultReplacementDeadline() {
  const deadline = new Date();
  deadline.setHours(18, 0, 0, 0);
  if (deadline.getTime() <= Date.now()) deadline.setTime(Date.now() + 2 * 60 * 60 * 1000);
  return deadline;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTimestamp(value: AgentBrief["replacementDeadlineAt"]) {
  const date = value?.toDate?.();
  return date ? formatDate(date) : "the agency deadline";
}

function CancelReplacementDialog({ application, title, working, close, confirm }: { application: Application; title: string; working: boolean; close: () => void; confirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const typedReason = customReason.trim();
  const finalReason = reason === "Other" ? typedReason : typedReason || reason;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Request replacement</p>
            <h2 className="mt-1 truncate text-xl font-bold text-brand-navy">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">This cancels your booking, alerts the agency, and opens a replacement pool. Please give a clear reason.</p>
          </div>
          <button type="button" onClick={close} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand-navy hover:bg-slate-100" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {replacementCancelReasons.map((item) => (
            <button key={item} type="button" onClick={() => setReason(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${reason === item ? "bg-brand-navy text-white" : "bg-brand-ice text-brand-navy hover:bg-brand-cyan/20"}`}>
              {item}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{reason === "Other" ? "Reason" : "Add details or type your reason"}</span>
          <textarea value={customReason} onChange={(event) => setCustomReason(event.target.value)} rows={3} placeholder="Briefly explain why you need to cancel." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
        </label>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={close} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Keep booking</button>
          <button type="button" disabled={working || !finalReason} onClick={() => confirm(finalReason)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {working ? <LoaderCircle className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
            {working ? "Opening slot..." : "Open replacement"}
          </button>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">Application record: {application.id}</p>
      </section>
    </div>
  );
}
