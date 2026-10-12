import { createServerFn } from "@tanstack/react-start";
import { normalizeFilm, writeFilmLocally } from "./write-film";

export const studioStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { script: Boolean(process.env.XAI_API_KEY) };
});

export const writeScript = createServerFn({ method: "POST" })
  .validator((input: { idea: string; seconds: number; style: string }) => {
    const idea = String(input?.idea ?? "").trim().slice(0, 600);
    const seconds = [15, 30, 45, 60].includes(Number(input?.seconds)) ? Number(input.seconds) : 30;
    const style = String(input?.style ?? "cinematic").slice(0, 40);
    if (idea.length < 8) throw new Error("Describe the film in a sentence or two.");
    return { idea, seconds, style };
  })
  .handler(async ({ data }) => {
    const local = () => ({
      film: writeFilmLocally(data.idea, data.seconds, data.style),
      source: "local" as const,
    });
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return local();

    const prompt = `You are an elite silent-film director writing a precise shot list for a 3D stylized renderer.

IDEA: ${data.idea}
STYLE: ${data.style}
TARGET LENGTH: ~${data.seconds} seconds

CRITICAL CASTING RULES (must follow):
- Cast ONLY the beings the idea actually names or clearly implies.
- If the idea is about animals, wildlife, nature, environment, forests, meadows, or "concerned animals" — use ONLY animal actors (fox, dog, cat, bird, wolf, rabbit, deer, bear, horse). NEVER invent humans.
- Humans appear ONLY when the idea explicitly mentions a person, man, woman, child, or human.
- Robots appear only when the idea mentions robots, machines, or futuristic characters.
- Prefer 1–2 actors per shot. Keep the same core cast across the film.

SCHEMA (JSON only, no markdown):
{
  "title": string,
  "logline": string,
  "shots": [
    {
      "dur": number (4–10),
      "place": "city"|"rain"|"alley"|"rooftop"|"field"|"interior"|"space"|"forest"|"beach",
      "time": "dawn"|"day"|"dusk"|"night",
      "caption": short on-screen poetic line (not camera direction),
      "actors": array of "robot"|"person"|"woman"|"man"|"child"|"fox"|"dog"|"cat"|"bird"|"wolf"|"rabbit"|"deer"|"bear"|"horse",
      "action": "walk"|"dance"|"stand"|"run"|"jump"|"look"|"lie",
      "accent": "#rrggbb"
    }
  ]
}

Use 3–6 shots. For nature/environment themes prefer forest or field + dusk/night lighting and "look" or "stand" actions that convey quiet concern. Captions should feel like subtitles of feeling. No markdown, no explanation — pure JSON.`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.55,
          max_tokens: 1100,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return local();
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) return local();
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      return {
        film: normalizeFilm(parsed, data.idea, data.seconds, data.style),
        source: "grok" as const,
      };
    } catch {
      return local();
    }
  });
