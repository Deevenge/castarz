"use client";

import { type User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";

export type UserRole = "actor" | "agent";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshUserProfile: (uid?: string) => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUserRole(value: unknown): value is UserRole {
  return value === "actor" || value === "agent";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = useCallback(async (uid?: string) => {
    const targetUid = uid ?? auth.currentUser?.uid;
    if (!targetUid) {
      setProfile(null);
      return null;
    }

    const snapshot = await getDoc(doc(db, "users", targetUid));
    const data = snapshot.data();
    if (!snapshot.exists() || !data || !isUserRole(data.role) || typeof data.email !== "string") {
      setProfile(null);
      return null;
    }

    const nextProfile: UserProfile = { uid: targetUid, email: data.email, role: data.role };
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      try {
        if (nextUser) await refreshUserProfile(nextUser.uid);
        else setProfile(null);
      } catch (error) {
        console.error("Unable to load the user profile.", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [refreshUserProfile]);

  const value = useMemo<AuthContextValue>(() => ({ user, profile, loading, refreshUserProfile, signOut: () => firebaseSignOut(auth) }), [loading, profile, refreshUserProfile, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider.");
  return context;
}
