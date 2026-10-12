import type { Action, Actor, Film, Place, Shot, TimeOfDay } from "./film-types";
import { ACTIONS, ACTORS, PLACES, TIMES, isAnimal, isQuad } from "./film-types";

const ACCENTS = ["#e7a15a", "#d45d4a", "#7eb6d6", "#c6f54e", "#d4a054", "#8d6bff", "#f0c27a", "#a8e6cf"];

function pick<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length]!;
}

export function coerceActor(value: unknown): Actor | null {
  if (typeof value !== "string") return null;
  const s = value.toLowerCase().trim();
  if ((ACTORS as string[]).includes(s)) return s as Actor;

  // Animals first — priority order
  if (/fox|vixen|kitsune/.test(s)) return "fox";
  if (/wolf|wolves|lupine/.test(s)) return "wolf";
  if (/dog|puppy|hound|pup|canine/.test(s)) return "dog";
  if (/kitten|\bcat\b|feline|tabby/.test(s)) return "cat";
  if (/rabbit|bunny|hare/.test(s)) return "rabbit";
  if (/deer|doe|stag|fawn/.test(s)) return "deer";
  if (/bear|cub\b|grizzly|polar bear/.test(s)) return "bear";
  if (/horse|pony|mare|stallion|foal/.test(s)) return "horse";
  if (/bird|crow|owl|eagle|sparrow|hawk|raven|finch|parrot|duck|swan/.test(s)) return "bird";

  // Robots / machines
  if (/robot|droid|android|mech|courier|automaton|cyborg/.test(s)) return "robot";

  // Humans
  if (/child|kid|boy|girl\b|toddler|youngster/.test(s)) return "child";
  if (/woman|lady|heroine|she\b|her\b|female/.test(s)) return "woman";
  if (/\bman\b|gentleman|\bhe\b|\bhim\b|male/.test(s)) return "man";
  if (/person|human|people|someone|figure|character/.test(s)) return "person";

  return null;
}

function coerceAction(value: unknown, text: string): Action {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if ((ACTIONS as string[]).includes(s)) return s as Action;
  if (/jump|leap|hop|vault|bound/.test(s) || /jump|leap|hop|vault|bound/.test(text)) return "jump";
  if (/danc|twirl|spin/.test(s) || /danc|twirl|spin/.test(text)) return "dance";
  if (/run|chase|sprint|gallop/.test(s) || /run|chase|sprint|gallop/.test(text)) return "run";
  if (/lie|lay|rest|sleep|nap/.test(s) || /lie|lay|rest|sleep|nap/.test(text)) return "lie";
  if (/look|gaze|watch|stare|observe|concern/.test(s) || /look|gaze|watch|stare|observe|concern/.test(text))
    return "look";
  if (/walk|stroll|wander|amble|trot/.test(s) || /walk|stroll|wander|amble|trot/.test(text)) return "walk";
  if (/stand|wait|pause/.test(s)) return "stand";
  return "walk";
}

function coercePlace(value: unknown): Place | null {
  if (typeof value !== "string") return null;
  const s = value.toLowerCase();
  if ((PLACES as string[]).includes(s)) return s as Place;
  if (/space|star|moon|orbit|planet|galaxy|nebula|cosmos/.test(s)) return "space";
  if (/rain|storm|wet|downpour/.test(s)) return "rain";
  if (/alley|lane|backstreet/.test(s)) return "alley";
  if (/roof|rooftop|skyline/.test(s)) return "rooftop";
  if (/room|inside|interior|kitchen|home|house|apartment|cabin/.test(s)) return "interior";
  if (/forest|woods|grove|thicket|jungle/.test(s)) return "forest";
  if (/beach|shore|coast|sand|ocean edge/.test(s)) return "beach";
  if (/field|meadow|park|hill|grass|garden|prairie|pasture|savanna/.test(s)) return "field";
  if (/city|street|urban|neon|downtown|metropolis/.test(s)) return "city";
  return null;
}

/**
 * Detect actors with strong bias toward animals when the idea is about
 * nature, environment, wildlife, or explicitly names animals.
 * Never invent humans when the prompt is animal-centric.
 */
