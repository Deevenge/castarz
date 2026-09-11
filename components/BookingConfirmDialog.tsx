"use client";

import Image from "next/image";
import { CalendarDays, CheckCircle2, LoaderCircle, MapPin, WalletCards, X } from "lucide-react";

interface BookingConfirmDialogProps {
  actorName: string;
  headshot?: string;
  briefTitle: string;
  location: string;
  shootDate: string;
  rate: string;
  working: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function BookingConfirmDialog({ actorName, headshot, briefTitle, location, shootDate, rate, working, onClose, onConfirm }: BookingConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-brand-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-brand-blue">CONFIRM BOOKING</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">Lock this actor in?</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-brand-ice p-4">
          <div className="flex size-16 overflow-hidden rounded-2xl bg-brand-navy">
            {headshot ? <Image src={headshot} alt="" width={64} height={64} unoptimized className="size-full object-cover" /> : null}
          </div>
          <div>
            <p className="font-bold text-brand-navy">{actorName}</p>
            <p className="mt-1 text-sm text-slate-600">{briefTitle}</p>
          </div>
        </div>
        <ul className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
          <li className="flex items-center gap-2"><MapPin className="size-4 text-brand-blue" />{location || "Location pending"}</li>
          <li className="flex items-center gap-2"><CalendarDays className="size-4 text-brand-blue" />{shootDate || "Date pending"}</li>
          <li className="flex items-center gap-2"><WalletCards className="size-4 text-brand-blue" />{rate || "Rate pending"}</li>
        </ul>
        <p className="mt-5 text-sm leading-6 text-slate-600">Confirming notifies the actor, marks the application as booked, and stores this as a confirmed booking for the brief.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Not yet</button>
          <button type="button" disabled={working} onClick={onConfirm} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {working ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {working ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      </section>
    </div>
  );
}
