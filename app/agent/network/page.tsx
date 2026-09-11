"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, CheckCircle2, LoaderCircle, Search, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { directoryActorFromData, matchesQuery, type DirectoryActor } from "@/lib/directory";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

interface Connection { id: string; actorUid: string; status: "pending" | "approved" | "declined"; }
interface ActorCard { uid: string; fullName: string; stageName: string; headshot: string; availabilityStatus: string; }

export default function NetworkPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [actors, setActors] = useState<Record<string, ActorCard>>({});
  const [directory, setDirectory] = useState<DirectoryActor[]>([]);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    const stop = onSnapshot(query(collection(db, "connections"), where("agencyId", "==", user.uid)), async (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, actorUid: item.data().actorUid as string, status: item.data().status as Connection["status"] }));
      setConnections(next);
      const profiles = await Promise.all(next.map(async (connection) => {
        const actor = await getDoc(doc(db, "actors", connection.actorUid));
        const data = actor.data();
        return [connection.actorUid, {
          uid: connection.actorUid,
          fullName: typeof data?.fullName === "string" ? data.fullName : "CASTARZ Actor",
          stageName: typeof data?.stageName === "string" ? data.stageName : "",
          headshot: typeof data?.headshot === "string" ? data.headshot : "",
          availabilityStatus: typeof data?.availabilityStatus === "string" ? data.availabilityStatus : "Availability not set",
        }] as const;
      }));
      setActors(Object.fromEntries(profiles));
    }, () => setNotice("We could not load connection requests."));
    return stop;
  }, [user]);

  useEffect(() => onSnapshot(collection(db, "actors"), (snapshot) => {
    setDirectory(snapshot.docs.map((item) => directoryActorFromData(item.id, item.data())));
  }, () => setNotice("We could not search actors. Publish the latest Firestore rules if this continues.")), []);

  async function decide(connection: Connection, status: "approved" | "declined") {
    if (!user) return;
    setWorking(connection.id);
    setNotice("");
    try {
      await updateDoc(doc(db, "connections", connection.id), { status, decidedAt: serverTimestamp() });
      const actor = actors[connection.actorUid];
      await notifyQuietly({
        recipientUid: connection.actorUid,
        senderUid: user.uid,
        type: status === "approved" ? "connection_approved" : "connection_declined",
        title: status === "approved" ? "You are connected" : "Connection update",
        body: status === "approved"
          ? "An agency approved your request. Their private briefs can now appear in My agencies."
          : "An agency declined your connection request. You can request again later from Network.",
        href: "/actor/network",
      });
      setNotice(status === "approved" ? `${actor?.fullName || "Actor"} approved into your private talent network.` : "Connection request declined.");
    } catch {
      setNotice("We could not update this request. Please try again.");
    } finally {
      setWorking("");
    }
  }

  const pending = connections.filter((connection) => connection.status === "pending");
  const approved = connections.filter((connection) => connection.status === "approved");
  const results = useMemo(
    () => directory.filter((actor) => matchesQuery(search, actor.fullName, actor.stageName, actor.bio, actor.ageRange, actor.hairColor, actor.availabilityStatus)).slice(0, 24),
    [directory, search],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">PRIVATE TALENT NETWORK</p>
        <h1 className="mt-1 text-3xl font-bold">Find talent. Build relationships.</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Search an actor, open their profile, and review photos before you approve them into your network.</p>
      </header>

      <section className="mt-7 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actors by name, look, or availability" className="min-h-12 w-full rounded-full border border-slate-200 bg-brand-ice pl-12 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
        </label>
        <div className="mt-5 space-y-3">
          {(search.trim() ? results : directory.slice(0, 8)).map((actor) => (
            <Link key={actor.uid} href={`/agent/talent/${actor.uid}`} className="flex items-center gap-3 rounded-2xl bg-brand-ice/80 p-3 transition hover:bg-brand-ice">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">
                {actor.headshot ? <img src={actor.headshot} alt="" className="size-full object-cover" /> : <UsersRound className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-brand-navy">{actor.stageName || actor.fullName || "CASTARZ Actor"}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500">{actor.availabilityStatus}{actor.ageRange ? ` · ${actor.ageRange}` : ""}</p>
              </div>
              <span className="text-sm font-bold text-brand-blue">View</span>
            </Link>
          ))}
          {search.trim() && !results.length && <p className="rounded-2xl border-2 border-dashed border-brand-silver p-6 text-center text-sm text-slate-600">No actors match “{search.trim()}”.</p>}
          {!search.trim() && !directory.length && <p className="rounded-2xl border-2 border-dashed border-brand-silver p-6 text-center text-sm text-slate-600">Actors will appear here as they complete their profiles.</p>}
        </div>
      </section>

      {notice && <p className="mt-6 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-brand-silver/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Connection requests</h2>
              <p className="mt-1 text-sm text-slate-600">Open the profile, then approve them into your network.</p>
            </div>
            <span className="rounded-full bg-brand-ice px-3 py-1 text-sm font-bold text-brand-navy">{pending.length} pending</span>
          </div>
          <div className="mt-6 space-y-3">
            {pending.length ? pending.map((connection) => (
              <ActorRow
                key={connection.id}
                actor={actors[connection.actorUid]}
                actions={(
                  <>
                    <button disabled={working === connection.id} onClick={() => decide(connection, "declined")} className="flex size-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
                    <button disabled={working === connection.id} onClick={() => decide(connection, "approved")} className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">{working === connection.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Approve</button>
                  </>
                )}
              />
            )) : (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/50 p-6 text-center">
                <UserPlus className="size-8 text-brand-blue" />
                <p className="mt-3 font-bold">No requests waiting yet</p>
                <p className="mt-1 text-sm text-slate-600">Actors can request a connection from an agency profile.</p>
              </div>
            )}
          </div>
        </div>
        <aside className="rounded-[28px] bg-brand-navy p-6 text-white">
          <ShieldCheck className="size-8 text-brand-cyan" />
          <h2 className="mt-5 text-xl font-bold">A protected network</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">You decide who enters your network. Approved talent is never visible to other agencies.</p>
        </aside>
      </section>

      <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-brand-silver/70">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><UsersRound className="size-5" /></div>
          <div>
            <h2 className="font-bold">Approved talent</h2>
            <p className="text-sm text-slate-600">{approved.length} actor{approved.length === 1 ? "" : "s"} in your network</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {approved.length ? approved.map((connection) => <ActorRow key={connection.id} actor={actors[connection.actorUid]} />) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Approved actors will appear here with their live profile and availability.</p>}
        </div>
      </section>
    </div>
  );
}

function ActorRow({ actor, actions }: { actor?: ActorCard; actions?: React.ReactNode }) {
  const body = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">{actor?.headshot ? <img src={actor.headshot} alt="" className="size-full object-cover" /> : <UsersRound className="size-5" />}</div>
      <div className="min-w-0">
        <p className="truncate font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Loading actor…"}</p>
        <p className="text-sm text-slate-500">{actor?.availabilityStatus || "Loading availability…"}</p>
      </div>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-ice p-4">
      {actor?.uid ? <Link href={`/agent/talent/${actor.uid}`} className="min-w-0 flex-1">{body}</Link> : body}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
