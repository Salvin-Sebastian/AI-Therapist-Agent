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

      if (!isAnonymous && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
        setSessionId(data.sessionId);
      }

      setMessages(prev => [
        ...prev,
        { role: "user", content: userText },
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
    <div className="flex h-screen bg-gray-100">

      {/* -------- SIDEBAR -------- */}
      {!isAnonymous && (
        <aside className="w-72 bg-white border-r p-4 flex flex-col">
          <button
            onClick={newChat}
            className="mb-3 bg-indigo-600 text-white py-2 rounded"
          >
            + New Chat
          </button>

          {sessionId && (
            <>
              <button
                onClick={saveSession}
                className="mb-2 bg-blue-600 text-white py-2 rounded"
              >
                💾 Save Session
              </button>

              <button
                onClick={summarizeSession}
                className="mb-4 bg-green-600 text-white py-2 rounded"
              >
                🧠 Summarize
              </button>
            </>
          )}

          <div className="flex-1 overflow-y-auto">
            {sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => setSessionId(s.sessionId)}
                className={`p-3 rounded mb-1 cursor-pointer flex justify-between items-center ${
                  s.sessionId === sessionId
                    ? "bg-indigo-100"
                    : "hover:bg-gray-100"
                }`}
              >
                <span className="truncate">{s.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.sessionId);
                  }}
                  className="text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* -------- CHAT -------- */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`mb-2 ${
                m.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block px-4 py-2 rounded-xl max-w-md ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 flex gap-2 border-t">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type your thoughts…"
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </main>

      {/* -------- SUMMARY MODAL -------- */}
      {sessionSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 relative">
            <button
              onClick={() => setSessionSummary(null)}
              className="absolute top-3 right-3 text-xl"
            >
              ✕
            </button>
            <h2 className="text-xl font-semibold mb-3">🧠 Session Summary</h2>
            <p className="text-sm mb-4">{sessionSummary.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
