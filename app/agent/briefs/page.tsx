"use client";

import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, Clock3, Globe2, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Plus, Send, UsersRound, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { briefFromDocument, type AgentBrief, type BriefStatus, type BriefVisibility } from "@/lib/agent-data";
import { db } from "@/lib/firebase";
import { notifyQuietly } from "@/lib/notify";

type BriefForm = {
  title: string;
  production: string;
  location: string;
  rate: string;
  shootDate: string;
  description: string;
  requirements: string;
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
  requirements: "",
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

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setNotice("");
    try {
      const agency = await getDoc(doc(db, "agencies", user.uid));
      const agencyName = typeof agency.data()?.name === "string" && agency.data()?.name.trim() ? agency.data()?.name : profile.email;
      const talentNeeded = Math.max(0, Number.parseInt(form.talentNeeded, 10) || 0);
      await addDoc(collection(db, "briefs"), {
        ...form,
        talentNeeded,
        agencyId: user.uid,
        agencyName,
        requirements: form.requirements.split(",").map((item) => item.trim()).filter(Boolean),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setForm(blank);
      setOpen(false);
      setNotice(form.status === "published" ? "Brief is live in the selected audience feed." : "Draft saved.");
    } catch {
      setNotice("We could not save this brief. Check that the Firestore rules have been published.");
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof BriefForm>(key: K, value: BriefForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">CASTING BRIEFS</p>
          <h1 className="mt-1 text-3xl font-bold">Publish with the right reach.</h1>
          <p className="mt-2 text-slate-600">Set how many actors you need, then close the brief when the cast is booked.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white hover:bg-brand-navy"><Plus className="size-5" />New brief</button>
      </header>

      {notice && <p className="mt-6 flex items-center gap-2 rounded-xl bg-brand-ice px-4 py-3 text-sm font-semibold text-brand-navy"><CheckCircle2 className="size-5 text-brand-blue" />{notice}</p>}

      {open && (
        <section className="mt-7 rounded-3xl bg-white p-5 shadow-xl shadow-brand-navy/10 ring-1 ring-brand-silver/70 sm:p-7">
          <div className="flex justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">New casting brief</h2>
              <p className="mt-1 text-sm text-slate-600">Choose exactly who can see and apply.</p>
            </div>
            <button onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close form"><X className="size-5" /></button>
          </div>
          <form onSubmit={create} className="mt-6 grid gap-5 sm:grid-cols-2">
            <Input label="Brief title" value={form.title} set={(title) => updateForm("title", title)} required />
            <Input label="Production" value={form.production} set={(production) => updateForm("production", production)} />
            <Input label="Location" value={form.location} set={(location) => updateForm("location", location)} />
            <Input label="Pay rate" value={form.rate} set={(rate) => updateForm("rate", rate)} />
            <Input label="Shoot date" value={form.shootDate} set={(shootDate) => updateForm("shootDate", shootDate)} />
            <Input label="Actors needed" value={form.talentNeeded} set={(talentNeeded) => updateForm("talentNeeded", talentNeeded)} type="number" min="1" placeholder="e.g. 12" />
            <Input label="Requirements" value={form.requirements} set={(requirements) => updateForm("requirements", requirements)} placeholder="Separate tags with commas" className="sm:col-span-2" />
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Brief description</span>
              <textarea required rows={4} value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
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
              </select>
            </label>
            <div className="flex items-end">
              <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-navy font-bold text-white hover:bg-brand-blue disabled:opacity-60">{saving ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}{saving ? "Publishing..." : form.status === "published" ? "Publish brief" : "Save draft"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="mt-7 space-y-4">
        {briefs.map((brief) => (
          <BriefCard
            key={brief.id}
            brief={brief}
            applications={applicationsByBrief[brief.id] ?? []}
            onClose={() => setClosingBrief(brief)}
          />
        ))}
        {!briefs.length && <div className="rounded-3xl border-2 border-dashed border-brand-silver bg-white p-10 text-center"><Plus className="mx-auto size-8 text-brand-blue" /><p className="mt-4 font-bold">Your brief board is clear.</p></div>}
      </section>

      {closingBrief && (
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
    </div>
  );
}

function BriefCard({ brief, applications, onClose }: { brief: AgentBrief; applications: Application[]; onClose: () => void }) {
  const bookedCount = applications.filter((application) => application.status === "booked").length;
  const remaining = Math.max((brief.talentNeeded || 0) - bookedCount, 0);
  const totalLabel = brief.talentNeeded ? `${remaining} remaining of ${brief.talentNeeded}` : `${bookedCount} booked`;
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
          <p className="text-2xl font-bold text-brand-navy">{brief.talentNeeded ? remaining : bookedCount}</p>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{brief.talentNeeded ? "Still needed" : "Booked"}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-blue" />{brief.location || "Location pending"}</span>
        <span className="flex items-center gap-1"><Clock3 className="size-4 text-brand-blue" />{brief.shootDate || "Date pending"}</span>
        <span className="flex items-center gap-1"><UsersRound className="size-4 text-brand-blue" />{totalLabel}</span>
      </div>
      {brief.status === "closed" && (brief.closeMessage || brief.whatsappLink) && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          {brief.closeMessage && <p>{brief.closeMessage}</p>}
          {brief.whatsappLink && <a href={brief.whatsappLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-bold text-brand-blue"><MessageCircle className="size-4" />WhatsApp group</a>}
        </div>
      )}
      {brief.status === "published" && (
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-bold text-white hover:bg-brand-blue">
            <CheckCircle2 className="size-4" />Close brief
          </button>
        </div>
      )}
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

function Input({ label, value, set, required, placeholder, type, min, className = "" }: { label: string; value: string; set: (value: string) => void; required?: boolean; placeholder?: string; type?: string; min?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input required={required} value={value} placeholder={placeholder} type={type ?? "text"} min={min} onChange={(event) => set(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20" />
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
