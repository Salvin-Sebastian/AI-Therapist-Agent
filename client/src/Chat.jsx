import { useState, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Chat({ user }) {
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

  const bottomRef = useRef(null);

  /* ---------------- RESET FOR ANONYMOUS ---------------- */
  useEffect(() => {
    if (isAnonymous) {
      setMessages([]);
      setSessions([]);
      setSessionId(null);
      localStorage.removeItem("sessionId");
    }
  }, [isAnonymous]);

  /* ---------------- LOAD SIDEBAR SESSIONS ---------------- */
  const fetchSessions = async () => {
    if (isAnonymous) return;
    try {
      const res = await fetch(`${API_URL}/sessions?userId=${userId}`);
      const data = await res.json();
      setSessions(data || []);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId, isAnonymous]);

  /* ---------------- LOAD MESSAGES ---------------- */
  useEffect(() => {
    if (!sessionId || isAnonymous) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}?userId=${userId}`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error(err);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [sessionId, userId, isAnonymous]);

  /* ---------------- AUTOSCROLL ---------------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);
    setCrisisAlert(false);

    // Optimistically add user message
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText }
    ]);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          sessionId,
          userId,
          isAnonymous
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [
          ...prev.filter(m => m !== undefined),
          { role: "assistant", content: "I'm really sorry, but I'm having trouble connecting right now. Please ensure the backend server is running and try again." }
        ]);
        return;
      }

      if (data.crisis) {
        setCrisisAlert(true);
      }

      if (!isAnonymous && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
        setSessionId(data.sessionId);
      }

      setMessages(prev => [
        ...prev.filter(m => m !== undefined),
        { role: "assistant", content: data.reply || "I didn't quite catch that." }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev.filter(m => m !== undefined),
        { role: "assistant", content: "I'm really sorry, but I couldn't reach the server. Please check your connection." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SAVE SESSION ---------------- */
  const saveSession = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_URL}/sessions/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId })
      });
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  /* ---------------- NEW CHAT ---------------- */
  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setCrisisAlert(false);
    localStorage.removeItem("sessionId");
  };

  /* ---------------- DELETE SESSION ---------------- */
  const deleteSession = async (id) => {
    try {
      await fetch(`${API_URL}/sessions/${id}?userId=${userId}`, { method: "DELETE" });
      fetchSessions();
      if (id === sessionId) {
        setSessionId(null);
        setMessages([]);
        setCrisisAlert(false);
        localStorage.removeItem("sessionId");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* ---------------- SUMMARIZE ---------------- */
  const summarizeSession = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/summarize-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId })
      });
      const data = await res.json();
      if (data.summary) setSessionSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-calm-50 font-sans">
      
      {/* -------- SIDEBAR -------- */}
      {!isAnonymous && (
        <aside className="w-[320px] bg-white border-r border-calm-200 p-6 flex flex-col shadow-[4px_0_24px_rgb(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-12 h-12 bg-gradient-to-tr from-therapeutic-200 to-therapeutic-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm">🪴</div>
            <div>
              <h2 className="font-display font-bold text-calm-800 text-xl tracking-tight">AI Therapist</h2>
              <p className="text-xs font-medium text-calm-400">Safe & Private Space</p>
            </div>
          </div>

          <button
            onClick={newChat}
            className="mb-8 bg-gradient-to-r from-therapeutic-500 to-therapeutic-600 text-white py-4 px-6 rounded-full font-semibold hover:from-therapeutic-600 hover:to-therapeutic-700 transition-all shadow-[0_8px_20px_rgb(20,184,166,0.25)] hover:shadow-[0_10px_25px_rgb(20,184,166,0.35)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
            Start New Session
          </button>

          {sessionId && messages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                onClick={saveSession}
                className="bg-white text-calm-700 py-3 rounded-2xl text-sm font-semibold hover:bg-calm-50 transition-all shadow-sm hover:shadow-md flex flex-col items-center justify-center gap-1.5 border border-calm-200 hover:border-calm-300 group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">💾</span>
                Save Chat
              </button>

              <button
                onClick={summarizeSession}
                className="bg-white text-calm-700 py-3 rounded-2xl text-sm font-semibold hover:bg-calm-50 transition-all shadow-sm hover:shadow-md flex flex-col items-center justify-center gap-1.5 border border-calm-200 hover:border-calm-300 group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
                Insights
              </button>
            </div>
          )}

          <div className="text-xs font-bold text-calm-400 mb-4 uppercase tracking-widest px-2">Past Sessions</div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => setSessionId(s.sessionId)}
                className={`p-3.5 rounded-2xl cursor-pointer flex justify-between items-center group transition-all ${
                  s.sessionId === sessionId
                    ? "bg-gradient-to-r from-therapeutic-50 to-white border border-therapeutic-200 shadow-sm"
                    : "hover:bg-calm-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`text-lg flex-shrink-0 ${s.sessionId === sessionId ? "text-therapeutic-500" : "text-calm-300"}`}>💬</span>
                  <span className={`truncate text-sm font-medium ${s.sessionId === sessionId ? "text-therapeutic-800" : "text-calm-600"}`}>
                    {s.title || "Untitled Session"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.sessionId);
                  }}
                  className="text-calm-300 hover:text-red-500 hover:bg-red-50 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Session"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-sm text-calm-400 text-center py-6 italic bg-calm-50/50 rounded-2xl border border-dashed border-calm-200">
                No saved sessions yet.
              </div>
            )}
          </div>
        </aside>
      )}

      {/* -------- CHAT AREA -------- */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header (Mobile / Anonymous) */}
        {isAnonymous && (
          <header className="bg-white/80 backdrop-blur-md border-b border-calm-200 p-5 flex items-center justify-between z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🪴</span>
              <h2 className="font-display font-bold text-calm-800 text-lg">Anonymous Session</h2>
            </div>
            <span className="text-xs font-semibold text-calm-500 bg-calm-100 px-4 py-1.5 rounded-full uppercase tracking-wide">Not Saved</span>
          </header>
        )}

        {/* Crisis Alert Banner */}
        {crisisAlert && (
          <div className="bg-gradient-to-r from-red-50 to-white border-b border-red-200 p-5 animate-slide-down flex items-start gap-4 z-20 shadow-sm">
            <div className="text-white bg-red-500 p-2 rounded-xl mt-0.5 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-lg">Immediate Help is Available</h3>
              <p className="text-red-700 text-sm mt-1 mb-3">You are not alone. If you are in crisis, please reach out to these free, confidential resources immediately:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-medium">
                <a href="tel:988" className="flex items-center gap-2 bg-white border border-red-100 p-3 rounded-xl hover:shadow-md transition-shadow text-red-800">
                  <span className="text-xl">📞</span> Suicide & Crisis Lifeline: <span className="underline font-bold">988</span>
                </a>
                <div className="flex items-center gap-2 bg-white border border-red-100 p-3 rounded-xl text-red-800">
                  <span className="text-xl">💬</span> Crisis Text Line: Text <span className="font-bold">HOME</span> to <span className="font-bold">741741</span>
                </div>
              </div>
            </div>
            <button onClick={() => setCrisisAlert(false)} className="text-red-300 hover:text-red-600 bg-red-50 p-2 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-8 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 opacity-60">
              <div className="text-7xl mb-2 drop-shadow-md">✨</div>
              <h3 className="text-2xl font-display font-bold text-calm-800">How are you feeling today?</h3>
              <p className="text-calm-600 text-[15px] leading-relaxed px-4">
                Share whatever is on your mind. This is a completely safe, private, and judgment-free space for you to explore your thoughts and emotions.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`flex gap-4 max-w-[85%] md:max-w-[70%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm ${
                    m.role === "user" ? "bg-calm-800 text-white" : "bg-gradient-to-tr from-therapeutic-200 to-therapeutic-100 text-therapeutic-800 text-lg"
                  }`}>
                    {m.role === "user" ? "U" : "🪴"}
                  </div>

                  {/* Bubble */}
                  <div className={`px-6 py-4 rounded-3xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-calm-800 text-white rounded-tr-sm"
                      : "bg-white border border-calm-100 text-calm-800 rounded-tl-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
                  }`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-4 max-w-[75%] flex-row">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg shadow-sm bg-gradient-to-tr from-therapeutic-200 to-therapeutic-100 text-therapeutic-800">
                  🪴
                </div>
                <div className="px-6 py-5 rounded-3xl bg-white border border-calm-100 rounded-tl-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-300 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-therapeutic-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-6" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white/80 backdrop-blur-xl border-t border-calm-200 z-10 shadow-[0_-10px_40px_rgb(0,0,0,0.02)]">
          <div className="max-w-4xl mx-auto relative flex items-end gap-3 bg-white rounded-[2rem] border border-calm-200 shadow-sm p-2 focus-within:ring-4 focus-within:ring-therapeutic-500/20 focus-within:border-therapeutic-300 transition-all">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Share your thoughts..."
              className="flex-1 max-h-40 min-h-[52px] bg-transparent border-none focus:ring-0 outline-none resize-none py-3.5 px-5 text-calm-800 placeholder:text-calm-400 custom-scrollbar text-[15px]"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-tr from-therapeutic-500 to-therapeutic-400 hover:from-therapeutic-600 hover:to-therapeutic-500 disabled:from-calm-200 disabled:to-calm-200 disabled:text-calm-400 text-white w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 mb-0.5 mr-0.5"
            >
              <svg className="w-5 h-5 translate-x-px translate-y-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </div>
          <div className="text-center mt-3">
             <span className="text-[11px] font-medium text-calm-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               AI Therapy is not a substitute for professional medical advice
             </span>
          </div>
        </div>
      </main>

      {/* -------- SUMMARY MODAL -------- */}
      {sessionSummary && (
        <div className="fixed inset-0 bg-calm-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up border border-white/20">
            
            <div className="p-6 md:p-8 border-b border-calm-100 flex justify-between items-center bg-gradient-to-r from-therapeutic-50 to-white rounded-t-3xl">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-tr from-therapeutic-200 to-therapeutic-100 text-therapeutic-800 w-12 h-12 flex items-center justify-center rounded-2xl text-2xl shadow-sm">🧠</div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-calm-800">Session Insights</h2>
                  <p className="text-sm font-medium text-calm-500 mt-0.5">A brief summary of your session</p>
                </div>
              </div>
              <button
                onClick={() => setSessionSummary(null)}
                className="text-calm-400 hover:text-calm-700 bg-white p-2.5 rounded-full shadow-sm hover:shadow-md transition-all border border-calm-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-10">
                <h3 className="text-xs font-bold text-calm-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                  Summary
                </h3>
                <p className="text-calm-700 leading-relaxed text-[15px]">{sessionSummary.summary}</p>
              </div>

              {sessionSummary.copingSteps && sessionSummary.copingSteps.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-calm-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Suggested Coping Steps
                  </h3>
                  <div className="space-y-3.5">
                    {sessionSummary.copingSteps.map((step, idx) => {
                       const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim();
                       if (!cleanStep) return null;
                       return (
                        <div key={idx} className="flex items-start gap-4 bg-white p-5 rounded-2xl border border-calm-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-therapeutic-200 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-therapeutic-200 to-therapeutic-100 text-therapeutic-800 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 shadow-sm">
                            {idx + 1}
                          </div>
                          <p className="text-calm-800 text-[15px] leading-relaxed pt-0.5">{cleanStep}</p>
                        </div>
                      )
                    })}
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
