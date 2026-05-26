import Groq from 'groq-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const groq = new Groq({ apiKey: process.env.VITE_GROQ_API_KEY });
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

    res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: "Failed to communicate with AI service." });
  }
}
