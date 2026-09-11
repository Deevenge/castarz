import { type DocumentData, type Timestamp } from "firebase/firestore";

export type BriefStatus = "draft" | "published" | "closed";
export type BriefVisibility = "public" | "network";

export interface AgentBrief {
  id: string;
  agencyId: string;
  agencyName: string;
  title: string;
  production: string;
  location: string;
  rate: string;
  shootDate: string;
  description: string;
  requirements: string[];
  status: BriefStatus;
  visibility: BriefVisibility;
  createdAt?: Timestamp;
}

export function briefFromDocument(id: string, data: DocumentData): AgentBrief {
  return {
    id,
    agencyId: typeof data.agencyId === "string" ? data.agencyId : "",
    agencyName: typeof data.agencyName === "string" ? data.agencyName : "Your agency",
    title: typeof data.title === "string" ? data.title : "Untitled brief",
    production: typeof data.production === "string" ? data.production : "",
    location: typeof data.location === "string" ? data.location : "",
    rate: typeof data.rate === "string" ? data.rate : "",
    shootDate: typeof data.shootDate === "string" ? data.shootDate : "",
    description: typeof data.description === "string" ? data.description : "",
    requirements: Array.isArray(data.requirements) ? data.requirements.filter((tag): tag is string => typeof tag === "string") : [],
    status: data.status === "draft" || data.status === "closed" ? data.status : "published",
    visibility: data.visibility === "network" ? "network" : "public",
    createdAt: data.createdAt,
  };
}
