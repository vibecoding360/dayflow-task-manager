import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  doc, getDoc, getFirestore, serverTimestamp, setDoc
} from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(config).every(Boolean);
const app = firebaseReady ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

/**
 * Provision a user's initial personal workspace.
 * The workspace ID is deterministic per owner for idempotent setup.
 * Existing user-scoped tasks are intentionally left in place until a
 * separately verified migration is run.
 */
export async function ensurePersonalWorkspace(user) {
  if (!db || !user?.uid) throw new Error("Firebase is not configured or user is missing.");

  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const workspaceRef = doc(db, "workspaces", uid);
  const memberRef = doc(db, "workspaces", uid, "members", uid);

  const [userSnapshot, workspaceSnapshot] = await Promise.all([
    getDoc(userRef),
    getDoc(workspaceRef),
  ]);

  const profile = userSnapshot.exists() ? userSnapshot.data() : {};
  const existingWorkspace = workspaceSnapshot.exists() ? workspaceSnapshot.data() : {};

  // Keep these writes ordered: the membership rule checks that the
  // workspace already exists before allowing its first owner membership.
  await setDoc(userRef, {
    email: user.email || "",
    displayName: user.displayName || profile.displayName || "",
    defaultWorkspaceId: uid,
    updatedAt: serverTimestamp(),
    ...(!userSnapshot.exists() ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });

  await setDoc(workspaceRef, {
    name: existingWorkspace.name || "Personal workspace",
    ownerId: uid,
    type: "personal",
    plan: existingWorkspace.plan || "free",
    status: "active",
    updatedAt: serverTimestamp(),
    ...(!workspaceSnapshot.exists() ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });

  await setDoc(memberRef, {
    userId: uid,
    role: "owner",
    status: "active",
    updatedAt: serverTimestamp(),
    ...(!workspaceSnapshot.exists() ? { joinedAt: serverTimestamp() } : {}),
  }, { merge: true });

  return {
    id: uid,
    name: existingWorkspace.name || "Personal workspace",
    type: "personal",
    plan: existingWorkspace.plan || "free",
    role: "owner",
  };
}
