"use client";

import { type FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Building2, Eye, EyeOff, LoaderCircle, UserRound } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type UserRole, useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import logo from "@/app/images/logoz.gif";

type AuthMode = "signIn" | "signUp";

const messages: Record<string, string> = {
  "auth/email-already-in-use": "An account already exists with this email address.",
  "auth/invalid-credential": "That email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/operation-not-allowed": "Email and password sign-in is not enabled yet. Please contact support.",
  "permission-denied": "We could not create your profile. Please try again or contact support.",
};

function readableError(error: unknown): string {
  const code = (error as FirebaseError).code;
  return messages[code] ?? "Something went wrong. Please try again.";
}

export default function AuthPage() {
  const router = useRouter();
  const { loading: authLoading, profile, user, refreshUserProfile } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("actor");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user && profile) router.replace(`/${profile.role}/dashboard`);
  }, [authLoading, profile, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signIn") {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const userProfile = await refreshUserProfile(credential.user.uid);
        if (!userProfile) throw new Error("Your account profile could not be found. Please contact support.");
        router.replace(`/${userProfile.role}/dashboard`);
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email ?? email.trim(),
        role,
        createdAt: serverTimestamp(),
      });
      await refreshUserProfile(credential.user.uid);
      router.replace(`/${role}/dashboard`);
    } catch (caughtError) {
      setError(caughtError instanceof Error && !("code" in caughtError) ? caughtError.message : readableError(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const signUp = mode === "signUp";
  const actionLabel = signUp ? `Create ${role} account` : "Sign in";
  const fieldStyle = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-cyan/20 disabled:bg-slate-100";

  return (
    <main className="min-h-dvh bg-brand-ice px-4 py-6 sm:flex sm:items-center sm:justify-center sm:p-8">
      <section className="mx-auto flex w-full max-w-md flex-col sm:max-w-[440px]">
        <div className="mb-8 px-2 text-center sm:mb-6"><Image src={logo} alt="CASTARZ — The Casting Network" priority unoptimized className="mx-auto mb-4 h-auto w-60" /><p className="text-sm font-bold tracking-[0.24em] text-brand-blue">THE CASTING NETWORK</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-navy">{signUp ? "Join the cast" : "Welcome back"}</h1><p className="mt-2 text-base text-slate-600">{signUp ? "Start managing casting the smarter way." : "Sign in to continue to your casting workspace."}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8 sm:shadow-xl sm:shadow-slate-200/60">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication options">
            <button type="button" onClick={() => { setMode("signIn"); setError(""); }} className={`min-h-11 rounded-lg text-sm font-semibold transition ${!signUp ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Sign in</button>
            <button type="button" onClick={() => { setMode("signUp"); setError(""); }} className={`min-h-11 rounded-lg text-sm font-semibold transition ${signUp ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Create account</button>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {signUp && <fieldset><legend className="mb-3 text-sm font-semibold text-slate-800">I am joining as an</legend><div className="grid grid-cols-2 gap-3">{(["actor", "agent"] as const).map((option) => { const Icon = option === "actor" ? UserRound : Building2; const selected = role === option; return <button key={option} type="button" onClick={() => setRole(option)} aria-pressed={selected} className={`flex min-h-24 flex-col items-start justify-center rounded-2xl border-2 p-4 text-left transition ${selected ? "border-brand-blue bg-brand-ice text-brand-navy" : "border-slate-200 text-slate-700 hover:border-brand-cyan"}`}><Icon className="mb-2 size-5" /><span className="font-semibold capitalize">{option}</span></button>; })}</div><p className="mt-3 text-sm text-slate-500">You&apos;ll start in your {role} workspace after creating your account.</p></fieldset>}
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Email address</span><input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={submitting} placeholder="you@example.com" className={fieldStyle} /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Password</span><span className="relative block"><input type={showPassword ? "text" : "password"} autoComplete={signUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} disabled={submitting} placeholder="At least 6 characters" className={`${fieldStyle} pr-12`} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-900" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 text-base font-bold text-white transition hover:bg-brand-navy focus:outline-none focus:ring-4 focus:ring-brand-cyan/40 disabled:cursor-not-allowed disabled:bg-brand-blue/50">{submitting && <LoaderCircle className="size-5 animate-spin" />}{submitting ? "Please wait…" : actionLabel}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
