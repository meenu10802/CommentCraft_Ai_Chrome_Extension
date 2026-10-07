import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// OpenRouter settings (all come from backend/.env)
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// The button the user clicks sends a tone id. The backend turns it into an instruction.
const TONES = {
  happy: "cheerful, warm and positive",
  sad: "empathetic and compassionate, acknowledging the sad or difficult side of the post",
  agree: "in agreement with the post, adding one supporting point or example",
  disagree: "politely disagreeing, giving one respectful counter-point",
  argue: "a firm, well-reasoned counter-argument that is assertive but never insulting or personal",
  explain: "an explanation that clarifies the topic simply and adds helpful context",
};

app.get("/", (req, res) => res.send("CommentCraft AI backend is running"));

app.post("/generate", async (req, res) => {
  try {
    const { post, tone } = req.body;

    if (!API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is missing in backend/.env" });
    }
    if (!post) {
      return res.status(400).json({ error: "Missing 'post' in request body" });
    }

    const toneInstruction = TONES[tone];
    if (!toneInstruction) {
      return res.status(400).json({ error: `Unknown tone '${tone}'` });
    }

    const systemPrompt =
      "You write comments to post on social media pages and discussion threads. " +
      "Write 1 to 3 natural sentences that sound like a real person. " +
      "No hashtags, do not repeat the post, and output only the comment text with no quotes or preamble.";

    const userPrompt =
      `Tone: ${toneInstruction}.\n\nPost context:\n${String(post).slice(0, 3000)}`;

    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "X-Title": "CommentCraft AI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
      }),
    });

    const data = await r.json();
    console.log(`[${tone}] OpenRouter status:`, r.status);

    // Errors (for example rate limit or high demand) are returned as-is.
    // The extension inserts this message into the comment box.
    if (!r.ok || data.error) {
      console.log("OpenRouter error:", JSON.stringify(data, null, 2));
      return res
        .status(r.ok ? 502 : r.status)
        .json({ error: data.error?.message || "OpenRouter request failed" });
    }

    const comment = data.choices?.[0]?.message?.content?.trim();

    if (!comment) {
      console.log("Empty response:", JSON.stringify(data, null, 2));
      return res.status(502).json({ error: "No comment returned by the model" });
    }

    res.json({ comment });
  } catch (e) {
    console.log("Server error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on ${PORT} using model ${MODEL}`));