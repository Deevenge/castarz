"use client";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, MapPin, MessageCircle, WalletCards, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief } from "@/lib/agent-data";
import { db } from "@/lib/firebase";

type Application = {
  id: string;
  briefId: string;
  agencyId: string;
  status: "pending" | "standby" | "selected" | "booked" | "rejected";
};

type Booking = {
  briefTitle: string;
  location: string;
  shootDate: string;
  rate: string;
  agencyName: string;
};

export default function MyApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [briefs, setBriefs] = useState<Record<string, AgentBrief>>({});
  const [bookings, setBookings] = useState<Record<string, Booking>>({});

  useEffect(() => {
    if (!user) return;
    const stopApps = onSnapshot(query(collection(db, "applications"), where("actorUid", "==", user.uid)), async (snapshot) => {
      const apps = snapshot.docs.map((item) => ({
        id: item.id,
        briefId: item.data().briefId as string,
        agencyId: item.data().agencyId as string,
        status: item.data().status as Application["status"],
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

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">MY APPLICATIONS</p>
        <h1 className="mt-1 text-3xl font-bold">Your casting journey.</h1>
        <p className="mt-2 text-slate-600">Follow every application from submission to the final agency decision.</p>
      </header>
      <section className="mt-7 space-y-4">
        {applications.map((application) => {
          const brief = briefs[application.briefId];
          const booking = bookings[application.id];
          const showCastComms = application.status === "booked" && brief?.status === "closed" && (brief.closeMessage || brief.whatsappLink);

          return (
            <article key={application.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70">
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
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Status status={application.status} />
              </div>
            </article>
          );
        })}
        {!applications.length && (
          <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-9 text-brand-blue" />
            <h2 className="mt-4 text-xl font-bold">No applications yet</h2>
            <p className="mt-2 text-slate-600">Explore open opportunities on Home and apply when a role fits.</p>
          </div>
        )}
      </section>
    </div>
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
