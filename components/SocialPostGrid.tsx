"use client";

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { Building2, CalendarDays, Check, Clapperboard, ExternalLink, Heart, MessageCircle, MoreHorizontal, Send, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { type SocialPost } from "@/lib/social-posts";

type PostComment = {
  id: string;
  body: string;
  commenterUid: string;
  commenterName: string;
  createdAt?: { toMillis?: () => number };
};

export function SocialPostGrid({ posts, emptyTitle, emptyCopy, currentUserUid = "", currentUserName = "CASTARZ member", allowManage = false }: { posts: SocialPost[]; emptyTitle: string; emptyCopy: string; currentUserUid?: string; currentUserName?: string; allowManage?: boolean }) {
  if (!posts.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-brand-silver bg-white p-10 text-center">
        <Clapperboard className="mx-auto size-9 text-brand-blue" />
        <h2 className="mt-4 text-xl font-bold text-brand-navy">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => <SocialPostCard key={post.id} post={post} currentUserUid={currentUserUid} currentUserName={currentUserName} allowManage={allowManage} />)}
    </div>
  );
}

function SocialPostCard({ post, currentUserUid, currentUserName, allowManage }: { post: SocialPost; currentUserUid: string; currentUserName: string; allowManage: boolean }) {
  const authorHref = post.authorRole === "actor" ? `/agent/talent/${post.actorUid || post.authorUid}` : `/actor/agencies/${post.agencyId || post.authorUid}`;
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [comment, setComment] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);
  const ownPost = allowManage && post.authorUid === currentUserUid;
  const liked = currentUserUid ? likes.includes(currentUserUid) : false;
  const sortedComments = useMemo(() => [...comments].sort((left, right) => (left.createdAt?.toMillis?.() ?? 0) - (right.createdAt?.toMillis?.() ?? 0)).slice(-3), [comments]);

  useEffect(() => {
    const stopLikes = onSnapshot(collection(db, "posts", post.id, "likes"), (snapshot) => setLikes(snapshot.docs.map((item) => item.id)));
    const stopComments = onSnapshot(query(collection(db, "posts", post.id, "comments")), (snapshot) => {
      setComments(snapshot.docs.map((item) => ({
        id: item.id,
        body: typeof item.data().body === "string" ? item.data().body : "",
        commenterUid: typeof item.data().commenterUid === "string" ? item.data().commenterUid : "",
        commenterName: typeof item.data().commenterName === "string" ? item.data().commenterName : "CASTARZ member",
        createdAt: item.data().createdAt,
      })));
    });
    return () => {
      stopLikes();
      stopComments();
    };
  }, [post.id]);

  async function toggleLike() {
    if (!currentUserUid) return;
    const likeRef = doc(db, "posts", post.id, "likes", currentUserUid);
    if (liked) await deleteDoc(likeRef);
    else await setDoc(likeRef, { likerUid: currentUserUid, createdAt: serverTimestamp() });
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUserUid || !comment.trim()) return;
    await addDoc(collection(db, "posts", post.id, "comments"), {
      body: comment.trim(),
      commenterUid: currentUserUid,
      commenterName: currentUserName.trim() || "CASTARZ member",
      createdAt: serverTimestamp(),
    });
    setComment("");
  }

  async function saveEdit() {
    await updateDoc(doc(db, "posts", post.id), { caption: draft.trim(), updatedAt: serverTimestamp() });
    setEditing(false);
    setMenuOpen(false);
  }

  async function deletePost() {
    await Promise.all([
      ...likes.map((uid) => deleteDoc(doc(db, "posts", post.id, "likes", uid))),
      ...comments.map((item) => deleteDoc(doc(db, "posts", post.id, "comments", item.id))),
    ]);
    await deleteDoc(doc(db, "posts", post.id));
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-silver/70 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-navy/10">
      <div className="aspect-[4/5] bg-slate-100">
        {post.mediaType === "image" && post.mediaUrl ? (
          <img src={post.mediaUrl} alt="" className="size-full object-cover" />
        ) : post.mediaType === "video" && post.mediaUrl ? (
          <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-3 bg-brand-navy p-6 text-center text-white">
            <Clapperboard className="size-10 text-brand-cyan" />
            <span className="text-sm font-bold">Open video</span>
            <ExternalLink className="size-4 text-brand-cyan" />
          </a>
        ) : (
          <div className="flex size-full items-center justify-center bg-brand-ice p-7 text-center">
            <p className="text-xl font-extrabold leading-tight text-brand-navy">{post.caption || "CASTARZ update"}</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={authorHref} className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-navy text-brand-cyan">
              {post.authorPhoto ? <img src={post.authorPhoto} alt="" className="size-full object-cover" /> : post.authorRole === "agent" ? <Building2 className="size-5" /> : <UserRound className="size-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-brand-navy">{post.authorName}</p>
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarDays className="size-3" />{post.authorRole === "agent" ? "Agency spotlight" : "Actor update"}</p>
            </div>
          </Link>
          {ownPost && (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex size-9 items-center justify-center rounded-full hover:bg-brand-ice" aria-label="Post actions">
                <MoreHorizontal className="size-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-36 overflow-hidden rounded-xl bg-white text-sm font-bold shadow-xl ring-1 ring-brand-silver/70">
                  <button type="button" onClick={() => { setEditing(true); setMenuOpen(false); }} className="block min-h-10 w-full px-4 text-left hover:bg-brand-ice">Edit</button>
                  <button type="button" onClick={() => void deletePost()} className="flex min-h-10 w-full items-center gap-2 px-4 text-left text-red-700 hover:bg-red-50"><Trash2 className="size-4" />Delete</button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-3">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={360} rows={3} className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setDraft(post.caption); setEditing(false); }} className="flex size-9 items-center justify-center rounded-xl border border-slate-200" aria-label="Cancel edit"><X className="size-4" /></button>
              <button type="button" onClick={() => void saveEdit()} className="flex size-9 items-center justify-center rounded-xl bg-brand-blue text-white" aria-label="Save edit"><Check className="size-4" /></button>
            </div>
          </div>
        ) : post.mediaType !== "none" && post.caption && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.caption}</p>}

        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-500">
          <button type="button" onClick={() => void toggleLike()} className={`flex items-center gap-1.5 ${liked ? "text-red-600" : "hover:text-brand-blue"}`}>
            <Heart className={`size-4 ${liked ? "fill-red-500" : "text-brand-blue"}`} />{likes.length}
          </button>
          <span className="flex items-center gap-1.5"><MessageCircle className="size-4 text-brand-blue" />{comments.length}</span>
        </div>

        {sortedComments.length > 0 && (
          <div className="mt-3 space-y-2">
            {sortedComments.map((item) => (
              <p key={item.id} className="rounded-xl bg-brand-ice px-3 py-2 text-xs leading-5 text-slate-600">
                <span className="font-bold text-brand-navy">{item.commenterName}: </span>{item.body}
              </p>
            ))}
          </div>
        )}

        <form onSubmit={addComment} className="mt-3 flex gap-2">
          <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={240} placeholder="Add a comment" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-brand-ice px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
          <button className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white" aria-label="Send comment"><Send className="size-4" /></button>
        </form>
      </div>
    </article>
  );
}
