"use client";

import { AgencyConnections } from "@/components/AgencyConnections";

export default function ActorNetworkPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <p className="text-sm font-bold tracking-[0.18em] text-brand-blue">MY NETWORK</p>
        <h1 className="mt-1 text-3xl font-bold">Find agencies. Open their world.</h1>
        <p className="mt-2 text-slate-600">Search an agency, view their profile and live briefs, then send a connection request.</p>
      </header>
      <AgencyConnections />
    </div>
  );
}
