import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Allow CORS from your frontend origin (local and production)
app.use(cors({
  origin: ['http://localhost:5173', 'https://salvin-sebastian.github.io'],
  methods: ['POST']
}));
app.use(express.json());

const groq = new Groq({ apiKey: process.env.VITE_GROQ_API_KEY });

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, systemContent } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const groqMessages = [
      { role: "system", content: systemContent },
      ...messages
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: groqMessages
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: "Failed to communicate with AI service." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
