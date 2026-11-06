import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { firebaseApp, USE_EMULATORS } from './firebaseApp';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
];

export const auth = getAuth(firebaseApp);
if (USE_EMULATORS) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso Google Workspace');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign in to the studio app (identity only, no Calendar/Gmail scopes).
 * Access to the data is decided by Firestore rules (studios/{id}.members).
 */
export const signInToStudio = async (): Promise<User> => {
  const loginProvider = new GoogleAuthProvider();
  loginProvider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, loginProvider);
  return result.user;
};

/** Forget the Google Calendar/Gmail token but stay signed in to the studio. */
export const disconnectGoogleWorkspace = () => {
  cachedAccessToken = null;
};

/** Full sign-out from the studio app. */
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