function detectActors(text: string): Actor[] {
  const t = text.toLowerCase();
  const rules: [RegExp, Actor][] = [
    // Animals (checked first)
    [/fox|vixen|kitsune/, "fox"],
    [/wolf|wolves/, "wolf"],
    [/dog|puppy|hound|pup/, "dog"],
    [/kitten|\bcat\b|feline/, "cat"],
    [/rabbit|bunny|hare/, "rabbit"],
    [/deer|doe|stag|fawn/, "deer"],
    [/bear|cub\b|grizzly/, "bear"],
    [/horse|pony|mare|stallion/, "horse"],
    [/bird|crow|owl|eagle|sparrow|hawk|raven|duck|swan/, "bird"],
    // Machines
    [/robot|droid|android|mech|cyborg/, "robot"],
    // Humans (only if explicitly mentioned)
    [/child|kid|toddler/, "child"],
    [/woman|lady|heroine|\bshe\b/, "woman"],
    [/\bman\b|\bboy\b|gentleman|\bhe\b/, "man"],
    [/person|human|people|someone/, "person"],
  ];

  const found: Actor[] = [];
  for (const [re, actor] of rules) {
    if (re.test(t) && !found.includes(actor)) found.push(actor);
  }

  // Strong animal / nature bias
  const animalTheme =
    /\b(animal|animals|wildlife|creature|creatures|beast|beasts|nature|environment|forest|meadow|woods|habitat|ecosystem|endangered|concerned|planet|earth)\b/.test(
      t,
    );
  const humanMentioned =
    /\b(human|humans|person|people|man|woman|child|boy|girl|someone|somebody|hero|heroine)\b/.test(t);

  if (found.length === 0) {
    if (animalTheme && !humanMentioned) {
      // Default nature cast — fox + bird is cinematic and already well-supported
      found.push("fox", "bird");
    } else if (/robot|machine|future|sci-?fi|cyber/.test(t)) {
      found.push("robot");
    } else {
      found.push("person");
    }
  } else if (animalTheme && !humanMentioned) {
    // Strip any accidental humans that might have been matched loosely
    const animalsOnly = found.filter(isAnimal);
    if (animalsOnly.length) return animalsOnly.slice(0, 2);
  }

  return found.slice(0, 2);
}

function detectPlace(text: string, actors: Actor[], style: string): Place {
  const t = text.toLowerCase();
  if (/space|star|orbit|planet|galaxy|nebula|cosmos/.test(t)) return "space";
  if (/rain|storm|wet|downpour/.test(t)) return "rain";
  if (/alley|backstreet/.test(t)) return "alley";
  if (/roof|skyline/.test(t)) return "rooftop";
  if (/room|inside|kitchen|home|apartment|cabin/.test(t)) return "interior";
  if (/forest|woods|grove|jungle|thicket/.test(t)) return "forest";
  if (/beach|shore|coast|sand/.test(t)) return "beach";
  if (/field|meadow|park|hill|grass|garden|prairie|pasture/.test(t)) return "field";
  if (/neon|city|street|urban|downtown|metropolis/.test(t)) return /alley/.test(t) ? "alley" : "city";

  const animals = actors.some(isAnimal);
  if (animals) return /ocean|sea|water/.test(t) ? "beach" : "forest";
  if (style === "noir" || actors.includes("robot")) return "city";
  if (style === "epic") return "field";
  return "field";
}

function detectTime(text: string, place: Place, style: string): TimeOfDay {
  const t = text.toLowerCase();
  if (/midnight|night|moon|stars|dark/.test(t)) return "night";
  if (/dawn|sunrise|morning|early/.test(t)) return "dawn";
  if (/dusk|sunset|evening|twilight|golden hour/.test(t)) return "dusk";
  if (/noon|midday|\bday\b|sunlight|sunny|bright/.test(t)) return "day";
  if (place === "space" || style === "noir") return "night";
  if (style === "playful") return "day";
  if (style === "gentle") return "dusk";
  return "dusk";
}

function captionsFor(idea: string, count: number, actors: Actor[]): string[] {
  const clean = idea.replace(/\s+/g, " ").trim();
  const bits = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/[.!?]+$/, "").trim())
    .filter((s) => s.length > 2);
  const lead = bits[0] || "A quiet story";
  const animal = actors.some(isAnimal);
  const extras = animal
    ? [
        "The world feels still and listening",
        "They move with quiet purpose",
        "Light filters through the leaves",
        "A small gesture says everything",
        "The land holds its breath",
        "Concern shows in every step",
      ]
    : [
        "The light changes around them",
        "They do not look back",
        "The street holds its breath",
        "Something small is enough",
        "Time softens at the edges",
      ];
  const lines = bits.length ? bits : [lead];
  while (lines.length < count) lines.push(extras[(lines.length - 1) % extras.length]!);
  return lines.slice(0, count);
}

