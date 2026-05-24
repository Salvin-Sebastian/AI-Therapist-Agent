import { useState, useEffect, useRef } from "react";

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
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/sessions?userId=${userId}`
      );
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
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/sessions/${sessionId}?userId=${userId}`
        );
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
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

      if (data.crisis) {
        setCrisisAlert(true);
      }

      if (!isAnonymous && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
        setSessionId(data.sessionId);
      }

      setMessages(prev => [
        ...prev.filter(m => m !== undefined), // clean up if necessary
        { role: "assistant", content: data.reply }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SAVE SESSION ---------------- */
  const saveSession = async () => {
    if (!sessionId) return;

    await fetch(`${import.meta.env.VITE_API_URL}/sessions/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId })
    });

    fetchSessions();
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
      await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${id}?userId=${userId}`,
        { method: "DELETE" }
      );
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
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/summarize-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId })
        }
      );
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
        <aside className="w-80 bg-white border-r border-calm-200 p-6 flex flex-col shadow-[4px_0_24px_rgb(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-therapeutic-100 rounded-xl flex items-center justify-center text-xl">🪴</div>
            <div>
              <h2 className="font-display font-semibold text-calm-800 text-lg">AI Therapist</h2>
              <p className="text-xs text-calm-400">Safe & Private Space</p>
            </div>
          </div>

          <button
            onClick={newChat}
            className="mb-6 bg-calm-800 text-white py-3 px-4 rounded-xl font-medium hover:bg-calm-900 transition-all shadow-md shadow-calm-800/20 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Session
          </button>

          {sessionId && messages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={saveSession}
                className="bg-therapeutic-50 text-therapeutic-700 py-2.5 rounded-lg text-sm font-medium hover:bg-therapeutic-100 transition-colors flex items-center justify-center gap-1.5 border border-therapeutic-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                Save
              </button>

              <button
                onClick={summarizeSession}
                className="bg-calm-100 text-calm-700 py-2.5 rounded-lg text-sm font-medium hover:bg-calm-200 transition-colors flex items-center justify-center gap-1.5 border border-calm-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Insights
              </button>
            </div>
          )}

          <div className="text-xs font-semibold text-calm-400 mb-3 uppercase tracking-wider">Past Sessions</div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => setSessionId(s.sessionId)}
                className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-all ${
                  s.sessionId === sessionId
                    ? "bg-therapeutic-50 border-therapeutic-200 border text-therapeutic-800 shadow-sm"
                    : "hover:bg-calm-50 border border-transparent text-calm-600"
                }`}
              >
                <span className="truncate text-sm font-medium flex-1">{s.title || "Untitled Session"}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.sessionId);
                  }}
                  className="text-calm-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete Session"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-sm text-calm-400 text-center py-4 italic">No saved sessions</div>
            )}
          </div>
        </aside>
      )}

      {/* -------- CHAT AREA -------- */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header (Mobile / Anonymous) */}
        {isAnonymous && (
          <header className="bg-white/80 backdrop-blur border-b border-calm-200 p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪴</span>
              <h2 className="font-display font-semibold text-calm-800">Anonymous Session</h2>
            </div>
            <span className="text-xs text-calm-500 bg-calm-100 px-3 py-1 rounded-full">Not Saved</span>
          </header>
        )}

        {/* Crisis Alert Banner */}
        {crisisAlert && (
          <div className="bg-red-50 border-b border-red-200 p-4 animate-slide-down flex items-start gap-3 z-20">
            <div className="text-red-500 mt-0.5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold">Help is available</h3>
              <p className="text-red-700 text-sm mt-1">If you are in crisis, please reach out for immediate support:</p>
              <ul className="mt-2 text-sm text-red-800 font-medium space-y-1">
                <li>• Suicide & Crisis Lifeline: Call or text <a href="tel:988" className="underline hover:text-red-900">988</a></li>
                <li>• Crisis Text Line: Text HOME to 741741</li>
                <li>• Emergency Services: Call 911</li>
              </ul>
            </div>
            <button onClick={() => setCrisisAlert(false)} className="text-red-400 hover:text-red-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 opacity-50">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-display font-semibold text-calm-700">How are you feeling today?</h3>
              <p className="text-calm-500">Share whatever is on your mind. This is a safe, private space to explore your thoughts and emotions.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              if (m.role === "user" && i === messages.length - 1 && loading) {
                // Do not render optimistic user message twice if we already have it in state
                // But since we just pushed it, it is fine
              }
              return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`flex gap-3 max-w-[75%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm shadow-sm ${
                    m.role === "user" ? "bg-calm-800 text-white" : "bg-therapeutic-200 text-therapeutic-800"
                  }`}>
                    {m.role === "user" ? "U" : "🪴"}
                  </div>

                  {/* Bubble */}
                  <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-calm-800 text-white rounded-tr-none"
                      : "bg-white border border-calm-100 text-calm-800 rounded-tl-none shadow-[0_2px_12px_rgb(0,0,0,0.03)]"
                  }`}>
                    {m.content}
                  </div>
                </div>
              </div>
            )})
          )}
          
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3 max-w-[75%] flex-row">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm shadow-sm bg-therapeutic-200 text-therapeutic-800">
                  🪴
                </div>
                <div className="px-5 py-4 rounded-2xl bg-white border border-calm-100 rounded-tl-none shadow-[0_2px_12px_rgb(0,0,0,0.03)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-calm-300 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-calm-300 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-calm-300 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/80 backdrop-blur border-t border-calm-200 z-10">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-white rounded-3xl border border-calm-200 shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-therapeutic-500/20 focus-within:border-therapeutic-300 transition-all">
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
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 outline-none resize-none py-3 px-4 text-calm-800 placeholder:text-calm-400 custom-scrollbar"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-therapeutic-600 hover:bg-therapeutic-700 disabled:bg-calm-200 disabled:text-calm-400 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors shadow-sm mb-1 mr-1"
            >
              <svg className="w-4 h-4 translate-x-px translate-y-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </div>
          <div className="text-center mt-2">
             <span className="text-[10px] text-calm-400 uppercase tracking-widest">AI Therapy is not a substitute for professional medical advice</span>
          </div>
        </div>
      </main>

      {/* -------- SUMMARY MODAL -------- */}
      {sessionSummary && (
        <div className="fixed inset-0 bg-calm-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up border border-white/20">
            
            <div className="p-6 border-b border-calm-100 flex justify-between items-center bg-therapeutic-50 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="bg-therapeutic-200 text-therapeutic-800 p-2 rounded-xl text-xl shadow-sm">🧠</div>
                <h2 className="text-2xl font-display font-semibold text-calm-800">Session Insights</h2>
              </div>
              <button
                onClick={() => setSessionSummary(null)}
                className="text-calm-400 hover:text-calm-600 bg-white p-2 rounded-full shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-calm-400 uppercase tracking-wider mb-3">Summary</h3>
                <p className="text-calm-700 leading-relaxed text-lg">{sessionSummary.summary}</p>
              </div>

              {sessionSummary.copingSteps && sessionSummary.copingSteps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-calm-400 uppercase tracking-wider mb-4">Suggested Coping Steps</h3>
                  <div className="space-y-3">
                    {sessionSummary.copingSteps.map((step, idx) => {
                       const cleanStep = step.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim();
                       if (!cleanStep) return null;
                       return (
                        <div key={idx} className="flex items-start gap-3 bg-calm-50 p-4 rounded-2xl border border-calm-100">
                          <div className="w-6 h-6 rounded-full bg-therapeutic-100 text-therapeutic-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="text-calm-800">{cleanStep}</p>
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
