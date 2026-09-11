"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Building2, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

interface Agency { id: string; name: string; email: string; }

export function AgencyConnections() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [requestIds, setRequestIds] = useState<string[]>([]);
  const [sending, setSending] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { const stop = onSnapshot(query(collection(db, "agencies")), (snapshot) => setAgencies(snapshot.docs.map((item) => ({ id: item.id, name: typeof item.data().name === "string" ? item.data().name : "CASTARZ Agency", email: typeof item.data().email === "string" ? item.data().email : "" })))); return stop; }, []);
  useEffect(() => { if (!user) return; const stop = onSnapshot(query(collection(db, "connections"), where("actorUid", "==", user.uid)), (snapshot) => setRequestIds(snapshot.docs.map((item) => item.id))); return stop; }, [user]);
  async function request(agency: Agency) { if (!user) return; setSending(agency.id); setNotice(""); try { await setDoc(doc(db, "connections", `${agency.id}_${user.uid}`), { agencyId: agency.id, actorUid: user.uid, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setNotice(`Connection request sent to ${agency.name}.`); } catch { setNotice("We could not send your request. Please try again."); } finally { setSending(""); } }
  return <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-7"><div><p className="text-sm font-bold tracking-[0.14em] text-brand-blue">AGENCY CONNECTIONS</p><h2 className="mt-1 text-xl font-bold">Choose who represents you.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Request a connection with an agency. They review your profile before adding you to their private network.</p></div>{notice && <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}<div className="mt-5 space-y-3">{agencies.length ? agencies.map((agency) => { const requested = requestIds.includes(`${agency.id}_${user?.uid}`); return <div key={agency.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-ice p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-brand-navy text-brand-cyan"><Building2 className="size-5" /></div><div><p className="font-bold text-brand-navy">{agency.name}</p><p className="text-sm text-slate-500">{agency.email}</p></div></div><button type="button" disabled={requested || sending === agency.id} onClick={() => request(agency)} className={`flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ${requested ? "bg-emerald-50 text-emerald-700" : "bg-brand-blue text-white hover:bg-brand-navy"}`}>{sending === agency.id ? <LoaderCircle className="size-4 animate-spin" /> : requested ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}{requested ? "Request sent" : "Request connection"}</button></div>; }) : <div className="rounded-2xl border-2 border-dashed border-brand-silver p-5 text-center text-sm text-slate-600">No agencies have joined CASTARZ yet. Check back soon.</div>}</div></section>;
}
