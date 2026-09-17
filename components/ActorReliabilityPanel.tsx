"use client";

import { AlertTriangle, CalendarClock, ShieldCheck, TrendingUp } from "lucide-react";

export type ReliabilityApplication = {
  status: string;
  cancelledAtMs: number;
};

function reliabilityStats(applications: ReliabilityApplication[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const cancellations = applications.filter((application) => application.status === "cancelled");
  const datedCancellations = cancellations.filter((application) => application.cancelledAtMs > 0);
  const week = datedCancellations.filter((application) => application.cancelledAtMs >= weekAgo).length;
  const month = datedCancellations.filter((application) => application.cancelledAtMs >= monthAgo).length;
  const total = cancellations.length;
  const booked = applications.filter((application) => application.status === "booked").length;
  const decisions = applications.filter((application) => ["booked", "cancelled", "rejected", "standby", "selected", "replacement_available"].includes(application.status)).length;
  const score = total === 0 ? 96 : Math.max(42, Math.min(98, 100 - total * 8 - month * 8 - week * 10));
  const label = total === 0
    ? "Clean agency record"
    : score >= 85
      ? "Reliable"
      : score >= 70
        ? "Watch context"
        : "Cancellation risk";
  const tone = total === 0 || score >= 85
    ? "emerald"
    : score >= 70
      ? "amber"
      : "red";
  return { booked, decisions, label, month, score, tone, total, week };
}

export function ActorReliabilityPanel({ applications, compact = false }: { applications: ReliabilityApplication[]; compact?: boolean }) {
  const stats = reliabilityStats(applications);
  const toneClass = stats.tone === "emerald"
    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
    : stats.tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-800"
      : "border-red-100 bg-red-50 text-red-800";
  const meterClass = stats.tone === "emerald" ? "bg-emerald-500" : stats.tone === "amber" ? "bg-amber-500" : "bg-red-500";

  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${compact ? "" : "sm:p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-brand-blue">
            <ShieldCheck className="size-4" />Agency-only reliability
          </p>
          <h3 className="mt-1 font-bold text-brand-navy">Booking accountability signal</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Visible to agencies only. Based on this agency&apos;s booking/application history with this actor.</p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-right ${toneClass}`}>
          <p className="text-2xl font-black">{stats.score}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.12em]">{stats.label}</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${meterClass}`} style={{ width: `${stats.score}%` }} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <ReliabilityMetric icon={AlertTriangle} label="7 days" value={stats.week} tone={stats.week ? "text-red-700" : "text-emerald-700"} />
        <ReliabilityMetric icon={CalendarClock} label="30 days" value={stats.month} tone={stats.month ? "text-amber-700" : "text-emerald-700"} />
        <ReliabilityMetric icon={AlertTriangle} label="Total cancels" value={stats.total} tone={stats.total ? "text-red-700" : "text-emerald-700"} />
        <ReliabilityMetric icon={TrendingUp} label="Confirmed" value={stats.booked} tone="text-brand-blue" />
      </div>
    </section>
  );
}

function ReliabilityMetric({ icon: Icon, label, value, tone }: { icon: typeof ShieldCheck; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-brand-ice/60 px-3 py-3">
      <p className={`flex items-center gap-1.5 text-xl font-black ${tone}`}><Icon className="size-4" />{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}
