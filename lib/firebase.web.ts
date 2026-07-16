import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAB0Bk_hlPsiZp-9qot-VddaAyxJWkvvq4",
  authDomain: "skill-swap-community-c5400.firebaseapp.com",
  projectId: "skill-swap-community-c5400",
  storageBucket: "skill-swap-community-c5400.firebasestorage.app",
  messagingSenderId: "959736365219",
  appId: "1:959736365219:web:37ae018fbe458e957fff16"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth as webAuth, googleProvider, signInWithPopup };
export const nativeAuth = null;
