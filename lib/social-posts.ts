import { type DocumentData, type Timestamp } from "firebase/firestore";

export type SocialPostRole = "actor" | "agent";
export type SocialPostMediaType = "none" | "image" | "video";

export interface SocialPost {
  id: string;
  authorUid: string;
  authorRole: SocialPostRole;
  authorName: string;
  authorPhoto: string;
  actorUid: string;
  agencyId: string;
  caption: string;
  mediaUrl: string;
  mediaType: SocialPostMediaType;
  createdAt?: Timestamp;
}

export function socialPostFromDocument(id: string, data: DocumentData): SocialPost {
  const role = data.authorRole === "agent" ? "agent" : "actor";
  const mediaType = data.mediaType === "image" || data.mediaType === "video" ? data.mediaType : "none";

  return {
    id,
    authorUid: typeof data.authorUid === "string" ? data.authorUid : "",
    authorRole: role,
    authorName: typeof data.authorName === "string" && data.authorName.trim() ? data.authorName : role === "agent" ? "CASTARZ Agency" : "CASTARZ Actor",
    authorPhoto: typeof data.authorPhoto === "string" ? data.authorPhoto : "",
    actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
    agencyId: typeof data.agencyId === "string" ? data.agencyId : "",
    caption: typeof data.caption === "string" ? data.caption : "",
    mediaUrl: typeof data.mediaUrl === "string" ? data.mediaUrl : "",
    mediaType,
    createdAt: data.createdAt,
  };
}

export function sortPostsNewestFirst(posts: SocialPost[]) {
  return [...posts].sort((left, right) => (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0));
}