/** Always-available writer. Used when the model is unreachable. */
export function writeFilmLocally(idea: string, seconds: number, style: string): Film {
  const clean = idea.replace(/\s+/g, " ").trim() || "A quiet story about finding a friend.";
  const actors = detectActors(clean.toLowerCase());
  const place = detectPlace(clean, actors, style);
  const time = detectTime(clean, place, style);
  const action = coerceAction(undefined, clean.toLowerCase());
  const count = Math.max(3, Math.min(6, Math.round(seconds / 8)));
  const dur = Math.max(4, Math.round((seconds - 6) / count));
  const lines = captionsFor(clean, count, actors);

  const shots: Shot[] = lines.map((line, i) => {
    let shotAction: Action = action;
    let shotActors = actors;

    if (action === "jump") {
      shotAction = i === 0 ? "jump" : i === count - 1 ? "stand" : "walk";
      shotActors = i === 0 ? actors : actors.slice(0, 1);
    } else if (i === 0) {
      shotAction = action === "stand" || action === "look" || action === "lie" ? action : "walk";
    } else if (i === count - 1) {
      shotAction = action === "look" || action === "lie" ? action : "stand";
    } else {
      shotAction = action === "dance" ? "dance" : i % 2 ? "walk" : action;
    }

    // Vary place slightly for cinematic progression
    let shotPlace: Place = place;
    if (i === 1 && place === "city") shotPlace = "alley";
    else if (i === 1 && place === "forest") shotPlace = "field";

    const shotTime: TimeOfDay =
      i === count - 1 && time === "dusk" ? "night" : i === 0 ? time : time;

    return {
      dur,
      place: shotPlace,
      time: shotTime,
      caption: line.slice(0, 140),
      actors: i === 0 ? shotActors : shotActors.slice(0, i === 1 ? Math.min(2, shotActors.length) : 1),
      action: shotAction,
      accent: ACCENTS[i % ACCENTS.length]!,
    };
  });

  const title = clean.split(/[.!?]/)[0]!.split(" ").slice(0, 6).join(" ");
  return {
    title: title || "Untitled",
    logline: clean.slice(0, 240),
    style,
    shots,
  };
}

export function normalizeFilm(raw: unknown, idea: string, seconds: number, style: string): Film {
  const fallback = writeFilmLocally(idea, seconds, style);
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const shotsIn = Array.isArray(o.shots) ? o.shots : [];
  const shots: Shot[] = [];

  for (const item of shotsIn.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const caption = typeof s.caption === "string" ? s.caption.slice(0, 140) : "";
    if (!caption) continue;
    const blob = `${caption} ${idea}`;
    const place =
      coercePlace(s.place) ?? detectPlace(blob, detectActors(blob.toLowerCase()), style);
    const time = TIMES.includes(s.time as TimeOfDay) ? (s.time as TimeOfDay) : detectTime(blob, place, style);

    let actors = Array.isArray(s.actors)
      ? s.actors.map(coerceActor).filter((a): a is Actor => Boolean(a)).slice(0, 2)
      : [];

    // Force animal adherence when the idea is animal-centric
    const ideaLower = idea.toLowerCase();
    const animalTheme =
      /\b(animal|animals|wildlife|creature|nature|environment|forest|meadow|woods|habitat|concerned)\b/.test(
        ideaLower,
      );
    const humanNamed =
      /\b(human|humans|person|people|man|woman|child|boy|girl)\b/.test(ideaLower);
    if (animalTheme && !humanNamed) {
      actors = actors.filter(isAnimal);
      if (!actors.length) actors = detectActors(ideaLower).filter(isAnimal).slice(0, 2);
      if (!actors.length) actors = ["fox", "bird"];
    }

    if (!actors.length) actors = detectActors(blob.toLowerCase()).slice(0, 2);

    const dur = typeof s.dur === "number" ? Math.max(3, Math.min(12, s.dur)) : 6;
    shots.push({
      dur,
      place,
      time,
      caption,
      actors,
      action: coerceAction(s.action, blob.toLowerCase()),
      accent:
        typeof s.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : "#e7a15a",
    });
  }

  if (shots.length < 2) return fallback;

  const total = shots.reduce((n, s) => n + s.dur, 0);
  const body = Math.max(9, seconds - 6);
  const scale = body / total;
  for (const s of shots) s.dur = Math.max(4, Math.round(s.dur * scale));

  return {
    title:
      typeof o.title === "string" && o.title.trim()
        ? o.title.trim().slice(0, 80)
        : fallback.title,
    logline:
      typeof o.logline === "string" && o.logline.trim()
        ? o.logline.trim().slice(0, 240)
        : idea.slice(0, 240),
    style,
    shots,
  };
}
