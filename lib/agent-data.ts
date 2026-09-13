import { type DocumentData, type Timestamp } from "firebase/firestore";

export type BriefStatus = "draft" | "published" | "closed";
export type BriefVisibility = "public" | "network";

export interface AgentBrief {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyPhoto: string;
  title: string;
  production: string;
  location: string;
  rate: string;
  shootDate: string;
  shootDateTime: string;
  callTime: string;
  description: string;
  ageRange: string;
  wardrobe: string;
  wardrobeImage: string;
  requirements: string[];
  status: BriefStatus;
  visibility: BriefVisibility;
  talentNeeded: number;
  applicationCount: number;
  closeMessage: string;
  whatsappLink: string;
  createdAt?: Timestamp;
}

export function briefFromDocument(id: string, data: DocumentData): AgentBrief {
  return {
    id,
    agencyId: typeof data.agencyId === "string" ? data.agencyId : "",
    agencyName: typeof data.agencyName === "string" ? data.agencyName : "Your agency",
    agencyPhoto: typeof data.agencyPhoto === "string" ? data.agencyPhoto : "",
    title: typeof data.title === "string" ? data.title : "Untitled brief",
    production: typeof data.production === "string" ? data.production : "",
    location: typeof data.location === "string" ? data.location : "",
    rate: typeof data.rate === "string" ? data.rate : "",
    shootDate: typeof data.shootDate === "string" ? data.shootDate : "",
    shootDateTime: typeof data.shootDateTime === "string" ? data.shootDateTime : typeof data.shootDate === "string" && data.shootDate.includes("T") ? data.shootDate : "",
    callTime: typeof data.callTime === "string" ? data.callTime : "",
    description: typeof data.description === "string" ? data.description : "",
    ageRange: typeof data.ageRange === "string" ? data.ageRange : Array.isArray(data.requirements) ? data.requirements.filter((tag): tag is string => typeof tag === "string").join(", ") : "",
    wardrobe: typeof data.wardrobe === "string" ? data.wardrobe : "",
    wardrobeImage: typeof data.wardrobeImage === "string" ? data.wardrobeImage : "",
    requirements: Array.isArray(data.requirements) ? data.requirements.filter((tag): tag is string => typeof tag === "string") : [],
    status: data.status === "draft" || data.status === "closed" ? data.status : "published",
    visibility: data.visibility === "network" ? "network" : "public",
    talentNeeded: typeof data.talentNeeded === "number" && Number.isFinite(data.talentNeeded) ? data.talentNeeded : 0,
    applicationCount: typeof data.applicationCount === "number" && Number.isFinite(data.applicationCount) ? data.applicationCount : 0,
    closeMessage: typeof data.closeMessage === "string" ? data.closeMessage : "",
    whatsappLink: typeof data.whatsappLink === "string" ? data.whatsappLink : "",
    createdAt: data.createdAt,
  };
}

export function callTimeFromDateTime(value: string) {
  if (!value.includes("T")) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export function briefDateLabel(brief: Pick<AgentBrief, "shootDate" | "shootDateTime">) {
  const value = brief.shootDateTime || brief.shootDate;
  if (!value) return "Date pending";
  if (!value.includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function briefCallTimeLabel(brief: Pick<AgentBrief, "callTime" | "shootDate" | "shootDateTime">) {
  return brief.callTime || callTimeFromDateTime(brief.shootDateTime || brief.shootDate) || "Call time pending";
}
