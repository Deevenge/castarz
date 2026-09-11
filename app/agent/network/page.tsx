"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, CheckCircle2, Grid3X3, LoaderCircle, Search, ShieldCheck, Sparkles, UserPlus, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SocialPostComposer } from "@/components/SocialPostComposer";
import { SocialPostGrid } from "@/components/SocialPostGrid";
import { useAuth } from "@/context/AuthContext";
import { actorDisplayName, directoryActorFromData, matchesQuery, type DirectoryActor } from "@/lib/directory";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";
import { socialPostFromDocument, sortPostsNewestFirst, type SocialPost } from "@/lib/social-posts";

interface Connection { id: string; actorUid: string; status: "pending" | "approved" | "declined"; }
interface ActorCard { uid: string; fullName: string; stageName: string; headshot: string; availabilityStatus: string; }

export default function NetworkPage() {
  const { user, profile } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [actors, setActors] = useState<Record<string, ActorCard>>({});
  const [directory, setDirectory] = useState<DirectoryActor[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [search, setSearch] = useState("");
  const [feed, setFeed] = useState<"discover" | "mine">("discover");
  const [agencyName, setAgencyName] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    const stopAgency = onSnapshot(doc(db, "agencies", user.uid), (snapshot) => setAgencyName(typeof snapshot.data()?.name === "string" ? snapshot.data()?.name : ""));
    const stopConnections = onSnapshot(query(collection(db, "connections"), where("agencyId", "==", user.uid)), async (snapshot) => {
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
    return () => {
      stopAgency();
      stopConnections();
    };
  }, [user]);

  useEffect(() => onSnapshot(collection(db, "actors"), (snapshot) => {
    setDirectory(snapshot.docs.map((item) => directoryActorFromData(item.id, item.data())));
  }, () => setNotice("We could not search actors. Publish the latest Firestore rules if this continues.")), []);

  useEffect(() => onSnapshot(query(collection(db, "posts"), where("authorRole", "==", "actor"), where("visibility", "==", "public")), (snapshot) => {
    setPosts(sortPostsNewestFirst(snapshot.docs.map((item) => socialPostFromDocument(item.id, item.data()))));
  }, () => setNotice("We could not load the talent feed. Publish the latest Firestore rules if this continues.")), []);

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
  const approvedActorIds = approved.map((connection) => connection.actorUid);
  const results = useMemo(
    () => directory.filter((actor) => matchesQuery(search, actor.fullName, actor.stageName, actor.bio, actor.ageRange, actor.hairColor, actor.availabilityStatus)).slice(0, 18),
    [directory, search],
  );
  const visiblePosts = feed === "discover" ? posts : posts.filter((post) => approvedActorIds.includes(post.actorUid || post.authorUid));

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">TALENT SOCIAL</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Discover the actors behind the headshots.</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Daily posts, fresh looks, showreel moments, and a search bar when you need to find someone specific.</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-brand-navy shadow-sm ring-1 ring-brand-silver/70">
          {approved.length} in network
        </div>
      </header>

      <section className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.45fr]">
        <div className="space-y-5">
          <SocialPostComposer userUid={user?.uid ?? ""} role="agent" profile={{ name: agencyName || profile?.email || "CASTARZ Agency", photo: "" }} compact />

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-silver/70 sm:p-5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actors by name, look, age range, availability" className="min-h-12 w-full rounded-full border border-slate-200 bg-brand-ice pl-12 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            </label>
            <div className="mt-4">
              {search.trim() ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {results.map((actor) => <SearchActorCard key={actor.uid} actor={actor} />)}
                  {!results.length && <p className="rounded-2xl border-2 border-dashed border-brand-silver p-6 text-center text-sm text-slate-600">No actors match &quot;{search.trim()}&quot;.</p>}
                </div>
              ) : (
                <div className="rounded-2xl bg-brand-ice p-5">
                  <Sparkles className="size-6 text-brand-blue" />
                  <p className="mt-3 font-bold text-brand-navy">Search stays clean until you need it.</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Actors with posts appear in the visual feed. Use search to open any profile, including actors who have not posted yet.</p>
                </div>
              )}
            </div>
          </section>

          {notice && <p className="flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}
        </div>

        <section>
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-white p-1 ring-1 ring-brand-silver/70">
            <button onClick={() => setFeed("discover")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold ${feed === "discover" ? "bg-brand-navy text-white" : "text-slate-500"}`}><Grid3X3 className="size-4" />Discover</button>
            <button onClick={() => setFeed("mine")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold ${feed === "mine" ? "bg-brand-navy text-white" : "text-slate-500"}`}><ShieldCheck className="size-4" />My talent</button>
          </div>
          <SocialPostGrid
            posts={visiblePosts}
            emptyTitle={feed === "discover" ? "No actor posts yet" : "Your talent has not posted yet"}
            emptyCopy={feed === "discover" ? "As actors share photos, TV appearances, set days, and text updates, they will appear here instead of as a plain list." : "Approved actors with social updates will appear here. You can still find everyone through search."}
          />
        </section>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Connection requests</h2>
              <p className="mt-1 text-sm text-slate-600">Approve actors into your private talent network after reviewing their profile.</p>
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
                    <button disabled={working === connection.id} onClick={() => decide(connection, "declined")} className="flex size-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Decline"><X className="size-4" /></button>
                    <button disabled={working === connection.id} onClick={() => decide(connection, "approved")} className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">{working === connection.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Approve</button>
                  </>
                )}
              />
            )) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/50 p-6 text-center">
                <UserPlus className="size-8 text-brand-blue" />
                <p className="mt-3 font-bold">No requests waiting yet</p>
                <p className="mt-1 text-sm text-slate-600">Actors can request a connection from your agency profile.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><UsersRound className="size-5" /></div>
            <div>
              <h2 className="font-bold">Approved talent</h2>
              <p className="text-sm text-slate-600">{approved.length} actor{approved.length === 1 ? "" : "s"} connected</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {approved.length ? approved.slice(0, 6).map((connection) => <ActorRow key={connection.id} actor={actors[connection.actorUid]} />) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Approved actors will appear here with their live profile and availability.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function SearchActorCard({ actor }: { actor: DirectoryActor }) {
  return (
    <Link href={`/agent/talent/${actor.uid}`} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-silver/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-navy/10">
      <div className="aspect-[4/3] bg-brand-ice">
        {actor.headshot ? <img src={actor.headshot} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-brand-blue"><UsersRound className="size-9" /></div>}
      </div>
      <div className="p-4">
        <p className="truncate font-bold text-brand-navy">{actorDisplayName(actor)}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{actor.availabilityStatus}{actor.ageRange ? ` · ${actor.ageRange}` : ""}</p>
      </div>
    </Link>
  );
}

function ActorRow({ actor, actions }: { actor?: ActorCard; actions?: React.ReactNode }) {
  const body = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">{actor?.headshot ? <img src={actor.headshot} alt="" className="size-full object-cover" /> : <UsersRound className="size-5" />}</div>
      <div className="min-w-0">
        <p className="truncate font-bold text-brand-navy">{actor?.stageName || actor?.fullName || "Loading actor..."}</p>
        <p className="text-sm text-slate-500">{actor?.availabilityStatus || "Loading availability..."}</p>
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
