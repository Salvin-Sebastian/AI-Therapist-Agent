import { useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import Chat from "./Chat";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser?.isAnonymous) {
        localStorage.setItem("userId", currentUser.uid);
      }
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginAnonymously = async () => {
    await signInAnonymously(auth);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.clear();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-therapeutic-100/30 border-t-therapeutic-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-calm-400 font-medium animate-pulse">Loading your space...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-calm-50 via-calm-100 to-therapeutic-50 flex items-center justify-center p-4">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-therapeutic-500/5 blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-therapeutic-300/5 blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        
        <div className="w-full max-w-md bg-calm-100/60 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] border border-calm-200/20 p-10 space-y-8 relative z-10 animate-fade-in">
          
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 rounded-2xl flex items-center justify-center mx-auto shadow-md border border-therapeutic-500/20 mb-6 rotate-3">
              <span className="text-4xl">🪴</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-calm-800 tracking-tight">AI Therapist</h1>
            <p className="text-calm-500 text-base leading-relaxed px-4">
              A private, judgment-free space to talk, reflect, and grow.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <button
              onClick={loginWithGoogle}
              className="w-full relative group bg-therapeutic-500 text-calm-50 py-4 rounded-2xl font-semibold overflow-hidden shadow-lg shadow-therapeutic-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-therapeutic-500/30 cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </span>
            </button>

            <button
              onClick={loginAnonymously}
              className="w-full bg-calm-200/40 border border-calm-300/20 py-4 rounded-2xl font-semibold hover:bg-calm-200/80 hover:border-calm-300/40 transition-all hover:-translate-y-0.5 cursor-pointer text-calm-700"
            >
              Continue Anonymously
            </button>
          </div>

          <p className="text-xs text-center text-calm-400">
            Anonymous chats are private and not saved permanently
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh bg-calm-50 overflow-hidden">
      <Chat user={user} logout={logout} />
    </div>
  );
}
