"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, CheckCircle2, LoaderCircle, Search, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

interface Connection { id: string; actorUid: string; status: "pending" | "approved" | "declined"; }
interface ActorCard { uid: string; fullName: string; stageName: string; headshot: string; availabilityStatus: string; }

export default function NetworkPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [actors, setActors] = useState<Record<string, ActorCard>>({});
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!user) return; const stop = onSnapshot(query(collection(db, "connections"), where("agencyId", "==", user.uid)), async (snapshot) => { const next = snapshot.docs.map((item) => ({ id: item.id, actorUid: item.data().actorUid as string, status: item.data().status as Connection["status"] })); setConnections(next); const profiles = await Promise.all(next.map(async (connection) => { const actor = await getDoc(doc(db, "actors", connection.actorUid)); const data = actor.data(); return [connection.actorUid, { uid: connection.actorUid, fullName: typeof data?.fullName === "string" ? data.fullName : "CASTARZ Actor", stageName: typeof data?.stageName === "string" ? data.stageName : "", headshot: typeof data?.headshot === "string" ? data.headshot : "", availabilityStatus: typeof data?.availabilityStatus === "string" ? data.availabilityStatus : "Availability not set" }] as const; })); setActors(Object.fromEntries(profiles)); }, () => setNotice("We could not load connection requests.")); return stop; }, [user]);
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
          : "An agency declined your connection request. You can request again later from your profile.",
        href: "/actor/profile",
      });
      setNotice(status === "approved" ? `${actor?.fullName || "Actor"} approved into your private talent network.` : "Connection request declined.");
    } catch {
      setNotice("We could not update this request. Please try again.");
    } finally {
      setWorking("");
    }
  }
  const pending = connections.filter((connection) => connection.status === "pending"); const approved = connections.filter((connection) => connection.status === "approved");
  return <div className="mx-auto max-w-5xl"><header><p className="text-sm font-bold tracking-[0.18em] text-brand-blue">PRIVATE TALENT NETWORK</p><h1 className="mt-1 text-3xl font-bold">Your talent. Your relationships.</h1><p className="mt-2 max-w-2xl text-slate-600">Approve actors into a private network that no other agency can browse.</p></header>{notice && <p className="mt-6 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}<section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-brand-silver/70"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Connection requests</h2><p className="mt-1 text-sm text-slate-600">Review the actor before adding them to your network.</p></div><span className="rounded-full bg-brand-ice px-3 py-1 text-sm font-bold text-brand-navy">{pending.length} pending</span></div><div className="mt-6 space-y-3">{pending.length ? pending.map((connection) => <ActorRow key={connection.id} actor={actors[connection.actorUid]} actions={<><button disabled={working === connection.id} onClick={() => decide(connection, "declined")} className="flex size-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button><button disabled={working === connection.id} onClick={() => decide(connection, "approved")} className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">{working === connection.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Approve</button></>} />) : <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/50 p-6 text-center"><UserPlus className="size-8 text-brand-blue" /><p className="mt-3 font-bold">No requests waiting yet</p><p className="mt-1 text-sm text-slate-600">Actors can request a connection from their profile.</p></div>}</div></div><aside className="rounded-3xl bg-brand-navy p-6 text-white"><ShieldCheck className="size-8 text-brand-cyan" /><h2 className="mt-5 text-xl font-bold">A protected network</h2><p className="mt-3 text-sm leading-6 text-slate-300">You decide who enters your network. Your approved talent is never visible to other agencies.</p></aside></section><section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-brand-silver/70"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><UsersRound className="size-5" /></div><div><h2 className="font-bold">Approved talent</h2><p className="text-sm text-slate-600">{approved.length} actor{approved.length === 1 ? "" : "s"} in your network</p></div></div><Search className="size-5 text-brand-blue" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{approved.length ? approved.map((connection) => <ActorRow key={connection.id} actor={actors[connection.actorUid]} />) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Approved actors will appear here with their live profile and availability.</p>}</div></section></div>;
}
function ActorRow({ actor, actions }: { actor?: ActorCard; actions?: React.ReactNode }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-ice p-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">{actor?.headshot ? <img src={actor.headshot} alt="" className="size-full object-cover" /> : <UsersRound className="size-5" />}</div><div><p className="font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Loading actor…"}</p><p className="text-sm text-slate-500">{actor?.availabilityStatus || "Loading availability…"}</p></div></div>{actions && <div className="flex items-center gap-2">{actions}</div>}</div>; }
