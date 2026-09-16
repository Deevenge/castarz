"use client";

import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, CheckCircle2, Grid3X3, LoaderCircle, Search, ShieldCheck, Sparkles, UserPlus, UsersRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/ProfileChrome";
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
  const [panel, setPanel] = useState<"requests" | "approved" | "">("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyPhoto, setAgencyPhoto] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    const stopAgency = onSnapshot(doc(db, "agencies", user.uid), (snapshot) => {
      setAgencyName(typeof snapshot.data()?.name === "string" ? snapshot.data()?.name : "");
      setAgencyPhoto(typeof snapshot.data()?.photo === "string" ? snapshot.data()?.photo : "");
    });
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
        connectionId: connection.id,
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
        <div className="flex items-center gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-brand-silver/70">
          <button type="button" onClick={() => setPanel((current) => current === "requests" ? "" : "requests")} className={`relative flex size-11 cursor-pointer items-center justify-center rounded-xl transition ${panel === "requests" ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-ice"}`} aria-label="Connection requests">
            <UserPlus className="size-5" />
            {pending.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand-cyan px-1 text-[11px] font-black leading-5 text-brand-navy">{pending.length}</span>}
          </button>
          <button type="button" onClick={() => setPanel((current) => current === "approved" ? "" : "approved")} className={`relative flex size-11 cursor-pointer items-center justify-center rounded-xl transition ${panel === "approved" ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-ice"}`} aria-label="Approved talent">
            <UsersRound className="size-5" />
            {approved.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand-ice px-1 text-[11px] font-black leading-5 text-brand-navy ring-1 ring-brand-silver">{approved.length}</span>}
          </button>
        </div>
      </header>

      <section className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.45fr]">
        <div className="space-y-5">
          <SocialPostComposer userUid={user?.uid ?? ""} role="agent" profile={{ name: agencyName || profile?.email || "CASTARZ Agency", photo: agencyPhoto }} compact />

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
            currentUserUid={user?.uid ?? ""}
            currentUserName={agencyName || profile?.email || "CASTARZ Agency"}
            allowManage
            emptyTitle={feed === "discover" ? "No actor posts yet" : "Your talent has not posted yet"}
            emptyCopy={feed === "discover" ? "As actors share photos, TV appearances, set days, and text updates, they will appear here instead of as a plain list." : "Approved actors with social updates will appear here. You can still find everyone through search."}
          />
        </section>
      </section>
      {panel && (
        <TalentDrawer
          panel={panel}
          pending={pending}
          approved={approved}
          actors={actors}
          working={working}
          onClose={() => setPanel("")}
          onDecide={decide}
        />
      )}
    </div>
  );
}

function TalentDrawer({ panel, pending, approved, actors, working, onClose, onDecide }: { panel: "requests" | "approved"; pending: Connection[]; approved: Connection[]; actors: Record<string, ActorCard>; working: string; onClose: () => void; onDecide: (connection: Connection, status: "approved" | "declined") => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-navy/45 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="hidden flex-1 cursor-default sm:block" onClick={onClose} aria-label="Close talent panel" />
      <section className="flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl sm:rounded-l-[28px]">
        <header className="border-b border-brand-silver/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">{panel === "requests" ? "Requests" : "Network"}</p>
              <h2 className="mt-1 text-2xl font-bold text-brand-navy">{panel === "requests" ? "Connection requests" : "Approved talent"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{panel === "requests" ? "Review actors asking to join your agency network." : "Open connected actor profiles without crowding Discover."}</p>
            </div>
            <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand-navy hover:bg-brand-cyan/20" aria-label="Close panel">
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {panel === "requests" && (pending.length ? pending.map((connection) => (
            <ActorRow
              key={connection.id}
              actor={actors[connection.actorUid]}
              actions={(
                <>
                  <button disabled={working === connection.id} onClick={() => onDecide(connection, "declined")} className="flex size-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Decline"><X className="size-4" /></button>
                  <button disabled={working === connection.id} onClick={() => onDecide(connection, "approved")} className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-bold text-white hover:bg-brand-navy">{working === connection.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Approve</button>
                </>
              )}
            />
          )) : <EmptyDrawerState icon={UserPlus} title="No requests waiting" copy="New actor connection requests will appear here with a badge." />)}

          {panel === "approved" && (approved.length ? approved.map((connection) => <ActorRow key={connection.id} actor={actors[connection.actorUid]} />) : <EmptyDrawerState icon={UsersRound} title="No approved talent yet" copy="Actors you approve will appear here for fast profile access." />)}
        </div>
      </section>
    </div>
  );
}

function EmptyDrawerState({ icon: Icon, title, copy }: { icon: typeof UserPlus; title: string; copy: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-silver bg-brand-ice/60 p-7 text-center">
      <Icon className="size-9 text-brand-blue" />
      <p className="mt-4 font-bold text-brand-navy">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function SearchActorCard({ actor }: { actor: DirectoryActor }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const name = actorDisplayName(actor);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-silver/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-navy/10">
      <div className="aspect-[4/3] bg-brand-ice">
        {actor.headshot ? (
          <button type="button" onClick={() => setViewerOpen(true)} className="relative flex size-full cursor-zoom-in items-center justify-center" aria-label={`View ${name} profile photo`}>
            <Image src={actor.headshot} alt="" fill unoptimized className="object-contain object-top" />
          </button>
        ) : <div className="flex size-full items-center justify-center text-brand-blue"><UsersRound className="size-9" /></div>}
      </div>
      <Link href={`/agent/talent/${actor.uid}`} className="block p-4 hover:bg-brand-ice/60">
        <p className="truncate font-bold text-brand-navy">{name}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{actor.availabilityStatus}{actor.ageRange ? ` · ${actor.ageRange}` : ""}</p>
      </Link>
      {actor.headshot && viewerOpen && <PhotoLightbox photo={actor.headshot} label={`${name} profile photo`} close={() => setViewerOpen(false)} />}
    </article>
  );
}

function ActorRow({ actor, actions }: { actor?: ActorCard; actions?: React.ReactNode }) {
  const body = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-cyan">{actor?.headshot ? <Image src={actor.headshot} alt="" fill unoptimized className="object-cover object-top" /> : <UsersRound className="size-5" />}</div>
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
