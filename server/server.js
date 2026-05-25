import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { v4 as uuidv4 } from "uuid";
import { connectDB } from "./db.js";
import Session from "./models/Session.js";

// ✅ LOAD ENV VARIABLES FIRST
dotenv.config();
console.log("MONGO_URI:", process.env.MONGO_URI);

const app = express();

/* ✅ CORS */
app.use(
  cors({
    origin: ["https://rose-ai-therapist.netlify.app", "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors()); // preflight fix

/* ✅ BODY PARSER */
app.use(express.json());

/* -------------------- HEALTH -------------------- */
app.get("/", (req, res) => {
  res.send("✅ AI Therapist Server is running");
});

/* -------------------- CRISIS DETECTION -------------------- */
const CRISIS_KEYWORDS = [
  "kill myself",
  "end my life",
  "suicide",
  "self harm",
  "hurt myself",
  "hurt someone",
  "kill someone",
  "want to die",
  "can't go on",
  "no reason to live",
  "feel hopeless"
];

function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(k => text.toLowerCase().includes(k));
}

/* -------------------- CHAT -------------------- */
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId, userId, isAnonymous } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    if (detectCrisis(message)) {
      return res.json({
        reply:
          "I’m really sorry you’re feeling this way. You’re not alone. Help is available right now.",
        crisis: true
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Anonymous chat (no DB)
    if (isAnonymous) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a kind, empathetic AI therapist." },
          { role: "user", content: message }
        ]
      });
      return res.json({ reply: completion.choices[0].message.content });
    }

    const finalSessionId = sessionId || uuidv4();

    let session = await Session.findOne({ sessionId: finalSessionId, userId });
    if (!session) {
      session = await Session.create({
        sessionId: finalSessionId,
        userId,
        title: message.slice(0, 30),
        messages: [],
        saved: false
      });
    }

    session.messages.push({ role: "user", content: message });
    await session.save();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a kind, empathetic AI therapist." },
        ...session.messages.map(m => ({ role: m.role, content: m.content }))
      ]
    });

    const reply = completion.choices[0].message.content;
    session.messages.push({ role: "assistant", content: reply });
    await session.save();

    res.json({ reply, sessionId: finalSessionId });
  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

/* -------------------- SAVE SESSION -------------------- */
app.post("/sessions/save", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    if (!sessionId || !userId)
      return res.status(400).json({ error: "Missing data" });

    const session = await Session.findOneAndUpdate(
      { sessionId, userId },
      { saved: true },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: "Session not found" });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ SAVE ERROR:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

/* -------------------- GET SAVED SESSIONS -------------------- */
app.get("/sessions", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);

    const sessions = await Session.find({ userId, saved: true })
      .select("sessionId title createdAt")
      .sort({ updatedAt: -1 });

    res.json(sessions);
  } catch (err) {
    console.error("❌ FETCH SESSIONS ERROR:", err);
    res.status(500).json([]);
  }
});

/* -------------------- LOAD SESSION MESSAGES -------------------- */
app.get("/sessions/:id", async (req, res) => {
  try {
    const { userId } = req.query;
    const session = await Session.findOne({ sessionId: req.params.id, userId });

    if (!session) return res.json({ messages: [] });
    res.json({ messages: session.messages, title: session.title });
  } catch (err) {
    console.error("❌ LOAD SESSION ERROR:", err);
    res.status(500).json({ messages: [] });
  }
});

/* -------------------- SUMMARIZE SESSION -------------------- */
app.post("/summarize-session", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    const session = await Session.findOne({ sessionId, userId });

    if (!session || session.messages.length < 2)
      return res.json({ summary: null });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a therapist. Summarize briefly and suggest 3 coping steps."
        },
        {
          role: "user",
          content: session.messages.map(m => `${m.role}: ${m.content}`).join("\n")
        }
      ]
    });

    const text = completion.choices[0].message.content;
    const [summary, steps] = text.split("Coping Steps:");

    session.summary = summary.trim();
    session.copingSteps = steps ? steps.split("\n").filter(s => s.trim()) : [];

    await session.save();

    res.json({ summary: session.summary, copingSteps: session.copingSteps });
  } catch (err) {
    console.error("❌ SUMMARY ERROR:", err);
    res.status(500).json({ error: "Summary failed" });
  }
});

/* -------------------- DELETE SESSION -------------------- */
app.delete("/sessions/:id", async (req, res) => {
  try {
    const { userId } = req.query;
    await Session.deleteOne({ sessionId: req.params.id, userId });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to DB", err);
    process.exit(1);
  });
