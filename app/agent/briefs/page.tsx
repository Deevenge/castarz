"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Edit3, Globe2, ImagePlus, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Plus, Radio, Send, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { AgentApplicationsWorkspace } from "@/components/AgentApplicationsWorkspace";
import { PhotoLightbox } from "@/components/ProfileChrome";
import { useAuth } from "@/context/AuthContext";
import { briefCallTimeLabel, briefDateLabel, briefFromDocument, callTimeFromDateTime, type AgentBrief, type BriefStatus, type BriefVisibility } from "@/lib/agent-data";
import { compressImageToDataUrl, normalizeActorProfile, type ActorCredit, type ActorProfile } from "@/lib/actor-profile";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

type BriefForm = {
  title: string;
  production: string;
  location: string;
  rate: string;
  shootDate: string;
  description: string;
  ageRange: string;
  wardrobe: string;
  wardrobeImage: string;
  talentNeeded: string;
  status: BriefStatus;
  visibility: BriefVisibility;
};

type Application = {
  id: string;
  briefId: string;
  actorUid: string;
  status: "pending" | "standby" | "selected" | "booked" | "rejected" | "cancelled" | "replacement_available";
  cancelReason: string;
  replacementRequestId: string;
  replacementOriginalStatus: string;
  replacementAvailableAtMs: number;
};

const blank: BriefForm = {
  title: "",
  production: "",
  location: "",
  rate: "",
  shootDate: "",
  description: "",
  ageRange: "",
  wardrobe: "",
  wardrobeImage: "",
  talentNeeded: "",
  status: "published",
  visibility: "public",
};

const deleteReasons = [
  "Production dates changed",
  "Client cancelled the brief",
  "Casting direction changed",
  "Brief posted by mistake",
];

type FinalCommsMode = "whatsapp" | "shootRoom";
type ActorZCardSnapshot = { name: string; photo: string; bio: string; ageRange: string; heightCm: string; hairColor: string; eyeColor: string; credits: ActorCredit[]; albums: ActorProfile["albums"] };

