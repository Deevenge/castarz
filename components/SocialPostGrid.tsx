"use client";

import { Building2, CalendarDays, Clapperboard, ExternalLink, Heart, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { type SocialPost } from "@/lib/social-posts";

export function SocialPostGrid({ posts, emptyTitle, emptyCopy }: { posts: SocialPost[]; emptyTitle: string; emptyCopy: string }) {
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
      {posts.map((post) => <SocialPostCard key={post.id} post={post} />)}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const authorHref = post.authorRole === "actor" ? `/agent/talent/${post.actorUid || post.authorUid}` : `/actor/agencies/${post.agencyId || post.authorUid}`;

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
        <Link href={authorHref} className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-navy text-brand-cyan">
            {post.authorPhoto ? <img src={post.authorPhoto} alt="" className="size-full object-cover" /> : post.authorRole === "agent" ? <Building2 className="size-5" /> : <UserRound className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-brand-navy">{post.authorName}</p>
            <p className="flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarDays className="size-3" />{post.authorRole === "agent" ? "Agency spotlight" : "Actor update"}</p>
          </div>
        </Link>
        {post.mediaType !== "none" && post.caption && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.caption}</p>}
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-500">
          <span className="flex items-center gap-1.5"><Heart className="size-4 text-brand-blue" />Spotlight</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="size-4 text-brand-blue" />Profile</span>
        </div>
      </div>
    </article>
  );
}
