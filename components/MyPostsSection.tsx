"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { socialPostFromDocument, sortPostsNewestFirst, type SocialPost } from "@/lib/social-posts";
import { SocialPostGrid } from "@/components/SocialPostGrid";

export function MyPostsSection({ userUid }: { userUid: string }) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const displayName = posts[0]?.authorName || "CASTARZ member";

  useEffect(() => {
    if (!userUid) return;
    return onSnapshot(query(collection(db, "posts"), where("authorUid", "==", userUid), where("visibility", "==", "public")), (snapshot) => {
      setPosts(sortPostsNewestFirst(snapshot.docs.map((item) => socialPostFromDocument(item.id, item.data()))));
    });
  }, [userUid]);

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-ice text-brand-blue"><Clapperboard className="size-5" /></div>
        <div>
          <h2 className="font-bold text-brand-navy">My posts</h2>
          <p className="text-sm text-slate-600">Edit captions or delete posts from the 3-dot menu.</p>
        </div>
      </div>
      <SocialPostGrid
        posts={posts}
        currentUserUid={userUid}
        currentUserName={displayName}
        allowManage
        emptyTitle="No posts yet"
        emptyCopy="Your text updates, photos, and video links will live here after you post."
      />
    </section>
  );
}
