import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, query, where, updateDoc, serverTimestamp } from "firebase/firestore";

const CRISIS_KEYWORDS = [
  "kill myself",
  "kill my self",
  "end my life",
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "hurt myself",
  "hurt someone",
  "kill someone",
  "want to die",
  "can't go on",
  "no reason to live",
  "feel hopeless",
  "hopelessness"
];

function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(k => text.toLowerCase().includes(k));
}

export default function Chat({ user, logout }) {
  const isAnonymous = user.isAnonymous;
  const userId = user.uid;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(
    !isAnonymous ? localStorage.getItem("sessionId") : null
  );
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [crisisAlert, setCrisisAlert] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (isAnonymous) {
      setMessages([]);
      setSessions([]);
      setSessionId(null);
      localStorage.removeItem("sessionId");
    }
  }, [isAnonymous]);

  const fetchSessions = useCallback(async () => {
    if (isAnonymous) return;
    try {
      const q = query(collection(db, "sessions"), where("userId", "==", userId), where("saved", "==", true));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ sessionId: doc.id, ...doc.data() }));
      
      data.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
      });

      setSessions(data);
    } catch (err) {
      console.warn("Failed to fetch sessions from Firestore, falling back to localStorage:", err);
      const localData = JSON.parse(localStorage.getItem(`local_sessions_${userId}`) || "[]");
      setSessions(localData);
    }
  }, [userId, isAnonymous]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!sessionId || isAnonymous) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const docRef = doc(db, "sessions", sessionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().userId === userId) {
          setMessages(docSnap.data().messages || []);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.warn("Failed to fetch messages from Firestore, checking localStorage:", err);
        const localSessions = JSON.parse(localStorage.getItem(`local_sessions_${userId}`) || "[]");
        const found = localSessions.find(s => s.sessionId === sessionId);
        if (found) {
          setMessages(found.messages || []);
        } else {
          setMessages([]);
        }
      }
    };

    fetchMessages();
  }, [sessionId, userId, isAnonymous]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);
    setCrisisAlert(false);

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);

    if (detectCrisis(userText)) {
      setCrisisAlert(true);
      const reply = "I’m really sorry you’re feeling this way. You’re not alone. Help is available right now.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      setLoading(false);
      return;
    }

    try {
      let currentSessionId = sessionId;

      if (!isAnonymous) {
        if (!currentSessionId) {
          currentSessionId = uuidv4();
          setSessionId(currentSessionId);
          localStorage.setItem("sessionId", currentSessionId);
        }

        try {
          const docRef = doc(db, "sessions", currentSessionId);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            await setDoc(docRef, {
              sessionId: currentSessionId,
              userId,
              title: userText.slice(0, 30),
              messages: newMessages,
              saved: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            await updateDoc(docRef, {
              messages: newMessages,
              updatedAt: serverTimestamp()
            });
          }
        } catch (dbErr) {
          console.warn("Firestore save bypassed (pre-completion) due to permissions/connectivity:", dbErr);
        }
      }

      const userName = user.displayName ? user.displayName.split(' ')[0] : "";
      const systemContent = userName
        ? `You are a kind, empathetic, and professional AI therapist. The user's name is ${userName}. Welcome them warmly, and greet them by name when appropriate in your responses to make the therapy feel personal, safe, and supportive.`
        : "You are a kind, empathetic, and professional AI therapist.";

      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemContent: systemContent
        })
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response from backend.");
      }

      const data = await response.json();
      const reply = data.reply;
      const finalMessages = [...newMessages, { role: "assistant", content: reply }];
      
      setMessages(finalMessages);

      if (!isAnonymous && currentSessionId) {
         try {
           const docRef = doc(db, "sessions", currentSessionId);
           await updateDoc(docRef, {
              messages: finalMessages,
              updatedAt: serverTimestamp()
           });
         } catch (dbErr) {
           console.warn("Firestore save bypassed (post-completion) due to permissions/connectivity:", dbErr);
         }
      }

    } catch (err) {
      console.error("Detailed Chat Error:", err);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `I'm really sorry, but I encountered an error: ${err.message || err.toString()}. Please make sure your Firebase database is initialized and your API keys are valid.` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async () => {
    if (!sessionId) return;
    try {
      const docRef = doc(db, "sessions", sessionId);
      await updateDoc(docRef, { saved: true, updatedAt: serverTimestamp() });
      await fetchSessions();
    } catch (err) {
      console.warn("Failed to save session to Firestore, saving to localStorage instead:", err);
      
      const localSessions = JSON.parse(localStorage.getItem(`local_sessions_${userId}`) || "[]");
      
      const existingIdx = localSessions.findIndex(s => s.sessionId === sessionId);
      const newSessionObj = {
        sessionId,
        userId,
        title: messages[0]?.content?.slice(0, 30) || "Untitled Session",
        messages,
        saved: true,
        updatedAt: { seconds: Math.floor(Date.now() / 1000) }
      };

      if (existingIdx > -1) {
        localSessions[existingIdx] = newSessionObj;
      } else {
        localSessions.push(newSessionObj);
      }

      localSessions.sort((a, b) => (b.updatedAt.seconds || 0) - (a.updatedAt.seconds || 0));
      
      localStorage.setItem(`local_sessions_${userId}`, JSON.stringify(localSessions));
      setSessions(localSessions);
    }
  };

  const newChat = async () => {
    if (messages.length > 0) {
      await summarizeSession();
    }
    setSessionId(null);
    setMessages([]);
    setCrisisAlert(false);
    localStorage.removeItem("sessionId");
    setSidebarOpen(false);
  };

  const deleteSession = async (id) => {
    try {
      const localSessions = JSON.parse(localStorage.getItem(`local_sessions_${userId}`) || "[]");
      const filtered = localSessions.filter(s => s.sessionId !== id);
      localStorage.setItem(`local_sessions_${userId}`, JSON.stringify(filtered));
      setSessions(filtered);
    } catch (localErr) {
      console.warn("Failed to delete from localStorage:", localErr);
    }

    try {
      await deleteDoc(doc(db, "sessions", id));
      await fetchSessions();
      if (id === sessionId) {
        setSessionId(null);
        setMessages([]);
        setCrisisAlert(false);
        localStorage.removeItem("sessionId");
      }
    } catch (err) {
      console.warn("Failed to delete session from Firestore (already handled locally):", err);
      if (id === sessionId) {
        setSessionId(null);
        setMessages([]);
        setCrisisAlert(false);
        localStorage.removeItem("sessionId");
      }
    }
  };

  const summarizeSession = async () => {
    if (messages.length === 0) return;
    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: messages.map(m => `${m.role}: ${m.content}`).join("\n")
            }
          ],
          systemContent: "You are a therapist. Summarize briefly and suggest 3 coping steps."
        })
      });

      if (!response.ok) {
        throw new Error("Failed to fetch summary from backend.");
      }

      const data = await response.json();
      const text = data.reply;
      
      let parsedSummary = text.trim();
      let parsedSteps = [];

      const match = text.match(/(?:Coping\s+Steps|coping\s+steps)[:\s\-#]*/i);
      if (match) {
        const index = match.index;
        parsedSummary = text.substring(0, index).trim();
        const stepsStr = text.substring(index + match[0].length).trim();
        parsedSteps = stepsStr 
          ? stepsStr
              .split("\n")
              .map(s => s.trim())
              .filter(s => s.length > 0)
              .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
              .filter(s => s.length > 0)
              .slice(0, 3)
          : [];
      }

      setSessionSummary({ summary: parsedSummary, copingSteps: parsedSteps });

      if (!isAnonymous && sessionId) {
        const docRef = doc(db, "sessions", sessionId);
        await updateDoc(docRef, {
          summary: parsedSummary,
          copingSteps: parsedSteps,
          updatedAt: serverTimestamp()
        });
      }

    } catch (err) {
      console.error("Failed to generate summary", err);
    }
  };

  const isCurrentSaved = sessions.some(s => s.sessionId === sessionId);

  return (
    <div className="flex h-dvh bg-calm-50 font-sans overflow-hidden">
      {!isAnonymous && (
        <>
          {sidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity" 
              onClick={() => setSidebarOpen(false)} 
            />
          )}
          <aside className={`fixed md:static inset-y-0 left-0 w-[85%] max-w-[320px] md:w-[320px] bg-slate-900 border-r border-slate-800/40 p-6 flex flex-col shadow-2xl md:shadow-[4px_0_24px_rgba(0,0,0,0.3)] z-50 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
            
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-therapeutic-500/20">🪴</div>
                <div>
                  <h2 className="font-display font-bold text-slate-100 text-xl tracking-tight">AI Therapist</h2>
                  <p className="text-xs font-semibold text-slate-400">Safe & Private Space</p>
                </div>
              </div>
              <button 
                className="md:hidden text-slate-400 hover:text-white bg-slate-800/50 p-2 rounded-xl transition-colors cursor-pointer" 
                onClick={() => setSidebarOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <button
              onClick={newChat}
              className="mb-8 bg-gradient-to-r from-therapeutic-500 to-therapeutic-600 text-white py-4 px-6 rounded-full font-bold hover:from-therapeutic-600 hover:to-therapeutic-700 transition-all shadow-[0_8px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              Start New Session
            </button>

            {sessionId && messages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-8">
                <button
                  onClick={saveSession}
                  disabled={isCurrentSaved}
                  className={`py-3 rounded-2xl text-sm font-semibold transition-all shadow-sm flex flex-col items-center justify-center gap-1.5 border group cursor-pointer ${
                    isCurrentSaved
                      ? "bg-therapeutic-500/10 text-therapeutic-400 border-therapeutic-500/20 opacity-80 cursor-default"
                      : "bg-slate-800/40 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-700/50 border-slate-700/20 hover:shadow-md"
                  }`}
                >
                  <span className={`text-xl ${isCurrentSaved ? "" : "group-hover:scale-110 transition-transform"}`}>
                    {isCurrentSaved ? "✅" : "💾"}
                  </span>
                  {isCurrentSaved ? "Saved" : "Save Chat"}
                </button>

                <button
                  onClick={summarizeSession}
                  className="bg-slate-800/40 text-slate-200 py-3 rounded-2xl text-sm font-semibold hover:bg-slate-800 hover:text-white transition-all shadow-sm hover:shadow-md flex flex-col items-center justify-center gap-1.5 border border-slate-700/20 hover:border-slate-700/50 group cursor-pointer"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
                  Insights
                </button>
              </div>
            )}

            <div className="text-xs font-bold text-calm-400 mb-4 uppercase tracking-widest px-2">Past Sessions</div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {sessions.map(s => (
                <div
                  key={s.sessionId}
                  onClick={() => {
                    setSessionId(s.sessionId);
                    setSidebarOpen(false);
                  }}
                  className={`p-3.5 rounded-2xl cursor-pointer flex justify-between items-center group transition-all ${s.sessionId === sessionId
                      ? "bg-gradient-to-r from-therapeutic-500/10 to-calm-200/10 border border-therapeutic-500/20 shadow-sm"
                      : "hover:bg-calm-200/40 border border-transparent"
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`text-lg flex-shrink-0 ${s.sessionId === sessionId ? "text-therapeutic-400" : "text-calm-400"}`}>💬</span>
                    <span className={`truncate text-sm font-medium ${s.sessionId === sessionId ? "text-therapeutic-300" : "text-calm-500"}`}>
                      {s.title || "Untitled Session"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.sessionId);
                    }}
                    className="text-calm-400 hover:text-red-400 hover:bg-red-500/10 rounded-full p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
                    title="Delete Session"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-sm text-calm-400 text-center py-6 italic bg-calm-200/20 rounded-2xl border border-dashed border-calm-300/10">
                  No saved sessions yet.
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

        <header className="bg-calm-100/80 backdrop-blur-md border-b border-calm-200/20 p-4 md:p-5 flex items-center justify-between z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            {!isAnonymous && (
              <button className="md:hidden text-calm-600 hover:text-calm-800 bg-calm-200/40 p-2 rounded-xl transition-colors cursor-pointer mr-1 border border-calm-300/20" onClick={() => setSidebarOpen(true)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
            )}
            <div className="hidden sm:flex w-10 h-10 bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 rounded-xl items-center justify-center text-xl shadow-sm border border-therapeutic-500/20">🪴</div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-calm-800 text-sm md:text-base leading-tight truncate">AI Therapist Space</h2>
              {!isAnonymous && (
                <p className="text-[10px] text-therapeutic-400 font-semibold uppercase tracking-wider mt-0.5 animate-pulse truncate">
                  Logged In • {user.displayName?.split(' ')[0]}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 ml-2">
            {isAnonymous ? (
              <>
                {messages.length > 0 && (
                  <button
                    onClick={newChat}
                    className="bg-therapeutic-500/20 text-therapeutic-400 border border-therapeutic-500/30 px-3 md:px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-therapeutic-500/30 transition-colors cursor-pointer shadow-sm hover:shadow"
                  >
                    New Chat
                  </button>
                )}
                <span className="hidden sm:inline-block text-xs font-semibold text-calm-500 bg-calm-200/50 px-4 py-1.5 rounded-full uppercase tracking-wide">Ephemeral</span>
              </>
            ) : (
              <button
                onClick={logout}
                className="bg-calm-200/40 hover:bg-red-500/10 border border-calm-300/10 hover:border-red-500/30 text-xs text-calm-600 hover:text-red-400 px-4 py-2 rounded-full transition-all cursor-pointer font-medium"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        {crisisAlert && (
          <div className="bg-gradient-to-r from-red-950/40 to-calm-100 border-b border-red-500/20 p-4 md:p-5 animate-slide-down flex items-start gap-4 z-20 shadow-sm shrink-0">
            <div className="text-white bg-red-600 p-2 rounded-xl mt-0.5 shadow-md shadow-red-600/10 hidden sm:block">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-bold text-base md:text-lg">Immediate Help is Available</h3>
              <p className="text-red-300 text-xs md:text-sm mt-1 mb-3">You are not alone. If you are in crisis, please reach out to these free, confidential resources immediately:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium">
                <a href="tel:988" className="flex items-center gap-2 bg-calm-200/50 border border-red-500/20 p-3 rounded-xl hover:shadow-md transition-all text-red-300 cursor-pointer">
                  <span className="text-xl">📞</span> Suicide & Crisis Lifeline: <span className="underline font-bold">988</span>
                </a>
                <div className="flex items-center gap-2 bg-calm-200/50 border border-red-500/20 p-3 rounded-xl text-red-300">
                  <span className="text-xl">💬</span> Crisis Text Line: Text <span className="font-bold">HOME</span> to <span className="font-bold">741741</span>
                </div>
              </div>
            </div>
            <button onClick={() => setCrisisAlert(false)} className="text-red-400 hover:text-red-300 bg-red-950/20 p-2 rounded-full transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-calm-50 relative flex flex-col">
          <div className="absolute top-1/4 left-1/4 w-[35%] h-[35%] rounded-full bg-therapeutic-500/5 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[35%] h-[35%] rounded-full bg-therapeutic-300/5 blur-3xl pointer-events-none" style={{ animationDelay: '2s' }}></div>

          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col transition-transform md:translate-x-6 lg:translate-x-12">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 md:space-y-5 relative z-10 animate-fade-in py-12 px-4">
                <div className="text-6xl md:text-7xl mb-2 drop-shadow-md animate-pulse">✨</div>
                <h3 className="text-2xl md:text-3xl font-display font-bold text-slate-100">
                  {user.displayName ? `Welcome, ${user.displayName.split(' ')[0]}!` : "Welcome to the Chat!"}
                </h3>
                <h4 className="text-lg md:text-xl font-display font-semibold text-slate-300 mt-1">How are you feeling today?</h4>
                <p className="text-slate-400 text-sm md:text-[15px] leading-relaxed mt-2 max-w-lg">
                  Share whatever is on your mind. This is a completely safe, private, and judgment-free space for you to explore your thoughts and emotions.
                </p>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8 relative z-10 flex-1 py-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                    <div className={`flex gap-3 md:gap-4 max-w-[90%] md:max-w-[75%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs md:text-sm font-bold shadow-sm ${
                        m.role === "user" 
                          ? "bg-slate-800 text-slate-300 border border-slate-700/20" 
                          : "bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 text-therapeutic-400 border border-therapeutic-500/20 text-base md:text-lg"
                        }`}>
                        {m.role === "user" ? "U" : "🪴"}
                      </div>

                      <div className={`px-5 py-3.5 md:px-6 md:py-4 rounded-[1.5rem] shadow-sm text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap ${
                          m.role === "user"
                          ? "bg-therapeutic-600 text-white font-medium rounded-tr-sm shadow-md shadow-therapeutic-500/15"
                          : "bg-slate-800/90 border border-slate-700/30 text-slate-100 rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                        }`}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex gap-3 md:gap-4 max-w-[85%] md:max-w-[75%] flex-row">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center text-base md:text-lg shadow-sm bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 text-therapeutic-400 border border-therapeutic-500/20">
                        🪴
                      </div>
                      <div className="px-5 py-4 md:px-6 md:py-5 rounded-[1.5rem] bg-slate-800/90 border border-slate-700/30 rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-300 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={bottomRef} className="h-4 md:h-6" />
        </div>

        <div className="p-3 pb-5 md:p-6 md:pb-8 bg-slate-900/60 backdrop-blur-xl border-t border-slate-800/40 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] shrink-0">
          <div className="max-w-3xl mx-auto relative flex items-center gap-2 md:gap-3 bg-slate-800 border border-slate-700/30 rounded-full shadow-sm p-1.5 focus-within:ring-4 focus-within:ring-therapeutic-500/20 focus-within:border-therapeutic-500/40 transition-all md:translate-x-6 lg:translate-x-12">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="What's on your mind?"
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none h-11 md:h-12 pl-10 pr-4 md:pl-14 md:pr-5 text-slate-100 placeholder:text-slate-400 text-sm md:text-[15px]"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-tr from-therapeutic-500 to-therapeutic-400 hover:from-therapeutic-600 hover:to-therapeutic-500 disabled:from-slate-700/30 disabled:to-slate-700/30 disabled:text-slate-600 text-white w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 translate-x-px translate-y-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </div>
          <div className="text-center mt-2.5 md:mt-3">
            <span className="text-[9px] md:text-[11px] font-medium text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              AI Therapy is not a substitute for professional medical advice
            </span>
          </div>
        </div>
      </main>

      {sessionSummary && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up border border-slate-800/50">

            <div className="p-5 md:p-8 border-b border-slate-800/40 flex justify-between items-center bg-gradient-to-r from-therapeutic-500/10 to-slate-900 rounded-t-3xl">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 text-therapeutic-400 border border-therapeutic-500/20 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl md:rounded-2xl text-xl md:text-2xl shadow-sm">🧠</div>
                <div>
                  <h2 className="text-xl md:text-2xl font-display font-bold text-slate-100">Session Insights</h2>
                  <p className="text-xs md:text-sm font-semibold text-slate-400 mt-0.5">A brief summary of your session</p>
                </div>
              </div>
              <button
                onClick={() => setSessionSummary(null)}
                className="text-slate-400 hover:text-slate-100 bg-slate-800/60 p-2 md:p-2.5 rounded-full shadow-sm hover:shadow-md transition-all border border-slate-700/30 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-8 md:mb-10">
                <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                  Summary
                </h3>
                <p className="text-slate-300 leading-relaxed text-sm md:text-[15px]">{sessionSummary.summary}</p>
              </div>

              {sessionSummary.copingSteps && sessionSummary.copingSteps.length > 0 && (
                <div>
                  <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 md:mb-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Suggested Coping Steps
                  </h3>
                  <div className="space-y-3">
                    {sessionSummary.copingSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 md:gap-4 bg-slate-800/50 p-4 md:p-5 rounded-2xl border border-slate-700/30 shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:border-therapeutic-500/40 transition-all">
                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-tr from-therapeutic-500/20 to-therapeutic-300/10 text-therapeutic-400 border border-therapeutic-500/20 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 mt-0.5 shadow-sm">
                          {idx + 1}
                        </div>
                        <p className="text-slate-200 text-sm md:text-[15px] leading-relaxed pt-px md:pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
