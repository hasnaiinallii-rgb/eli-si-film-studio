import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { studioStatus, writeScript } from "@/lib/film.functions";
import type { Film } from "@/lib/film-types";
import { FRAME, attachStage, recordFilm, timeline } from "@/lib/stage";

export const Route = createFileRoute("/")({ component: Home });

const LENGTHS = [15, 30, 45, 60];
const STYLES = ["cinematic", "noir", "gentle", "playful", "epic"];

const EXAMPLES = [
  "Animals gather in a quiet forest at dusk, looking concerned about the environment. A fox and a bird move together through the trees.",
  "A brown fox jumps over a lazy dog at dusk in a golden field.",
  "A robot courier walks alone through neon rain on a quiet street.",
  "A deer and a rabbit stand in a misty forest at dawn, watching the light change.",
  "A child and a dog run across a beach at sunset, then rest together.",
  "Two wolves howl under a full moon in a snowy field.",
  "A lone astronaut stands on a rocky planet, looking up at distant stars.",
];

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [idea, setIdea] = useState(
    "Animals gather in a quiet forest at dusk, looking concerned about the environment. A fox and a bird move together through the trees.",
  );
  const [seconds, setSeconds] = useState(30);
  const [style, setStyle] = useState("cinematic");
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState<"idle" | "writing" | "rendering">("idle");
  const [error, setError] = useState("");
  const [film, setFilm] = useState<Film | null>(null);
  const [source, setSource] = useState<"grok" | "local" | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    void studioStatus().then((s) => setScriptReady(s.script)).catch(() => setScriptReady(false));
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stage: ReturnType<typeof attachStage> | null = null;
    try {
      stage = attachStage(canvas);
      stage.startIdle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The 3D stage could not start.");
    }
    return () => stage?.dispose();
  }, []);

  async function make() {
    setError("");
    setBusy("writing");
    setProgress(0);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    try {
      const result = await writeScript({ data: { idea, seconds, style } });
      setFilm(result.film);
      setSource(result.source);
      setBusy("rendering");
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("The stage is not ready.");
      const blob = await recordFilm(result.film, canvas, setProgress);
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the film.");
    } finally {
      setBusy("idle");
    }
  }

  const total = film ? timeline(film).total : 0;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h1 className="font-sans text-lg font-semibold tracking-tight">ELI SI · Advanced 3D Film Studio</h1>
          <p className="text-xs text-muted">Prompt-faithful cast · cinematic lighting · animals, people, robots · recorded in browser</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-lime px-3 py-1 font-semibold text-black">
            {scriptReady ? "Grok script on" : "Local script writer"}
          </span>
          <span className="rounded-full border border-line px-3 py-1 text-lime">HD 3D</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="space-y-4">
          <label className="block text-sm text-muted">
            What is the film about?
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={5}
              className="mt-2 w-full resize-y rounded-xl border border-line bg-surface px-3 py-3 font-serif text-[15px] leading-relaxed text-fg outline-none focus:border-lime"
              placeholder="Describe the story. Name the animals or people you want to see…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.slice(0, 5).map((ex) => (
              <button
                key={ex.slice(0, 24)}
                type="button"
                onClick={() => setIdea(ex)}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-lime hover:text-fg"
              >
                {ex.split(/[.!?]/)[0]!.slice(0, 36)}…
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-muted">
              Length
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-fg"
              >
                {LENGTHS.map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-muted">
              Style
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-fg"
              >
                {STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={busy !== "idle"}
            onClick={() => void make()}
            className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy === "writing" ? "Writing the film…" : busy === "rendering" ? "Rendering 3D…" : "Make the film"}
          </button>
          <p className="text-sm leading-relaxed text-muted">
            Foxes, wolves, dogs, cats, birds, deer, rabbits, bears, horses, robots, and people are built as fully lit 3D characters. The cast now follows your prompt: if you write about animals, animals appear — not humans.
            Lights, shadows, and a moving camera are rendered here, then recorded with music.
            {scriptReady ? " Grok writes the shot list when you press the button." : " A built-in writer still builds the shots."}
          </p>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {film ? (
            <ol className="space-y-2 text-sm text-fg/80">
              <li className="font-medium text-fg">
                {film.title}
                <span className="ml-2 text-xs font-normal text-muted">
                  {source === "grok" ? "Grok" : "Local writer"} · {total}s
                </span>
              </li>
              {film.shots.map((shot, i) => (
                <li key={i} className="rounded-lg border border-line px-3 py-2">
                  <span className="text-lime">
                    {shot.place} · {shot.time} · {shot.action} · {shot.actors.join(" & ")} · {shot.dur}s
                  </span>
                  <div className="font-serif">{shot.caption}</div>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-black">
            <canvas ref={canvasRef} width={FRAME.W} height={FRAME.H} className="aspect-video w-full" />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-lime transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          {videoUrl ? (
            <div className="space-y-3">
              <video src={videoUrl} controls className="aspect-video w-full rounded-2xl border border-line" />
              <a
                href={videoUrl}
                download={`${(film?.title || "film").replace(/\s+/g, "-").toLowerCase()}.webm`}
                className="inline-flex rounded-full border border-lime px-4 py-2 text-sm font-semibold text-lime"
              >
                Download video
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {busy === "rendering"
                ? "Filming the 3D scene now. Stay on this page until the bar fills."
                : "The stage is live. Your recorded video will appear here."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
