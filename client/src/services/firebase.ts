import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut } from 'firebase/auth';

export const firebaseEnabled = import.meta.env.VITE_AUTH_PROVIDER === 'firebase';
export function firebaseAuth() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(config).some(value => !value)) throw new Error('Fill in the Firebase settings in client/.env and restart the frontend.');
  return getAuth(getApps()[0] ?? initializeApp(config));
}
export async function firebaseLogin(email: string, password: string) {
  const {user} = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  if (!user.emailVerified) {
    try { await sendEmailVerification(user); }
    finally { await signOut(firebaseAuth()); }
    throw new Error('A verification email has been sent. Verify your email before signing in.');
  }
}
export async function firebaseLogout() { await signOut(firebaseAuth()); }
export async function firebaseRegister(name: string, email: string, password: string) {
  const auth = firebaseAuth();
  const {user} = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(user, {displayName:name});
    await sendEmailVerification(user);
  } finally { await signOut(auth); }
}
export async function firebaseGoogleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt: 'select_account'});
  // Firebase creates an account on first use and signs in existing users with the same flow.
  await signInWithPopup(firebaseAuth(), provider);
}
export function firebaseErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'An account already exists for this email. Sign in or reset your password.';
    case 'auth/weak-password': return 'Choose a stronger password that meets the project password requirements.';
    case 'auth/invalid-credential': return 'The email or password is incorrect.';
    case 'auth/operation-not-allowed': return 'Google sign-in is not enabled. Enable the Google provider in Firebase Authentication.';
    case 'auth/unauthorized-domain': return 'This website domain must be added to Firebase Authentication authorized domains.';
    case 'auth/popup-blocked': return 'Your browser blocked the Google sign-in window. Allow popups and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Google sign-in was cancelled. Please try again.';
    case 'auth/account-exists-with-different-credential': return 'This email uses another sign-in method. Sign in with your existing method.';
    case 'auth/network-request-failed': return 'Unable to reach Google sign-in. Check your connection and try again.';
    default: return error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
  }
}
export async function resetPassword(email: string) { await sendPasswordResetEmail(firebaseAuth(), email); }
export async function firebaseToken() {
  return (await firebaseSession())?.token;
}
export function watchFirebaseUser(listener: (uid: string | undefined) => void) {
  return onAuthStateChanged(firebaseAuth(),user=>listener(user?.uid));
}
export async function firebaseSession() {
  const auth = firebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if(!user) return undefined;
  const token = await user.getIdToken();
  if(auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Please try again.');
  return {token,uid:user.uid};
}
