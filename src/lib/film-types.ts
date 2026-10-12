export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Place = "city" | "rain" | "alley" | "rooftop" | "field" | "interior" | "space" | "forest" | "beach";
export type Actor =
  | "robot"
  | "person"
  | "woman"
  | "man"
  | "child"
  | "cat"
  | "dog"
  | "fox"
  | "bird"
  | "wolf"
  | "rabbit"
  | "deer"
  | "bear"
  | "horse";
export type Action = "walk" | "dance" | "stand" | "run" | "jump" | "look" | "lie";

export type Shot = {
  dur: number;
  place: Place;
  time: TimeOfDay;
  caption: string;
  actors: Actor[];
  action: Action;
  accent: string;
};

export type Film = {
  title: string;
  logline: string;
  style: string;
  shots: Shot[];
};

export const PLACES: Place[] = [
  "city",
  "rain",
  "alley",
  "rooftop",
  "field",
  "interior",
  "space",
  "forest",
  "beach",
];
export const TIMES: TimeOfDay[] = ["dawn", "day", "dusk", "night"];
export const ACTORS: Actor[] = [
  "robot",
  "person",
  "woman",
  "man",
  "child",
  "cat",
  "dog",
  "fox",
  "bird",
  "wolf",
  "rabbit",
  "deer",
  "bear",
  "horse",
];
export const ACTIONS: Action[] = ["walk", "dance", "stand", "run", "jump", "look", "lie"];

/** True for any four-legged animal we can render. */
export function isQuad(actor: Actor): boolean {
  return (
    actor === "fox" ||
    actor === "dog" ||
    actor === "cat" ||
    actor === "wolf" ||
    actor === "rabbit" ||
    actor === "deer" ||
    actor === "bear" ||
    actor === "horse"
  );
}

/** True for any animal (quad or bird). */
export function isAnimal(actor: Actor): boolean {
  return isQuad(actor) || actor === "bird";
}
