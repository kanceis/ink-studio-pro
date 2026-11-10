import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import appletConfig from '../../firebase-applet-config.json';

/**
 * Firebase configuration.
 *
 * Defaults to the project that Google AI Studio created for this app
 * (firebase-applet-config.json). Any value can be overridden at build time
 * with VITE_FIREBASE_* variables, so the app can be moved to another
 * Firebase project without touching code.
 */
const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

/** Firestore database id. AI Studio sometimes creates a named database instead of "(default)". */
export const FIRESTORE_DATABASE_ID: string =
  env.VITE_FIRESTORE_DATABASE_ID ||
  (appletConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  '(default)';

/** All studio data lives under studios/{STUDIO_ID}. */
export const STUDIO_ID: string = env.VITE_STUDIO_ID || 'main';

/** Local development against the Firebase Emulator Suite (npm run emulators). */
export const USE_EMULATORS: boolean = env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