export default function BriefsPage() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const replacementBriefId = searchParams.get("replacement") ?? "";
  const [briefs, setBriefs] = useState<AgentBrief[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<BriefForm>(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [closingBrief, setClosingBrief] = useState<AgentBrief | null>(null);
  const [editingBrief, setEditingBrief] = useState<AgentBrief | null>(null);
  const [deletingBrief, setDeletingBrief] = useState<AgentBrief | null>(null);
  const [section, setSection] = useState<"briefs" | "applications">("briefs");

  useEffect(() => {
    if (!user) return;
    const briefStop = onSnapshot(query(collection(db, "briefs"), where("agencyId", "==", user.uid)), (snapshot) => {
      const next = snapshot.docs.map((item) => briefFromDocument(item.id, item.data()));
      next.sort((left, right) => (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0));
      setBriefs(next);
    });
    const applicationStop = onSnapshot(query(collection(db, "applications"), where("agencyId", "==", user.uid)), (snapshot) => {
      setApplications(snapshot.docs.map((item) => ({
        id: item.id,
        briefId: String(item.data().briefId ?? ""),
        actorUid: String(item.data().actorUid ?? ""),
        status: item.data().status as Application["status"],
        cancelReason: typeof item.data().cancelReason === "string" ? item.data().cancelReason : "",
        replacementRequestId: typeof item.data().replacementRequestId === "string" ? item.data().replacementRequestId : "",
        replacementOriginalStatus: typeof item.data().replacementOriginalStatus === "string" ? item.data().replacementOriginalStatus : "",
        replacementAvailableAtMs: item.data().replacementAvailableAt?.toMillis?.() ?? 0,
      })));
    });
    return () => {
      briefStop();
      applicationStop();
    };
  }, [user]);

  useEffect(() => {
    if (!replacementBriefId) return;
    const timer = window.setTimeout(() => {
      setSection("briefs");
      document.getElementById(`brief-${replacementBriefId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [replacementBriefId, briefs.length]);

  const applicationsByBrief = useMemo(() => {
    return applications.reduce<Record<string, Application[]>>((groups, application) => {
      groups[application.briefId] = [...(groups[application.briefId] ?? []), application];
      return groups;
    }, {});
  }, [applications]);

  async function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setNotice("");
    try {
      const agency = await getDoc(doc(db, "agencies", user.uid));
      const agencyName = typeof agency.data()?.name === "string" && agency.data()?.name.trim() ? agency.data()?.name : profile.email;
      const agencyPhoto = typeof agency.data()?.photo === "string" ? agency.data()?.photo : "";
      const talentNeeded = Math.max(0, Number.parseInt(form.talentNeeded, 10) || 0);
      const payload = {
        ...form,
        talentNeeded,
        agencyId: user.uid,
        agencyName,
        agencyPhoto,
        shootDateTime: form.shootDate,
        callTime: callTimeFromDateTime(form.shootDate),
        ageRange: form.ageRange.trim(),
        wardrobe: form.wardrobe.trim(),
        wardrobeImage: form.wardrobeImage,
        requirements: form.ageRange.split(",").map((item) => item.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      };
      if (editingBrief) await updateDoc(doc(db, "briefs", editingBrief.id), payload);
      else await addDoc(collection(db, "briefs"), { ...payload, createdAt: serverTimestamp() });
      setForm(blank);
      setOpen(false);
      setEditingBrief(null);
      setNotice(editingBrief ? "Brief updated." : form.status === "published" ? "Brief is live in the selected audience feed." : "Draft saved.");
    } catch {
      setNotice("We could not save this brief. Check that the Firestore rules have been published.");
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof BriefForm>(key: K, value: BriefForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNewBrief() {
    setEditingBrief(null);
    setForm(blank);
    setOpen(true);
  }

  function startEditBrief(brief: AgentBrief) {
    setEditingBrief(brief);
    setForm({
      title: brief.title,
      production: brief.production,
      location: brief.location,
      rate: brief.rate,
      shootDate: brief.shootDateTime || (brief.shootDate.includes("T") ? brief.shootDate : ""),
      description: brief.description,
      ageRange: brief.ageRange || brief.requirements.join(", "),
      wardrobe: brief.wardrobe,
      wardrobeImage: brief.wardrobeImage,
      talentNeeded: brief.talentNeeded ? String(brief.talentNeeded) : "",
      status: brief.status,
      visibility: brief.visibility,
    });
    setOpen(true);
    setNotice("");
  }

  function closeForm() {
    setOpen(false);
    setEditingBrief(null);
    setForm(blank);
  }

  async function uploadWardrobeImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const wardrobeImage = await compressImageToDataUrl(file);
      updateForm("wardrobeImage", wardrobeImage);
    } catch {
      setNotice("We could not attach that wardrobe reference. Please try another image.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">CASTING BRIEFS</p>
          <h1 className="mt-1 text-3xl font-bold">Publish with the right reach.</h1>
          <p className="mt-2 text-slate-600">Set how many actors you need, then close the brief when the cast is booked.</p>
        </div>
        {section === "briefs" && <button onClick={startNewBrief} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white hover:bg-brand-navy"><Plus className="size-5" />New brief</button>}
      </header>

      <div className="mt-6 inline-grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-brand-silver/70">
        <button type="button" onClick={() => setSection("briefs")} className={`min-h-11 rounded-xl px-4 text-sm font-black ${section === "briefs" ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:text-brand-navy"}`}>Brief board</button>
        <button type="button" onClick={() => setSection("applications")} className={`min-h-11 rounded-xl px-4 text-sm font-black ${section === "applications" ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:text-brand-navy"}`}>Applications <span className="ml-2 opacity-70">{applications.length}</span></button>
      </div>

      {section === "applications" && (
        <div className="mt-7">
          <AgentApplicationsWorkspace compact />
        </div>
      )}

      {notice && <p className="mt-6 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}

      {section === "briefs" && open && (
        <section className="mt-7 rounded-3xl bg-white p-5 shadow-xl shadow-brand-navy/10 ring-1 ring-brand-silver/70 sm:p-7">
          <div className="flex justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{editingBrief ? "Edit casting brief" : "New casting brief"}</h2>
              <p className="mt-1 text-sm text-slate-600">{editingBrief ? "Adjust the brief details, audience, status, or actors needed." : "Choose exactly who can see and apply."}</p>
            </div>
            <button onClick={closeForm} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close form"><X className="size-5" /></button>
          </div>
          <form onSubmit={saveBrief} className="mt-6 grid gap-5 sm:grid-cols-2">
            <Input label="Brief title" value={form.title} set={(title) => updateForm("title", title)} placeholder="e.g. Featured extras for a premium fashion commercial" help="Use a clear casting headline actors can understand at a glance." required />
            <Input label="Production" value={form.production} set={(production) => updateForm("production", production)} placeholder="e.g. SABC drama, Netflix series, TV commercial, music video" help="Name the show, campaign, client, or production type." />
            <Input label="Location" value={form.location} set={(location) => updateForm("location", location)} placeholder="e.g. Johannesburg CBD, Cape Town studio, Durban beachfront" help="Add the city and any useful area or set location detail." />
            <Input label="Pay rate" value={form.rate} set={(rate) => updateForm("rate", rate)} placeholder="e.g. R1,500 day rate plus usage, or TBC" help="Be specific about rate, usage, overtime, or whether payment is still to be confirmed." />
            <div>
              <Input label="Shoot date and call time" value={form.shootDate} set={(shootDate) => updateForm("shootDate", shootDate)} type="datetime-local" help="Pick the shoot date and call time. CASTARZ will use this later for booking reports and schedules." />
              {form.shootDate && <p className="mt-2 rounded-xl bg-brand-ice px-3 py-2 text-xs font-bold text-brand-navy">Generated call time: {callTimeFromDateTime(form.shootDate) || "Pick a time"}</p>}
            </div>
            <Input label="Actors needed" value={form.talentNeeded} set={(talentNeeded) => updateForm("talentNeeded", talentNeeded)} type="number" min="1" placeholder="e.g. 12" help="How many performers, extras, or featured actors you need for this brief." />
            <Input label="Age range" value={form.ageRange} set={(ageRange) => updateForm("ageRange", ageRange)} placeholder="e.g. 18-25, 30-45, or families with kids aged 6-12" help="Describe the playable age range or demographic the production is looking for." className="sm:col-span-2" />
            <div className="grid gap-4 sm:col-span-2 lg:grid-cols-[1fr_190px]">
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">Wardrobe</span>
                <textarea rows={4} value={form.wardrobe} onChange={(event) => updateForm("wardrobe", event.target.value)} placeholder="e.g. Smart casual neutrals, no visible logos, bring black shoes and one formal option." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
                <p className="mt-2 text-xs font-semibold text-slate-500">Add clothing direction, colors, styling restrictions, or items actors should bring to set.</p>
              </label>
              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700">Wardrobe reference</span>
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-brand-silver/70 bg-brand-ice">
                  {form.wardrobeImage ? (
                    <Image src={form.wardrobeImage} alt="Wardrobe reference" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="px-4 text-center">
                      <ImagePlus className="mx-auto size-6 text-brand-blue" />
                      <p className="mt-2 text-xs font-bold text-slate-500">Optional style image</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <label className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 text-sm font-bold text-white">
                    <ImagePlus className="size-4" />Upload
                    <input type="file" accept="image/*" onChange={(event) => void uploadWardrobeImage(event)} className="sr-only" />
                  </label>
                  {form.wardrobeImage && <button type="button" onClick={() => updateForm("wardrobeImage", "")} className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700" aria-label="Remove wardrobe reference"><X className="size-4" /></button>}
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">Upload a mood, outfit, or color reference if it helps actors prepare.</p>
              </div>
            </div>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Brief description <span className="font-semibold text-slate-400">(optional)</span></span>
              <textarea rows={4} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Add story context, character notes, usage, call time expectations, callback details, or anything that helps actors decide if they fit." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
              <p className="mt-2 text-xs font-semibold text-slate-500">Optional, but useful for giving actors a premium, professional brief experience.</p>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="mb-3 text-sm font-bold text-slate-700">Who can apply?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Audience value="public" selected={form.visibility} choose={(visibility) => updateForm("visibility", visibility)} icon={Globe2} title="Open to all actors" copy="Appears in Discover and any signed-in Actor can apply." />
                <Audience value="network" selected={form.visibility} choose={(visibility) => updateForm("visibility", visibility)} icon={LockKeyhole} title="My agency talent only" copy="Appears only to Actors connected and approved by your agency." />
              </div>
            </fieldset>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Status</span>
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value as BriefStatus)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4">
                <option value="published">Publish now</option>
                <option value="draft">Save draft</option>
                {editingBrief?.status === "closed" && <option value="closed">Keep closed</option>}
              </select>
            </label>
            <div className="flex items-end">
              <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-navy font-bold text-white hover:bg-brand-blue disabled:opacity-60">{saving ? <LoaderCircle className="size-5 animate-spin" /> : editingBrief ? <Edit3 className="size-5" /> : <Send className="size-5" />}{saving ? "Saving..." : editingBrief ? "Save changes" : form.status === "published" ? "Publish brief" : "Save draft"}</button>
            </div>
          </form>
        </section>
      )}

      {section === "briefs" && <section className="mt-7 space-y-4">
        {briefs.map((brief) => (
            <BriefCard
              key={brief.id}
              brief={brief}
              applications={applicationsByBrief[brief.id] ?? []}
              senderUid={user?.uid ?? ""}
              focusReplacement={replacementBriefId === brief.id}
              onClose={() => setClosingBrief(brief)}
              onEdit={() => startEditBrief(brief)}
              onDelete={() => setDeletingBrief(brief)}
              onDone={setNotice}
            />
        ))}
        {!briefs.length && <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center"><Plus className="mx-auto size-8 text-brand-blue" /><p className="mt-4 font-bold">Your brief board is clear.</p></div>}
      </section>}

      {section === "briefs" && closingBrief && (
        <CloseBriefDialog
          brief={closingBrief}
          applications={applicationsByBrief[closingBrief.id] ?? []}
          senderUid={user?.uid ?? ""}
          onClose={() => setClosingBrief(null)}
          onDone={(message) => {
            setClosingBrief(null);
            setNotice(message);
          }}
        />
      )}
      {section === "briefs" && deletingBrief && (
        <DeleteBriefDialog
          brief={deletingBrief}
          applications={applicationsByBrief[deletingBrief.id] ?? []}
          senderUid={user?.uid ?? ""}
          onClose={() => setDeletingBrief(null)}
          onDone={(message) => {
            setDeletingBrief(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

function BriefCard({ brief, applications, senderUid, focusReplacement, onClose, onEdit, onDelete, onDone }: { brief: AgentBrief; applications: Application[]; senderUid: string; focusReplacement: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void; onDone: (message: string) => void }) {
  const appliedCount = applications.length;
  const shortlistedCount = applications.filter((application) => application.status === "standby" || application.status === "selected" || application.status === "booked").length;
  const selectedCount = applications.filter((application) => application.status === "selected" || application.status === "booked").length;
  const replacementCount = applications.filter((application) => application.status === "replacement_available").length;
  const totalLabel = brief.talentNeeded ? `${brief.talentNeeded} ${brief.talentNeeded === 1 ? "role" : "roles"} requested · ${appliedCount} applied` : `${appliedCount} applied`;
  const statusTone = brief.status === "closed" ? "bg-slate-100 text-slate-600" : brief.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";

  return (
    <article id={`brief-${brief.id}`} className={`scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 sm:p-6 ${focusReplacement ? "ring-2 ring-red-300 shadow-lg shadow-red-100" : "ring-brand-silver/70"}`}>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-ice px-3 py-1 text-xs font-bold text-brand-navy">{brief.visibility === "network" ? "Agency talent only" : "Open to all actors"}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone}`}>{brief.status === "published" ? "Live" : brief.status === "closed" ? "Closed" : "Draft"}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold">{brief.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{brief.production}</p>
        </div>
        <div className="rounded-2xl bg-brand-ice px-4 py-3 text-right">
          <p className="text-2xl font-bold text-brand-navy">{appliedCount}</p>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Applications</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-blue" />{brief.location || "Location pending"}</span>
        <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{briefDateLabel(brief)} · {briefCallTimeLabel(brief)}</span>
        <span className="flex items-center gap-1"><UsersRound className="size-4 text-brand-blue" />{totalLabel}</span>
        <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{shortlistedCount} shortlisted</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="size-4 text-brand-blue" />{selectedCount} selected</span>
        {brief.replacementOpen && <span className="flex items-center gap-1 text-red-700"><Radio className="size-4" />{replacementCount} replacement responses</span>}
      </div>
      <div className="mt-5 rounded-2xl border border-brand-silver/70 bg-brand-ice/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-brand-navy">Shortlist and final cast</p>
            <p className="mt-1 text-sm text-slate-600">Shortlist actors from Applications, then finalize selected bookings when closing this brief.</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-700 ring-1 ring-amber-100">{shortlistedCount} shortlisted</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">{selectedCount} selected</span>
          </div>
        </div>
      </div>
      {(brief.ageRange || brief.wardrobe || brief.wardrobeImage) && (
        <div className="mt-5 grid gap-3 rounded-2xl bg-brand-ice/55 p-4 md:grid-cols-[1fr_160px]">
          <div className="space-y-3">
            {brief.ageRange && <BriefDetail label="Age range" value={brief.ageRange} />}
            {brief.wardrobe && <BriefDetail label="Wardrobe" value={brief.wardrobe} />}
          </div>
          {brief.wardrobeImage && <div className="relative aspect-video overflow-hidden rounded-2xl bg-white"><Image src={brief.wardrobeImage} alt="Wardrobe reference" fill unoptimized className="object-cover" /></div>}
        </div>
      )}
      {brief.status === "closed" && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-bold text-brand-navy">Final cast update sent to booked actors.</p>
          <p className="mt-1">This brief is closed and no longer appears in live actor feeds.</p>
          {brief.whatsappLink && <a href={brief.whatsappLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-bold text-brand-blue"><MessageCircle className="size-4" />Open WhatsApp group</a>}
        </div>
      )}
      <ReplacementPool brief={brief} applications={applications} senderUid={senderUid} onDone={onDone} />
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ice px-4 text-sm font-bold text-brand-navy hover:bg-brand-cyan/20">
          <Edit3 className="size-4" />Edit brief
        </button>
        <button type="button" onClick={onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100">
          <Trash2 className="size-4" />Delete brief
        </button>
        {brief.status === "published" && (
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
            <CheckCircle2 className="size-4" />Finalize and close
          </button>
        )}
      </div>
    </article>
  );
}

function finalMessageFor(mode: FinalCommsMode, title: string) {
  return mode === "whatsapp"
    ? `Congratulations, you are booked for ${title}. Please join the WhatsApp group for final shoot communication.`
    : `Congratulations, you are booked for ${title}. Your CASTARZ shoot room is ready for final production communication.`;
}

function zCardSnapshotFromActor(actor: ActorProfile): ActorZCardSnapshot {
  return {
    name: actor.stageName || actor.fullName || "Actor",
    photo: actor.headshot,
    bio: actor.bio,
    ageRange: actor.ageRange,
    heightCm: actor.heightCm,
    hairColor: actor.hairColor,
    eyeColor: actor.eyeColor,
    credits: actor.credits.slice(0, 8),
    albums: actor.albums,
  };
}

function ReplacementPool({ brief, applications, senderUid, onDone }: { brief: AgentBrief; applications: Application[]; senderUid: string; onDone: (message: string) => void }) {
  const cancelledApplication = applications.find((application) => application.id === brief.replacementCancelledApplicationId) ?? applications.find((application) => application.status === "cancelled");
  const candidates = useMemo(() => applications
    .filter((application) => application.status === "replacement_available")
    .sort((left, right) => (left.replacementAvailableAtMs || Number.MAX_SAFE_INTEGER) - (right.replacementAvailableAtMs || Number.MAX_SAFE_INTEGER)), [applications]);
  const alertableApplications = applications.filter((application) => (
    application.actorUid !== brief.replacementCancelledActorUid
    && application.status !== "booked"
    && application.status !== "cancelled"
    && application.status !== "replacement_available"
  ));
  const visible = brief.replacementOpen || Boolean(cancelledApplication) || candidates.length > 0;
  const actorIds = useMemo(() => Array.from(new Set([
    ...candidates.map((application) => application.actorUid),
    ...(cancelledApplication ? [cancelledApplication.actorUid] : []),
  ])), [candidates, cancelledApplication]);
  const actorIdsKey = actorIds.join("|");
  const [actorDetails, setActorDetails] = useState<Record<string, ActorZCardSnapshot>>({});
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all(actorIds.map(async (actorUid) => {
      const snapshot = await getDoc(doc(db, "actors", actorUid));
      return [actorUid, zCardSnapshotFromActor(normalizeActorProfile(snapshot.data()))] as const;
    })).then((entries) => {
      if (active) setActorDetails(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [actorIds, actorIdsKey]);

  if (!visible) return null;

  async function broadcastReplacementAlert() {
    if (!senderUid || !alertableApplications.length) return;
    setWorking("broadcast");
    setError("");
    try {
      await Promise.all(alertableApplications.map((application) => notifyQuietly({
        recipientUid: application.actorUid,
        senderUid,
        type: "replacement_needed",
        title: `Emergency replacement: ${brief.title}`,
        body: `${brief.agencyName} needs a replacement for ${brief.title}${brief.replacementDeadlineAt ? ` by ${deadlineLabel(brief.replacementDeadlineAt)}` : ""}. Open My Applications and tap “I’m available” if you can make it.`,
        href: "/actor/briefs",
        applicationId: application.id,
        briefId: application.briefId,
      })));
      await updateDoc(doc(db, "briefs", brief.id), { replacementAlertedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      onDone(`Emergency replacement alert sent to ${alertableApplications.length} applicant${alertableApplications.length === 1 ? "" : "s"}.`);
    } catch {
      setError("We could not send the replacement alert. Please try again.");
    } finally {
      setWorking("");
    }
  }

  async function confirmReplacement(application: Application) {
    if (!senderUid) return;
    setWorking(application.id);
    setError("");
    try {
      const actorSnapshot = await getDoc(doc(db, "actors", application.actorUid));
      const actor = zCardSnapshotFromActor(normalizeActorProfile(actorSnapshot.data()));
      const batch = writeBatch(db);
      const usingShootRoom = Boolean(brief.shootRoomId);

      batch.update(doc(db, "applications", application.id), { status: "booked", decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(doc(db, "briefs", brief.id), {
        replacementOpen: false,
        replacementSelectedActorUid: application.actorUid,
        replacementFulfilledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "bookings", application.id), {
        applicationId: application.id,
        briefId: application.briefId,
        actorUid: application.actorUid,
        agencyId: senderUid,
        agencyName: brief.agencyName,
        actorName: actor.name,
        briefTitle: brief.title,
        location: brief.location,
        shootDate: `${briefDateLabel(brief)} · ${briefCallTimeLabel(brief)}`,
        shootDateTime: brief.shootDateTime,
        callTime: briefCallTimeLabel(brief),
        rate: brief.rate,
        status: "confirmed",
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (usingShootRoom) {
        const roomRef = doc(db, "shootRooms", brief.shootRoomId);
        const roomSnapshot = await getDoc(roomRef);
        const roomData = roomSnapshot.data() ?? {};
        const participantUids = Array.isArray(roomData.participantUids) ? roomData.participantUids.filter((uid): uid is string => typeof uid === "string") : [senderUid];
        const actorSummaries = Array.isArray(roomData.actorSummaries) ? roomData.actorSummaries.filter((summary: { uid?: unknown }) => typeof summary.uid === "string" && summary.uid !== brief.replacementCancelledActorUid && summary.uid !== application.actorUid) : [];
        const nextParticipants = Array.from(new Set([...participantUids.filter((uid) => uid !== brief.replacementCancelledActorUid), senderUid, application.actorUid]));
        const replacementSummary = { uid: application.actorUid, ...actor };
        batch.set(roomRef, {
          participantUids: nextParticipants,
          actorSummaries: [...actorSummaries, replacementSummary],
          readBy: [senderUid],
          deletedFor: [],
          lastMessage: `${actor.name} has been confirmed as the replacement for ${brief.title}.`,
          lastSenderUid: senderUid,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        batch.set(doc(db, "shootRooms", brief.shootRoomId, "actorZCards", application.actorUid), replacementSummary, { merge: true });
      }

      await batch.commit();
      await notifyQuietly({
        recipientUid: application.actorUid,
        senderUid,
        type: "replacement_confirmed",
        title: `Replacement confirmed: ${brief.title}`,
        body: usingShootRoom
          ? `You’ve been confirmed as the replacement for ${brief.title}. Final details are in your CASTARZ shoot room.`
          : `You’ve been confirmed as the replacement for ${brief.title}. Final details are in My Applications${brief.whatsappLink ? " with the WhatsApp group link" : ""}.`,
        href: usingShootRoom ? `/actor/inbox?shoot=${brief.shootRoomId}` : "/actor/briefs",
        applicationId: application.id,
        briefId: application.briefId,
      });
      onDone(`${actor.name} was confirmed as the replacement for ${brief.title}.`);
    } catch {
      setError("We could not confirm this replacement. Please try again.");
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-red-100 bg-red-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-red-700"><AlertTriangle className="size-4" />Replacement pool</p>
          <h3 className="mt-1 font-bold text-brand-navy">{brief.replacementOpen ? `1 replacement needed for ${brief.title}` : "Replacement request handled"}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {brief.replacementReason ? `Reason: ${brief.replacementReason}. ` : ""}
            {brief.replacementDeadlineAt ? `Need replacement by ${deadlineLabel(brief.replacementDeadlineAt)}.` : "Emergency response queue is open."}
          </p>
        </div>
        {brief.replacementOpen && (
          <button type="button" disabled={working === "broadcast" || !alertableApplications.length} onClick={() => void broadcastReplacementAlert()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {working === "broadcast" ? <LoaderCircle className="size-4 animate-spin" /> : <Radio className="size-4" />}
            Alert pool
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <MatchChip label="Age range" value={brief.ageRange || "open"} />
        <MatchChip label="Wardrobe" value={brief.wardrobe ? "brief supplied" : "not specified"} />
        <MatchChip label="Location" value={brief.location || "to confirm"} />
      </div>
      {cancelledApplication && (
        <div className="mt-4 rounded-xl bg-white p-3 text-sm font-semibold text-slate-600 ring-1 ring-red-100">
          Cancelled actor: <span className="text-brand-navy">{actorDetails[cancelledApplication.actorUid]?.name || cancelledApplication.actorUid}</span>{cancelledApplication.cancelReason ? ` · ${cancelledApplication.cancelReason}` : ""}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {candidates.length ? candidates.map((application, index) => {
          const actor = actorDetails[application.actorUid];
          const score = replacementReliability(actor);
          return (
            <div key={application.id} className="grid gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-red-100 sm:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 gap-3">
                <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-navy text-xs font-black text-brand-cyan">
                  {actor?.photo ? <Image src={actor.photo} alt="" fill unoptimized className="object-cover" /> : (actor?.name || "A").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-navy">{index + 1}. {actor?.name || "Loading actor..."}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">Responded {application.replacementAvailableAtMs ? timeAgo(application.replacementAvailableAtMs) : "just now"} · originally {applicationStageLabel(application.replacementOriginalStatus || "applicant")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"><ShieldCheck className="size-3.5" />Reliability {score}</span>
                    <span className="rounded-full bg-brand-ice px-2.5 py-1 text-xs font-black text-brand-navy">Age {actor?.ageRange || "not listed"}</span>
                    <Link href={`/agent/talent/${application.actorUid}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-brand-blue ring-1 ring-brand-silver/70 hover:bg-brand-ice">Review z-card</Link>
                  </div>
                </div>
              </div>
              <button type="button" disabled={working === application.id || !brief.replacementOpen} onClick={() => void confirmReplacement(application)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue disabled:opacity-60">
                {working === application.id ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Confirm replacement
              </button>
            </div>
          );
        }) : (
          <p className="rounded-xl border border-dashed border-red-200 bg-white p-4 text-sm font-semibold text-slate-500">No replacement responses yet. Send the emergency alert to shortlisted and applied actors, then responses will queue here by fastest first.</p>
        )}
      </div>
      {error && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}

function MatchChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-brand-navy ring-1 ring-red-100">
      {label}: <span className="text-slate-600">{value}</span>
    </span>
  );
}

function deadlineLabel(value: AgentBrief["replacementDeadlineAt"]) {
  const date = value?.toDate?.();
  if (!date) return "the agency deadline";
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(date);
}

function replacementReliability(actor?: ActorZCardSnapshot) {
  if (!actor) return 70;
  const profileDepth = [actor.photo, actor.bio, actor.ageRange, actor.heightCm, actor.hairColor, actor.eyeColor].filter(Boolean).length;
  const creditDepth = Math.min(actor.credits.length, 5);
  return Math.min(98, 70 + profileDepth * 3 + creditDepth * 2);
}

function timeAgo(ms: number) {
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function applicationStageLabel(status: string) {
  return status === "standby" || status === "selected"
    ? "shortlisted"
    : status === "rejected"
      ? "not selected"
      : status === "pending"
        ? "under review"
        : status || "applicant";
}

function CloseBriefDialog({ brief, applications, senderUid, onClose, onDone }: { brief: AgentBrief; applications: Application[]; senderUid: string; onClose: () => void; onDone: (message: string) => void }) {
  const shortlist = useMemo(() => applications.filter((application) => application.status === "standby" || application.status === "selected" || application.status === "booked"), [applications]);
  const shortlistKey = shortlist.map((application) => application.id).join("|");
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>(shortlist.filter((application) => application.status === "selected" || application.status === "booked").map((application) => application.id));
  const [actorDetails, setActorDetails] = useState<Record<string, ActorZCardSnapshot>>({});
  const [previewPhoto, setPreviewPhoto] = useState<{ photo: string; label: string } | null>(null);
  const [commsMode, setCommsMode] = useState<FinalCommsMode>("whatsapp");
  const [message, setMessage] = useState(finalMessageFor("whatsapp", brief.title));
  const [whatsappLink, setWhatsappLink] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const selectedBookings = shortlist.filter((application) => selectedBookingIds.includes(application.id));
  const notSelectedApplications = applications.filter((application) => !selectedBookingIds.includes(application.id));

  useEffect(() => {
    let active = true;
    void Promise.all(shortlist.map(async (application) => {
      const snapshot = await getDoc(doc(db, "actors", application.actorUid));
        const actor = normalizeActorProfile(snapshot.data());
      return [application.actorUid, zCardSnapshotFromActor(actor)] as const;
    })).then((entries) => {
      if (active) setActorDetails(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [shortlist, shortlistKey]);

  function toggleBooking(applicationId: string) {
    setSelectedBookingIds((current) => current.includes(applicationId) ? current.filter((id) => id !== applicationId) : [...current, applicationId]);
  }

  async function closeBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!senderUid) return;
    setWorking(true);
    setError("");
    try {
      const shootRoomId = `shoot_${brief.id}`;
      const usingShootRoom = commsMode === "shootRoom";
      const freshDetails = Object.fromEntries(await Promise.all(selectedBookings.map(async (application) => {
        const snapshot = await getDoc(doc(db, "actors", application.actorUid));
        return [application.actorUid, zCardSnapshotFromActor(normalizeActorProfile(snapshot.data()))] as const;
      })));
      const finalActorDetails = { ...actorDetails, ...freshDetails };
      const batch = writeBatch(db);
      batch.update(doc(db, "briefs", brief.id), {
        status: "closed",
        closeMessage: message.trim(),
        whatsappLink: commsMode === "whatsapp" ? whatsappLink.trim() : "",
        shootRoomId: usingShootRoom ? shootRoomId : "",
        finalCommsMode: commsMode,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      selectedBookings.forEach((application) => {
        const actorName = finalActorDetails[application.actorUid]?.name || "Actor";
        batch.update(doc(db, "applications", application.id), { status: "booked", decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        batch.set(doc(db, "bookings", application.id), {
          applicationId: application.id,
          briefId: application.briefId,
          actorUid: application.actorUid,
          agencyId: senderUid,
          agencyName: brief.agencyName,
          actorName,
          briefTitle: brief.title,
          location: brief.location,
          shootDate: `${briefDateLabel(brief)} · ${briefCallTimeLabel(brief)}`,
          shootDateTime: brief.shootDateTime,
          callTime: briefCallTimeLabel(brief),
          rate: brief.rate,
          status: "confirmed",
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      notSelectedApplications.forEach((application) => {
        batch.update(doc(db, "applications", application.id), { status: "rejected", decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      if (usingShootRoom && selectedBookings.length) {
        const actorSummaries = selectedBookings.map((application) => ({
          uid: application.actorUid,
          name: finalActorDetails[application.actorUid]?.name || "Booked actor",
          photo: finalActorDetails[application.actorUid]?.photo || "",
          bio: finalActorDetails[application.actorUid]?.bio || "",
          ageRange: finalActorDetails[application.actorUid]?.ageRange || "",
          heightCm: finalActorDetails[application.actorUid]?.heightCm || "",
          hairColor: finalActorDetails[application.actorUid]?.hairColor || "",
          eyeColor: finalActorDetails[application.actorUid]?.eyeColor || "",
          credits: finalActorDetails[application.actorUid]?.credits || [],
          albums: finalActorDetails[application.actorUid]?.albums || {},
        }));
        batch.set(doc(db, "shootRooms", shootRoomId), {
          agencyId: senderUid,
          agencyName: brief.agencyName,
          briefId: brief.id,
          briefTitle: brief.title,
          participantUids: [senderUid, ...selectedBookings.map((application) => application.actorUid)],
          actorSummaries,
          readBy: [senderUid],
          deletedFor: [],
          lastMessage: "Shoot room opened for final production communication.",
          lastSenderUid: senderUid,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        actorSummaries.forEach((summary) => {
          batch.set(doc(db, "shootRooms", shootRoomId, "actorZCards", summary.uid), summary, { merge: true });
        });
      }
      await batch.commit();
      await Promise.all([
        ...selectedBookings.map((application) => notifyQuietly({
          recipientUid: application.actorUid,
          senderUid,
          type: "booking_confirmed",
          title: `Final booking details: ${brief.title}`,
          body: `${message.trim()} ${usingShootRoom ? "Your shoot room is ready in Inbox, under Shoot Rooms." : "Your WhatsApp group link is ready in My Applications."}`,
          href: usingShootRoom ? `/actor/inbox?shoot=${shootRoomId}` : "/actor/briefs",
          applicationId: application.id,
          briefId: application.briefId,
        })),
        ...notSelectedApplications.map((application) => notifyQuietly({
          recipientUid: application.actorUid,
          senderUid,
          type: "application_rejected",
          title: `Final selection update: ${brief.title}`,
          body: `${brief.agencyName} has finalized ${brief.title}. Thank you for applying, but you were not selected for the final booking this time. Keep your profile ready for the next opportunity.`,
          href: "/actor/briefs",
          applicationId: application.id,
          briefId: application.briefId,
        })),
      ]);
      onDone(`Brief closed. ${selectedBookings.length} booked actor${selectedBookings.length === 1 ? "" : "s"} and ${notSelectedApplications.length} other applicant${notSelectedApplications.length === 1 ? "" : "s"} notified.`);
    } catch {
      setError("We could not close this brief. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-brand-blue">CLOSE BRIEF</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">{brief.title}</h2>
            <p className="mt-2 text-sm text-slate-600">Select the booked actors, add the WhatsApp link, then send the final production update.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close dialog"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-brand-silver/70 bg-brand-ice">
          <div className="border-r border-brand-silver/70 p-4">
            <p className="text-2xl font-bold text-brand-navy">{selectedBookings.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Selected</p>
          </div>
          <div className="border-r border-brand-silver/70 p-4">
            <p className="text-2xl font-bold text-brand-navy">{brief.talentNeeded || "Open"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Roles</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-brand-navy">{shortlist.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Shortlist</p>
          </div>
        </div>
        <form onSubmit={closeBrief} className="mt-6 space-y-5">
          <section className="rounded-2xl border border-brand-silver/70 bg-brand-ice/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy">Final cast checklist</h3>
                <p className="mt-1 text-sm text-slate-600">Tick the shortlisted actors who are booked for this brief.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-brand-navy">{selectedBookings.length} booked</span>
            </div>
            {shortlist.length ? (
              <div className="mt-4 space-y-2">
                {shortlist.map((application) => {
                  const selected = selectedBookingIds.includes(application.id);
                  const actor = actorDetails[application.actorUid];
                  const actorName = actor?.name || "Loading actor...";
                  return (
                    <div key={application.id} className={`flex w-full items-center gap-3 rounded-2xl border p-3 transition ${selected ? "border-emerald-200 bg-white shadow-sm" : "border-transparent bg-white/65 hover:bg-white"}`}>
                      <button type="button" disabled={!actor?.photo} onClick={() => actor?.photo && setPreviewPhoto({ photo: actor.photo, label: `${actorName} profile photo` })} className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-navy text-xs font-black text-brand-cyan disabled:cursor-default" aria-label={`Preview ${actorName} profile photo`}>
                        {actor?.photo ? <Image src={actor.photo} alt="" fill unoptimized className="object-cover" /> : actorName.slice(0, 2).toUpperCase()}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-brand-navy">{actorName}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{application.status === "booked" || application.status === "selected" ? "Selected for final cast" : "Shortlisted"}</p>
                        <Link href={`/agent/talent/${application.actorUid}`} className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-brand-ice px-3 text-xs font-bold text-brand-blue hover:bg-brand-cyan/20">
                          Review application
                        </Link>
                      </div>
                      <button type="button" onClick={() => toggleBooking(application.id)} className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`} aria-label={selected ? `Remove ${actorName} from final cast` : `Select ${actorName} for final cast`}>
                        <CheckCircle2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-brand-silver bg-white p-4 text-sm font-semibold text-slate-500">No shortlisted actors yet. You can still close the brief without sending final booking notifications.</p>
            )}
          </section>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Message to booked actors</span>
            <textarea required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
          </label>
          <section className="rounded-2xl border border-brand-silver/70 bg-white p-4">
            <p className="text-sm font-bold text-brand-navy">Final communication channel</p>
            <p className="mt-1 text-sm text-slate-600">Choose where booked actors should receive production-day communication.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => { setCommsMode("whatsapp"); setMessage(finalMessageFor("whatsapp", brief.title)); }} className={`rounded-2xl border-2 p-4 text-left transition ${commsMode === "whatsapp" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
                <MessageCircle className="size-5 text-emerald-600" />
                <p className="mt-3 font-bold text-brand-navy">Paste WhatsApp link</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Actors receive the final booking message and join the WhatsApp group.</p>
              </button>
              <button type="button" onClick={() => { setCommsMode("shootRoom"); setMessage(finalMessageFor("shootRoom", brief.title)); }} className={`rounded-2xl border-2 p-4 text-left transition ${commsMode === "shootRoom" ? "border-brand-blue bg-brand-ice" : "border-slate-200 bg-white hover:border-brand-cyan"}`}>
                <UsersRound className="size-5 text-brand-blue" />
                <p className="mt-3 font-bold text-brand-navy">Use CASTARZ shoot room</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Creates a private production room with the agency and booked actors only.</p>
              </button>
            </div>
          </section>
          {commsMode === "whatsapp" && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-900"><MessageCircle className="size-4" />WhatsApp group link</span>
                <input required type="url" value={whatsappLink} onChange={(event) => setWhatsappLink(event.target.value)} placeholder="https://chat.whatsapp.com/..." className="min-h-12 w-full rounded-xl border border-emerald-200 bg-white px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </label>
              <p className="mt-2 text-xs font-semibold text-emerald-700">This link appears with the message in each booked actor notification and on their booked application card.</p>
            </div>
          )}
          {commsMode === "shootRoom" && (
            <div className="rounded-2xl border border-brand-silver/70 bg-brand-ice p-4">
              <p className="font-bold text-brand-navy">CASTARZ will create a shoot room</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Booked actors will see it in Inbox under Shoot Rooms. Actors can message the room, but they will not get profile links or private actor-to-actor chat actions.</p>
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={working} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue font-bold text-white hover:bg-brand-navy disabled:opacity-60">
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              {working ? "Closing..." : "Close and notify"}
            </button>
          </div>
        </form>
      </section>
      {previewPhoto && <PhotoLightbox photo={previewPhoto.photo} label={previewPhoto.label} close={() => setPreviewPhoto(null)} />}
    </div>
  );
}

function DeleteBriefDialog({ brief, applications, senderUid, onClose, onDone }: { brief: AgentBrief; applications: Application[]; senderUid: string; onClose: () => void; onDone: (message: string) => void }) {
  const selectedCount = applications.filter((application) => application.status === "selected" || application.status === "booked").length;
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function deleteBrief() {
    if (!senderUid) {
      setError("Please sign in again before deleting this brief.");
      return;
    }
    const finalReason = reason.trim();
    if (!finalReason) {
      setError("Please choose or type a reason before deleting this brief.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const bookingSnapshot = await getDocs(query(collection(db, "bookings"), where("agencyId", "==", brief.agencyId), where("briefId", "==", brief.id)));
      await Promise.all(applications.map((application) => notifyQuietly({
        recipientUid: application.actorUid,
        senderUid,
        type: "brief_deleted",
        title: `${brief.title} was withdrawn`,
        body: `${brief.agencyName} deleted this brief. Reason: ${finalReason}`,
        href: "/actor/briefs",
        applicationId: application.id,
        briefId: application.briefId,
      })));
      await Promise.all([
        ...applications.map((application) => deleteDoc(doc(db, "applications", application.id))),
        ...bookingSnapshot.docs.map((booking) => deleteDoc(doc(db, "bookings", booking.id))),
        deleteDoc(doc(db, "briefs", brief.id)),
      ]);
      onDone(`"${brief.title}" was deleted and ${applications.length} applicant${applications.length === 1 ? "" : "s"} notified.`);
    } catch {
      setError("We could not delete this brief. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-red-600">DELETE BRIEF</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">{brief.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Give applicants a clear reason before this brief is removed from your board.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close dialog"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-red-100 bg-red-50">
          <div className="border-r border-red-100 p-4">
            <p className="text-2xl font-bold text-red-700">{applications.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Applications</p>
          </div>
          <div className="border-r border-red-100 p-4">
            <p className="text-2xl font-bold text-red-700">{selectedCount}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Selected</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-red-700">{brief.status === "closed" ? "Yes" : "No"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Closed</p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-brand-silver/70 bg-brand-ice/50 p-4">
          <p className="text-sm font-bold text-brand-navy">Choose a reason</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deleteReasons.map((item) => (
              <button key={item} type="button" onClick={() => setReason(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${reason === item ? "bg-brand-navy text-white" : "bg-white text-brand-navy ring-1 ring-brand-silver/70"}`}>
                {item}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Reason for deleting this brief</span>
            <textarea required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: The client moved the campaign to a later date, so this brief is being withdrawn for now." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
            <p className="mt-2 text-xs font-semibold text-slate-500">This message will be sent to every actor who applied.</p>
          </label>
        </div>
        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={working} onClick={() => void deleteBrief()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {working ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {working ? "Deleting..." : "Delete brief"}
          </button>
        </div>
      </section>
    </div>
  );
}

function BriefDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{value}</p>
    </div>
  );
}

function Input({ label, value, set, required, placeholder, help, type, min, className = "" }: { label: string; value: string; set: (value: string) => void; required?: boolean; placeholder?: string; help: string; type?: string; min?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input required={required} value={value} placeholder={placeholder} type={type ?? "text"} min={min} onChange={(event) => set(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
      <p className="mt-2 text-xs font-semibold text-slate-500">{help}</p>
    </label>
  );
}

function Audience({ value, selected, choose, icon: Icon, title, copy }: { value: BriefVisibility; selected: BriefVisibility; choose: (value: BriefVisibility) => void; icon: typeof Globe2; title: string; copy: string }) {
  const active = value === selected;
  return (
    <button type="button" onClick={() => choose(value)} className={`rounded-2xl border-2 p-4 text-left ${active ? "border-brand-blue bg-brand-ice" : "border-slate-200"}`}>
      <Icon className="size-5 text-brand-blue" />
      <p className="mt-3 font-bold text-brand-navy">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{copy}</p>
    </button>
  );
}
