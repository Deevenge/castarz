"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Building2, Check, LoaderCircle, Search, Send, UserMinus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

type ConnectionStatus = "pending" | "approved" | "declined" | "withdrawn";
interface Agency { id: string; name: string; email: string; username: string; description: string; }
interface Connection { id: string; agencyId: string; status: ConnectionStatus; }

export function AgencyConnections() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [notice, setNotice] = useState("");
  const [actorName, setActorName] = useState("An actor");

  useEffect(() => onSnapshot(collection(db, "agencies"), (snapshot) => {
    setAgencies(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: typeof data.name === "string" && data.name.trim() ? data.name : "CASTARZ Agency",
        email: typeof data.email === "string" ? data.email : "",
        username: typeof data.username === "string" ? data.username : "",
        description: typeof data.description === "string" ? data.description : "Casting agency on CASTARZ",
      };
    }));
  }), []);

  useEffect(() => {
    if (!user) return;
    const stopConnections = onSnapshot(query(collection(db, "connections"), where("actorUid", "==", user.uid)), (snapshot) => {
      setConnections(snapshot.docs.map((item) => ({
        id: item.id,
        agencyId: String(item.data().agencyId ?? ""),
        status: (item.data().status as ConnectionStatus) || "pending",
      })));
    });
    const stopActor = onSnapshot(doc(db, "actors", user.uid), (snapshot) => {
      const name = snapshot.data()?.fullName;
      if (typeof name === "string" && name.trim()) setActorName(name);
    });
    return () => { stopConnections(); stopActor(); };
  }, [user]);

  const byAgency = useMemo(() => Object.fromEntries(connections.map((item) => [item.agencyId, item])), [connections]);
  const visible = agencies.filter((agency) => {
    const haystack = `${agency.name} ${agency.username} ${agency.description}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  async function connect(agency: Agency) {
    if (!user) return;
    setWorkingId(agency.id);
    setNotice("");
    try {
      await setDoc(doc(db, "connections", `${agency.id}_${user.uid}`), {
        agencyId: agency.id,
        actorUid: user.uid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await notifyQuietly({
        recipientUid: agency.id,
        senderUid: user.uid,
        type: "connection_request",
        title: "New connection request",
        body: `${actorName} wants to join your private talent network.`,
        href: "/agent/network",
      });
      setNotice(`Request sent to ${agency.name}. They will review your profile.`);
    } catch {
      setNotice("We could not send that request. Please try again.");
    } finally {
      setWorkingId("");
    }
  }

  async function withdraw(agency: Agency) {
    if (!user) return;
    setWorkingId(agency.id);
    setNotice("");
    try {
      await setDoc(doc(db, "connections", `${agency.id}_${user.uid}`), {
        agencyId: agency.id,
        actorUid: user.uid,
        status: "withdrawn",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice(`Request to ${agency.name} was withdrawn.`);
    } catch {
      setNotice("We could not withdraw that request.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-slate-600">Search an agency, open their profile, then connect. You will see their briefs, about info, and live roles.</p>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agencies by name" className="min-h-12 w-full rounded-full border border-slate-200 bg-brand-ice pl-10 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
        </label>
      </div>
      {notice && <p className="mt-5 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy">{notice}</p>}
      <div className="mt-5 space-y-3">
        {visible.length ? visible.map((agency) => {
          const connection = byAgency[agency.id];
          const status = connection?.status;
          const pending = status === "pending";
          const connected = status === "approved";
          const busy = workingId === agency.id;
          return (
            <article key={agency.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-brand-ice/80 to-white p-4">
              <Link href={`/actor/agencies/${agency.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-sm font-extrabold text-brand-cyan">{agency.name.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-brand-navy">{agency.name}</p>
                    {connected && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Connected</span>}
                    {pending && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Pending</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{agency.username ? `@${agency.username}` : agency.email}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{agency.description}</p>
                </div>
              </Link>
              {connected ? (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700"><Check className="size-4" />Connected</span>
              ) : pending ? (
                <button type="button" disabled={busy} onClick={() => void withdraw(agency)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-white">
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <UserMinus className="size-4" />}Withdraw
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => void connect(agency)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {status === "declined" || status === "withdrawn" ? "Request again" : "Connect"}
                </button>
              )}
            </article>
          );
        }) : (
          <div className="rounded-2xl border-2 border-dashed border-brand-silver p-6 text-center text-sm text-slate-600">
            {search ? "No agencies match that search." : "No agencies have joined CASTARZ yet. Check back soon."}
          </div>
        )}
      </div>
      {!agencies.length && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Building2 className="size-3.5" />Agencies appear here once they complete their agency profile.</p>
      )}
    </section>
  );
}
