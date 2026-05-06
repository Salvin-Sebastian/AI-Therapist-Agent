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

  // 🔄 Auth listener
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

  // 🔐 Google login
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // 👤 Anonymous login
  const loginAnonymously = async () => {
    await signInAnonymously(auth);
  };

  // 🚪 Logout account
  const logout = async () => {
    await signOut(auth);
    localStorage.clear();
  };

  // ⏳ Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }

  // 🔓 Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100 flex items-center justify-center">
  <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
    
    <div className="text-center space-y-2">
      <h1 className="text-3xl font-bold text-indigo-700">🧠 AI Therapist</h1>
      <p className="text-gray-500 text-sm">
        A private, judgment-free space to talk
      </p>
    </div>

    <div className="space-y-3">
      <button
        onClick={loginWithGoogle}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
      >
        Continue with Google
      </button>

      <button
        onClick={loginAnonymously}
        className="w-full border border-gray-300 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition"
      >
        Continue Anonymously
      </button>
    </div>

    <p className="text-xs text-center text-gray-400">
      Anonymous chats are not saved
    </p>
  </div>
</div>

    );
  }

  // ✅ Logged in
  return (
    <div className="relative">
      <button
        onClick={logout}
        className="absolute top-4 right-4 text-sm text-gray-500 hover:text-red-500"
      >
        Logout Account
      </button>

      <Chat user={user} />
    </div>
  );
}
