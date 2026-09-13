"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import Image from "next/image";
import { CheckCircle2, Clock3, Edit3, Globe2, ImagePlus, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Plus, Send, Trash2, UsersRound, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { AgentApplicationsWorkspace } from "@/components/AgentApplicationsWorkspace";
import { useAuth } from "@/context/AuthContext";
import { briefCallTimeLabel, briefDateLabel, briefFromDocument, callTimeFromDateTime, type AgentBrief, type BriefStatus, type BriefVisibility } from "@/lib/agent-data";
import { compressImageToDataUrl } from "@/lib/actor-profile";
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
  status: "pending" | "standby" | "booked" | "rejected";
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

export default function BriefsPage() {
  const { user, profile } = useAuth();
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
      })));
    });
    return () => {
      briefStop();
      applicationStop();
    };
  }, [user]);

  const applicationsByBrief = useMemo(() => {
    return applications.reduce<Record<string, Application[]>>((groups, application) => {
      groups[application.briefId] = [...(groups[application.briefId] ?? []), application];
      return groups;
    }, {});
  }, [applications]);

  useEffect(() => {
    if (!user || !briefs.length) return;
    briefs.forEach((brief) => {
      const actualCount = applicationsByBrief[brief.id]?.length ?? 0;
      if (brief.applicationCount !== actualCount) {
        void updateDoc(doc(db, "briefs", brief.id), {
          applicationCount: actualCount,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
    });
  }, [applicationsByBrief, briefs, user]);

  async function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setNotice("");
    try {
      const agency = await getDoc(doc(db, "agencies", user.uid));
      const agencyName = typeof agency.data()?.name === "string" && agency.data()?.name.trim() ? agency.data()?.name : profile.email;
      const talentNeeded = Math.max(0, Number.parseInt(form.talentNeeded, 10) || 0);
      const applicationCount = editingBrief ? Math.max(editingBrief.applicationCount, applicationsByBrief[editingBrief.id]?.length ?? 0) : 0;
      const payload = {
        ...form,
        talentNeeded,
        applicationCount,
        agencyId: user.uid,
        agencyName,
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
            onClose={() => setClosingBrief(brief)}
            onEdit={() => startEditBrief(brief)}
            onDelete={() => setDeletingBrief(brief)}
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

function BriefCard({ brief, applications, onClose, onEdit, onDelete }: { brief: AgentBrief; applications: Application[]; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const appliedCount = Math.max(applications.length, brief.applicationCount);
  const bookedCount = applications.filter((application) => application.status === "booked").length;
  const remaining = brief.talentNeeded ? Math.max(brief.talentNeeded - appliedCount, 0) : 0;
  const full = Boolean(brief.talentNeeded && remaining === 0);
  const totalLabel = brief.talentNeeded ? (full ? `Full · ${brief.talentNeeded} spots` : `${remaining} spots remaining of ${brief.talentNeeded}`) : `${appliedCount} applied`;
  const statusTone = brief.status === "closed" ? "bg-slate-100 text-slate-600" : brief.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";

  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-silver/70 sm:p-6">
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
          <p className="text-2xl font-bold text-brand-navy">{brief.talentNeeded ? (full ? "Full" : remaining) : appliedCount}</p>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{brief.talentNeeded ? "Open spots" : "Applications"}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-blue" />{brief.location || "Location pending"}</span>
        <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{briefDateLabel(brief)} · {briefCallTimeLabel(brief)}</span>
        <span className="flex items-center gap-1"><UsersRound className="size-4 text-brand-blue" />{totalLabel}</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="size-4 text-brand-blue" />{bookedCount} booked</span>
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
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ice px-4 text-sm font-bold text-brand-navy hover:bg-brand-cyan/20">
          <Edit3 className="size-4" />Edit brief
        </button>
        <button type="button" onClick={onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100">
          <Trash2 className="size-4" />Delete brief
        </button>
        {brief.status === "published" && (
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
            <CheckCircle2 className="size-4" />Close brief
          </button>
        )}
      </div>
    </article>
  );
}

function CloseBriefDialog({ brief, applications, senderUid, onClose, onDone }: { brief: AgentBrief; applications: Application[]; senderUid: string; onClose: () => void; onDone: (message: string) => void }) {
  const booked = applications.filter((application) => application.status === "booked");
  const remaining = Math.max((brief.talentNeeded || 0) - booked.length, 0);
  const [message, setMessage] = useState(`You are booked for ${brief.title}. Please join the WhatsApp group for shoot communication.`);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function closeBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!senderUid) return;
    setWorking(true);
    setError("");
    try {
      await updateDoc(doc(db, "briefs", brief.id), {
        status: "closed",
        closeMessage: message.trim(),
        whatsappLink: whatsappLink.trim(),
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await Promise.all(booked.map((application) => notifyQuietly({
        recipientUid: application.actorUid,
        senderUid,
        type: "brief_closed",
        title: `${brief.title} is closed`,
        body: message.trim(),
        href: whatsappLink.trim() || "/actor/briefs",
      })));
      onDone(booked.length ? `Brief closed. ${booked.length} booked actor${booked.length === 1 ? "" : "s"} notified.` : "Brief closed. No booked actors were available to notify.");
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
            <p className="mt-2 text-sm text-slate-600">Send one final update to the confirmed cast and move this brief out of the live feed.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close dialog"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-brand-silver/70 bg-brand-ice">
          <div className="border-r border-brand-silver/70 p-4">
            <p className="text-2xl font-bold text-brand-navy">{booked.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Booked</p>
          </div>
          <div className="border-r border-brand-silver/70 p-4">
            <p className="text-2xl font-bold text-brand-navy">{brief.talentNeeded || "Open"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Needed</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-brand-navy">{remaining}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Remaining</p>
          </div>
        </div>
        <form onSubmit={closeBrief} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Message to booked actors</span>
            <textarea required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
          </label>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-900"><MessageCircle className="size-4" />WhatsApp group link</span>
              <input required type="url" value={whatsappLink} onChange={(event) => setWhatsappLink(event.target.value)} placeholder="https://chat.whatsapp.com/..." className="min-h-12 w-full rounded-xl border border-emerald-200 bg-white px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <p className="mt-2 text-xs font-semibold text-emerald-700">This link appears with the message in each booked actor notification and on their booked application card.</p>
          </div>
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
    </div>
  );
}

function DeleteBriefDialog({ brief, applications, onClose, onDone }: { brief: AgentBrief; applications: Application[]; onClose: () => void; onDone: (message: string) => void }) {
  const bookedCount = applications.filter((application) => application.status === "booked").length;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function deleteBrief() {
    setWorking(true);
    setError("");
    try {
      const bookingSnapshot = await getDocs(query(collection(db, "bookings"), where("agencyId", "==", brief.agencyId), where("briefId", "==", brief.id)));
      await Promise.all([
        ...applications.map((application) => deleteDoc(doc(db, "applications", application.id))),
        ...bookingSnapshot.docs.map((booking) => deleteDoc(doc(db, "bookings", booking.id))),
        deleteDoc(doc(db, "briefs", brief.id)),
      ]);
      onDone(`"${brief.title}" was deleted.`);
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
            <p className="mt-2 text-sm leading-6 text-slate-600">This removes the brief from your board and clears its application records. Booked actors will no longer see this application in their applied list.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close dialog"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-red-100 bg-red-50">
          <div className="border-r border-red-100 p-4">
            <p className="text-2xl font-bold text-red-700">{applications.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Applications</p>
          </div>
          <div className="border-r border-red-100 p-4">
            <p className="text-2xl font-bold text-red-700">{bookedCount}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Booked</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-red-700">{brief.status === "closed" ? "Yes" : "No"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-red-500">Closed</p>
          </div>
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
