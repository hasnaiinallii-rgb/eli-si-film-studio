import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Action, Actor, Film, Place, Shot, TimeOfDay } from "./film-types";

export const FRAME = { W: 1280, H: 720 };

type Seg =
  | { kind: "title"; t0: number; t1: number }
  | { kind: "shot"; shot: Shot; index: number; t0: number; t1: number }
  | { kind: "end"; t0: number; t1: number };

type HumanRig = {
  kind: "humanoid";
  actor: Actor;
  root: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  blob: THREE.Mesh;
};

type QuadRig = {
  kind: "quad";
  actor: Actor;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  tail: THREE.Group;
  hips: THREE.Group[];
  knees: THREE.Group[];
  blob: THREE.Mesh;
};

type BirdRig = {
  kind: "bird";
  actor: "bird";
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  blob: THREE.Mesh;
};

type Rig = HumanRig | QuadRig | BirdRig;

type Grade = {
  sky: [string, string, string];
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fill: number;
  rim: number;
  exposure: number;
  env: number;
};

const IDLE: Film = {
  title: "ELI SI",
  logline: "3D studio",
  style: "cinematic",
  shots: [
    {
      dur: 10,
      place: "forest",
      time: "dusk",
      caption: "",
      actors: ["fox", "bird"],
      action: "walk",
      accent: "#e7a15a",
    },
  ],
};

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

export function timeline(film: Film) {
  const segs: Seg[] = [];
  let t = 0;
  segs.push({ kind: "title", t0: t, t1: (t += 3) });
  film.shots.forEach((shot, index) => segs.push({ kind: "shot", shot, index, t0: t, t1: (t += shot.dur) }));
  segs.push({ kind: "end", t0: t, t1: (t += 3) });
  return { segs, total: t };
}

function solid(geo: THREE.BufferGeometry, material: THREE.Material, cast = true) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = false;
  return mesh;
}

function hang(radius: number, length: number, material: THREE.Material) {
  const mesh = solid(new THREE.CapsuleGeometry(radius, Math.max(0.02, length), 5, 10), material);
  mesh.position.y = -(length / 2 + radius);
  return mesh;
}

function skinMat(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.46,
    metalness: 0,
    sheen: 0.45,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color("#ffc9b3"),
    clearcoat: 0.06,
    clearcoatRoughness: 0.55,
  });
}

function furMat(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.78,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#fff1df"),
  });
}

function clothMat(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
}

function metalMat(color: string, rough = 0.32) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.86 });
}

function blobMesh() {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addEyes(head: THREE.Object3D, iris: string, y: number, z: number, scale = 1) {
  const white = new THREE.MeshStandardMaterial({ color: "#f7f7f5", roughness: 0.18, metalness: 0 });
  const irisMat = new THREE.MeshStandardMaterial({ color: iris, roughness: 0.3, metalness: 0.05 });
  const pupil = new THREE.MeshBasicMaterial({ color: "#0c0c0c" });
  const catchMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  for (const side of [-1, 1]) {
    const eye = solid(new THREE.SphereGeometry(0.022 * scale, 14, 10), white, false);
    eye.scale.set(1, 0.92, 0.75);
    eye.position.set(side * 0.046 * scale, y, z);
    const irisMesh = solid(new THREE.SphereGeometry(0.012 * scale, 10, 8), irisMat, false);
    irisMesh.position.z = 0.012 * scale;
    const pupilMesh = solid(new THREE.SphereGeometry(0.006 * scale, 8, 6), pupil, false);
    pupilMesh.position.z = 0.008 * scale;
    const glint = solid(new THREE.SphereGeometry(0.0035 * scale, 6, 6), catchMat, false);
    glint.position.set(0.004 * scale, 0.004 * scale, 0.006 * scale);
    irisMesh.add(pupilMesh, glint);
    eye.add(irisMesh);
    head.add(eye);
  }
}

function buildHumanoid(actor: Actor, accent: string, caption: string): HumanRig {
  const robot = actor === "robot";
  const woman = actor === "woman";
  const child = actor === "child";
  const h = hash(actor + caption);
  const skinColor = pick(["#f6e2d2", "#e7b89a", "#c68642", "#8d5524", "#f3d0b8", "#d9a07a"], h);
  const hairColor = pick(["#1c140e", "#3b2918", "#6a3b22", "#d7b06a", "#2a2420", "#4a2e22"], h >> 3);
  const iris = pick(["#4a3428", "#2e5c4e", "#3a4d72", "#6a4324", "#1c1916"], h >> 5);
  const skin = robot ? metalMat("#9aa3b0", 0.28) : skinMat(skinColor);
  const hair = robot ? metalMat("#2a3038", 0.4) : new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.62, metalness: 0.04 });
  const topColor = woman ? "#f3eee6" : child ? "#e8d4b8" : actor === "man" ? "#314154" : "#2c333c";
  const bottomColor = woman ? "#343942" : "#23272e";
  const top = robot ? metalMat("#6e7886", 0.34) : clothMat(topColor);
  const bottom = robot ? metalMat("#4d5560", 0.4) : clothMat(bottomColor);
  const shoe = robot ? metalMat("#1c2128", 0.45) : clothMat("#17191d");
  const joint = metalMat("#171b21", 0.5);
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.2,
  });

  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const holder = new THREE.Group();
  if (child) holder.scale.setScalar(0.72);
  root.add(holder);
  const hips = new THREE.Group();
  hips.position.y = 0.98;
  holder.add(hips);

  const pelvis = solid(new RoundedBoxGeometry(woman ? 0.32 : 0.36, 0.2, 0.2, 3, 0.05), bottom);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const shoulderW = woman ? 0.36 : child ? 0.3 : actor === "man" ? 0.44 : 0.4;
  const chest = new THREE.Group();
  chest.position.y = 0.16;
  hips.add(chest);
  const torso = solid(new RoundedBoxGeometry(shoulderW, 0.46, robot ? 0.24 : 0.22, 4, robot ? 0.04 : 0.07), top);
  torso.position.y = 0.24;
  chest.add(torso);

  if (!robot) {
    const scarf = solid(new THREE.TorusGeometry(0.062, 0.016, 8, 18), clothMat(accent), false);
    scarf.rotation.x = Math.PI / 2.4;
    scarf.position.y = 0.5;
    chest.add(scarf);
    const belt = solid(new RoundedBoxGeometry(woman ? 0.3 : 0.34, 0.045, 0.21, 2, 0.015), clothMat("#1a1c20"), false);
    belt.position.y = 0.02;
    chest.add(belt);
  } else {
    const core = solid(new THREE.CircleGeometry(0.055, 16), glow, false);
    core.position.set(0, 0.28, 0.125);
    chest.add(core);
    const plate = solid(new RoundedBoxGeometry(0.22, 0.16, 0.04, 2, 0.01), metalMat("#c5ccd4", 0.22), false);
    plate.position.set(0, 0.3, 0.12);
    chest.add(plate);
  }

  const neck = hang(robot ? 0.05 : 0.045, 0.05, robot ? joint : skin);
  neck.position.y = 0.58;
  neck.rotation.x = Math.PI;
  chest.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.66;
  chest.add(head);
  if (robot) {
    const helm = solid(new RoundedBoxGeometry(0.26, 0.28, 0.24, 4, 0.06), metalMat("#b7c0cb", 0.22));
    head.add(helm);
    const visor = solid(new RoundedBoxGeometry(0.2, 0.07, 0.04, 2, 0.015), glow, false);
    visor.position.set(0, 0.02, 0.12);
    head.add(visor);
    const antenna = solid(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), joint, false);
    antenna.position.y = 0.22;
    const tip = solid(new THREE.SphereGeometry(0.02, 8, 8), glow, false);
    tip.position.y = 0.1;
    antenna.add(tip);
    head.add(antenna);
  } else {
    const skull = solid(new THREE.SphereGeometry(0.135, 28, 20), skin);
    skull.scale.set(1, 1.06, 0.98);
    head.add(skull);
    const cap = solid(
      new THREE.SphereGeometry(0.142, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.46),
      hair,
      false,
    );
    cap.position.y = 0.03;
    cap.rotation.x = -0.22;
    head.add(cap);
    if (woman) {
      for (const side of [-1, 1]) {
        const lock = hang(0.045, 0.28, hair);
        lock.position.set(side * 0.1, -0.02, -0.02);
        lock.rotation.z = side * -0.18;
        lock.rotation.x = 0.25;
        head.add(lock);
      }
      const back = hang(0.06, 0.34, hair);
      back.position.set(0, -0.04, -0.06);
      back.rotation.x = 0.35;
      head.add(back);
    }
    addEyes(head, iris, 0.025, 0.118, 1);
    const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const brow = solid(new THREE.CapsuleGeometry(0.008, 0.04, 3, 6), browMat, false);
      brow.rotation.z = side * -0.25 + Math.PI / 2;
      brow.position.set(side * 0.048, 0.055, 0.108);
      head.add(brow);
      const ear = solid(new THREE.SphereGeometry(0.028, 10, 8), skin, false);
      ear.scale.set(0.45, 1, 0.7);
      ear.position.set(side * 0.128, -0.01, 0);
      head.add(ear);
    }
    const nose = solid(new THREE.SphereGeometry(0.02, 10, 8), skin, false);
    nose.scale.set(0.75, 0.7, 1.15);
    nose.position.set(0, -0.012, 0.125);
    head.add(nose);
    const mouth = solid(
      new THREE.CapsuleGeometry(0.007, 0.036, 3, 6),
      new THREE.MeshStandardMaterial({ color: "#a85a58", roughness: 0.45 }),
      false,
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.055, 0.112);
    head.add(mouth);
  }

  function arm(side: number) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (shoulderW * 0.52), 0.4, 0);
    chest.add(shoulder);
    if (robot) {
      const pad = solid(new THREE.SphereGeometry(0.07, 12, 10), metalMat("#d5dbe3", 0.25), false);
      shoulder.add(pad);
    }
    const upper = hang(robot ? 0.048 : 0.05, 0.24, robot ? metalMat("#8b949f") : top);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -(0.24 + (robot ? 0.048 : 0.05) * 2);
    shoulder.add(elbow);
    if (robot) elbow.add(solid(new THREE.SphereGeometry(0.046, 10, 8), joint, false));
    const foreMat = robot ? metalMat("#9aa3ae") : top;
    const fore = hang(robot ? 0.04 : 0.042, 0.22, foreMat);
    elbow.add(fore);
    const hand = solid(new THREE.SphereGeometry(robot ? 0.042 : 0.046, 12, 10), robot ? joint : skin, false);
    hand.scale.set(0.85, 1.05, 0.7);
    hand.position.y = -(0.22 + 0.09);
    elbow.add(hand);
    return { shoulder, elbow };
  }

  function leg(side: number) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.09, -0.04, 0);
    hips.add(thigh);
    const upper = hang(woman ? 0.062 : 0.07, 0.34, bottom);
    thigh.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -(0.34 + (woman ? 0.062 : 0.07) * 2);
    thigh.add(knee);
    if (robot) knee.add(solid(new THREE.SphereGeometry(0.05, 10, 8), joint, false));
    const shin = hang(0.05, 0.32, bottom);
    knee.add(shin);
    const foot = solid(new RoundedBoxGeometry(0.1, 0.07, 0.2, 2, 0.02), shoe);
    foot.position.set(0, -(0.32 + 0.11), 0.04);
    knee.add(foot);
    return { thigh, knee };
  }

  const lA = arm(-1);
  const rA = arm(1);
  const lL = leg(-1);
  const rL = leg(1);
  plant(holder);

  const blob = blobMesh();
  return {
    kind: "humanoid",
    actor,
    root,
    hips,
    chest,
    head,
    armL: lA.shoulder,
    armR: rA.shoulder,
    foreL: lA.elbow,
    foreR: rA.elbow,
    thighL: lL.thigh,
    thighR: rL.thigh,
    shinL: lL.knee,
    shinR: rL.knee,
    blob,
  };
}

function buildQuad(actor: "fox" | "dog" | "cat" | "wolf" | "rabbit" | "deer" | "bear" | "horse", caption: string): QuadRig {
  const t = caption.toLowerCase();
  let main = "#d36a2e";
  let belly = "#f6f1ea";
  let dark = "#2a211c";
  let scale = 1.05;
  if (actor === "fox") {
    main = /white|arctic/.test(t) ? "#efe8e0" : /black/.test(t) ? "#3a342f" : /brown/.test(t) ? "#8d4e2b" : "#e07a32";
    dark = "#241810";
    scale = 1.05;
  } else if (actor === "dog") {
    main = /black/.test(t) ? "#2c2926" : /white/.test(t) ? "#f3f0ea" : /golden|yellow/.test(t) ? "#e2b45c" : /grey|gray/.test(t) ? "#8e8b86" : "#a56a3c";
    dark = "#241c16";
    belly = "#f7f1e8";
    scale = 1.2;
  } else if (actor === "wolf") {
    main = /white|arctic/.test(t) ? "#e8e4de" : /black/.test(t) ? "#2a2826" : "#7a7a7a";
    dark = "#1c1a18";
    belly = "#d8d4ce";
    scale = 1.35;
  } else if (actor === "rabbit") {
    main = /white/.test(t) ? "#f5f2ed" : /grey|gray/.test(t) ? "#b0aaa0" : "#c4a882";
    dark = "#3a3228";
    belly = "#f8f4ef";
    scale = 0.55;
  } else if (actor === "deer") {
    main = /white|spotted/.test(t) ? "#e8dcc8" : "#9a6b3c";
    dark = "#3a2a1a";
    belly = "#e8d8c0";
    scale = 1.5;
  } else if (actor === "bear") {
    main = /white|polar/.test(t) ? "#f0ece6" : /black/.test(t) ? "#2c2a28" : "#5a3a22";
    dark = "#1a120e";
    belly = "#c8a882";
    scale = 1.8;
  } else if (actor === "horse") {
    main = /white|grey|gray/.test(t) ? "#d8d4ce" : /black/.test(t) ? "#2a2826" : /brown/.test(t) ? "#6b4423" : "#8b5a2b";
    dark = "#1c1410";
    belly = "#e8dcc8";
    scale = 1.9;
  } else {
    // cat
    main = /black/.test(t) ? "#2a2a2a" : /white/.test(t) ? "#f5f5f2" : /orange|ginger/.test(t) ? "#e08a3c" : "#b7b1a8";
    dark = "#1c1c1c";
    belly = "#f7f4ef";
    scale = 0.72;
  }
  const fur = furMat(main);
  const light = furMat(belly);
  const noseMat = new THREE.MeshStandardMaterial({ color: actor === "cat" || actor === "rabbit" ? "#e7a0b0" : "#1a120e", roughness: 0.35 });
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const holder = new THREE.Group();
  holder.scale.setScalar(scale);
  root.add(holder);

  const body = new THREE.Group();
  body.position.y = (actor === "dog" || actor === "wolf" || actor === "horse" || actor === "bear") ? 0.55 : actor === "deer" ? 0.6 : 0.48;
  holder.add(body);
  const torso = solid(new THREE.SphereGeometry(0.24, 28, 18), fur);
  torso.scale.set(1.15, 0.82, 1.55);
  body.add(torso);
  const chest = solid(new THREE.SphereGeometry(0.16, 18, 12), light, false);
  chest.position.set(0, -0.06, 0.16);
  chest.scale.set(0.9, 0.7, 0.8);
  body.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.34);
  body.add(head);
  const skull = solid(new THREE.SphereGeometry(actor === "dog" || actor === "wolf" || actor === "bear" || actor === "horse" ? 0.17 : actor === "deer" ? 0.15 : 0.145, 24, 16), fur);
  head.add(skull);
  const snoutSize = actor === "cat" || actor === "rabbit" ? 0.05 : actor === "horse" ? 0.09 : 0.07;
  const snout = solid(new THREE.SphereGeometry(snoutSize, 16, 12), (actor === "dog" || actor === "wolf" || actor === "horse") ? fur : light, false);
  snout.scale.set(0.8, 0.65, actor === "fox" || actor === "wolf" ? 1.45 : actor === "dog" || actor === "horse" ? 1.3 : 1);
  snout.position.set(0, -0.02, actor === "cat" || actor === "rabbit" ? 0.12 : 0.14);
  head.add(snout);
  const nose = solid(new THREE.SphereGeometry(0.028, 10, 8), noseMat, false);
  nose.position.set(0, 0.01, actor === "cat" || actor === "rabbit" ? 0.16 : 0.2);
  head.add(nose);
  addEyes(head, actor === "cat" || actor === "rabbit" ? "#c9a227" : actor === "wolf" ? "#a0c4e8" : "#c47a2a", 0.045, 0.132, actor === "dog" || actor === "wolf" || actor === "horse" ? 0.8 : 0.72);

  if (actor === "dog" || actor === "rabbit") {
    for (const side of [-1, 1]) {
      const ear = hang(actor === "rabbit" ? 0.04 : 0.05, actor === "rabbit" ? 0.22 : 0.12, fur);
      ear.position.set(side * 0.1, actor === "rabbit" ? 0.08 : 0.02, 0);
      ear.rotation.z = side * (actor === "rabbit" ? 0.15 : 0.9);
      ear.rotation.x = actor === "rabbit" ? -0.4 : 0.3;
      head.add(ear);
    }
  } else {
    for (const side of [-1, 1]) {
      const ear = solid(new THREE.ConeGeometry(0.05, 0.16, 8), fur);
      ear.position.set(side * 0.07, 0.14, 0);
      ear.rotation.z = side * -0.25;
      head.add(ear);
      const inner = solid(new THREE.ConeGeometry(0.026, 0.1, 6), furMat("#f0c2bf"), false);
      inner.position.y = -0.02;
      inner.position.z = 0.01;
      ear.add(inner);
    }
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.06, -0.32);
  body.add(tail);
  if (actor === "fox" || actor === "wolf") {
    for (let i = 0; i < 4; i++) {
      const puff = solid(new THREE.SphereGeometry(0.09 - i * 0.012, 12, 8), i === 3 ? light : fur, false);
      puff.position.set(0, i * 0.05, -i * 0.11);
      puff.scale.set(1, 0.85, 1.1);
      tail.add(puff);
    }
  } else if (actor === "cat" || actor === "rabbit") {
    const whip = hang(0.025, actor === "rabbit" ? 0.18 : 0.42, fur);
    whip.rotation.x = -0.8;
    whip.position.set(0, 0, -0.05);
    tail.add(whip);
  } else if (actor === "horse" || actor === "deer") {
    const long = hang(0.03, 0.35, fur);
    long.rotation.x = -0.6;
    tail.add(long);
  } else {
    const dock = hang(0.04, 0.18, fur);
    dock.rotation.x = -1.1;
    tail.add(dock);
  }

  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const spots: [number, number, number][] = [
    [-0.1, -0.02, 0.16],
    [0.1, -0.02, 0.16],
    [-0.1, -0.02, -0.18],
    [0.1, -0.02, -0.18],
  ];
  for (const [x, y, z] of spots) {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    body.add(hip);
    const thigh = hang(0.045, 0.14, fur);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -(0.14 + 0.09);
    hip.add(knee);
    const shin = hang(0.035, 0.12, furMat(actor === "fox" || actor === "wolf" ? "#3a2418" : main));
    knee.add(shin);
    const paw = solid(new THREE.SphereGeometry(0.045, 10, 8), furMat(actor === "fox" || actor === "wolf" ? "#3a2418" : dark), false);
    paw.scale.set(1, 0.45, 1.25);
    paw.position.set(0, -(0.12 + 0.08), 0.02);
    knee.add(paw);
    hips.push(hip);
    knees.push(knee);
  }

  plant(holder);
  return { kind: "quad", actor, root, body, head, tail, hips, knees, blob: blobMesh() };
}

function buildBird(accent: string, caption: string): BirdRig {
  const t = caption.toLowerCase();
  const color = /black|crow/.test(t) ? "#242628" : /white/.test(t) ? "#f4f4f2" : /blue/.test(t) ? "#3d6f99" : accent || "#c4553a";
  const feather = furMat(color);
  const beakMat = new THREE.MeshStandardMaterial({ color: "#e2a23a", roughness: 0.4 });
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const holder = new THREE.Group();
  holder.scale.setScalar(1.7);
  root.add(holder);
  const body = new THREE.Group();
  body.position.y = 0.28;
  holder.add(body);
  const torso = solid(new THREE.SphereGeometry(0.16, 22, 14), feather);
  torso.scale.set(0.85, 0.72, 1.25);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.1, 0.16);
  body.add(head);
  head.add(solid(new THREE.SphereGeometry(0.085, 16, 12), feather));
  const beak = solid(new THREE.ConeGeometry(0.028, 0.11, 8), beakMat, false);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.01, 0.1);
  head.add(beak);
  addEyes(head, "#1a1a1a", 0.02, 0.07, 0.55);
  function wing(side: number) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.04, 0);
    const mesh = solid(new THREE.SphereGeometry(0.16, 14, 10), feather);
    mesh.scale.set(1.15, 0.12, 0.62);
    mesh.position.x = side * 0.16;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  }
  const wingL = wing(-1);
  const wingR = wing(1);
  for (const i of [-1, 0, 1]) {
    const featherTail = solid(new RoundedBoxGeometry(0.04, 0.015, 0.18, 1, 0.004), feather, false);
    featherTail.position.set(i * 0.035, 0.02, -0.22);
    featherTail.rotation.x = -0.4;
    body.add(featherTail);
  }
  plant(holder);
  return { kind: "bird", actor: "bird", root, body, head, wingL, wingR, blob: blobMesh() };
}

function buildActor(actor: Actor, accent: string, caption: string): Rig {
  if (isQuadActor(actor)) return buildQuad(actor as any, caption);
  if (actor === "bird") return buildBird(accent, caption);
  return buildHumanoid(actor, accent, caption);
}

function isQuadActor(actor: Actor): boolean {
  return actor === "fox" || actor === "dog" || actor === "cat" || actor === "wolf" || actor === "rabbit" || actor === "deer" || actor === "bear" || actor === "horse";
}

function plant(holder: THREE.Group) {
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  if (Number.isFinite(box.min.y)) holder.position.y -= box.min.y;
}

function resetHuman(r: HumanRig) {
  r.root.rotation.set(0, 0, 0);
  r.root.position.set(0, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  r.chest.rotation.set(0, 0, 0);
  r.head.rotation.set(0, 0, 0);
  for (const g of [r.armL, r.armR, r.foreL, r.foreR, r.thighL, r.thighR, r.shinL, r.shinR]) g.rotation.set(0, 0, 0);
  r.hips.position.y = 0.98;
}

function poseHuman(r: HumanRig, action: Action, t: number, u: number, slot: Slot, inPlace: boolean) {
  resetHuman(r);
  r.root.position.set(slot.x, 0, slot.z);
  r.root.rotation.y = slot.yaw;
  const freq = action === "run" ? 8.4 : action === "walk" ? 5.2 : action === "dance" ? 5.5 : 1.8;
  const s = Math.sin(t * freq);
  if (slot.jumper) {
    const p = Math.min(1, u / 0.68);
    const arc = Math.sin(p * Math.PI);
    r.root.position.x = lerp(slot.x0, slot.x1, p);
    r.root.position.y = arc * 1.15;
    r.root.rotation.x = -arc * 0.45;
    r.thighL.rotation.x = -0.7 * arc;
    r.thighR.rotation.x = -0.9 * arc;
    r.shinL.rotation.x = 1.15 * arc;
    r.shinR.rotation.x = 1.2 * arc;
    r.armL.rotation.z = 0.5;
    r.armR.rotation.z = -0.5;
    r.armL.rotation.x = -1.4 * arc - 0.4;
    r.armR.rotation.x = -1.2 * arc - 0.4;
    if (p >= 1) {
      r.root.position.y = 0;
      r.root.rotation.x = 0;
      r.thighL.rotation.x = 0.08;
      r.thighR.rotation.x = -0.05;
    }
    return;
  }
  if (action === "dance") {
    r.hips.position.y = 0.98 + Math.abs(Math.sin(t * 6)) * 0.08;
    r.hips.rotation.y = Math.sin(t * 3) * 0.4;
    r.hips.rotation.z = Math.sin(t * 3) * 0.1;
    r.armL.rotation.z = 2.2;
    r.armR.rotation.z = -2.2;
    r.armL.rotation.x = Math.sin(t * 6) * 0.5;
    r.armR.rotation.x = Math.sin(t * 6 + 1) * 0.5;
    r.foreL.rotation.x = 0.7;
    r.foreR.rotation.x = 0.6;
    r.thighL.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.35;
    r.thighR.rotation.x = Math.max(0, Math.sin(t * 6 + Math.PI)) * 0.35;
    r.head.rotation.y = Math.sin(t * 3) * 0.25;
    return;
  }
  if (action === "walk" || action === "run") {
    const amp = action === "run" ? 0.85 : 0.55;
    r.thighL.rotation.x = s * amp;
    r.thighR.rotation.x = -s * amp;
    r.shinL.rotation.x = Math.max(0, -s) * (action === "run" ? 1.25 : 0.95);
    r.shinR.rotation.x = Math.max(0, s) * (action === "run" ? 1.25 : 0.95);
    r.armL.rotation.x = -s * amp * 0.85;
    r.armR.rotation.x = s * amp * 0.85;
    r.foreL.rotation.x = 0.2 + Math.max(0, s) * 0.45;
    r.foreR.rotation.x = 0.2 + Math.max(0, -s) * 0.45;
    r.hips.position.y = 0.98 + Math.abs(Math.sin(t * freq * 2)) * (action === "run" ? 0.07 : 0.035);
    r.chest.rotation.y = s * 0.08;
    r.head.rotation.y = -s * 0.06;
    r.root.rotation.x = action === "run" ? 0.16 : 0.05;
    if (!inPlace) r.root.position.x = slot.x + (u - 0.5) * (action === "run" ? 3.4 : 2.2);
    return;
  }
  if (action === "look") {
    r.head.rotation.y = Math.sin(t * 0.4) * 0.45;
    r.head.rotation.x = -0.15 + Math.sin(t * 0.3) * 0.08;
    r.chest.rotation.y = Math.sin(t * 0.35) * 0.06;
    r.armL.rotation.x = 0.25;
    r.armR.rotation.x = 0.2;
    r.foreL.rotation.x = 0.35;
    r.foreR.rotation.x = 0.3;
    return;
  }
  if (action === "lie") {
    r.root.position.y = 0.35;
    r.root.rotation.x = 0.15;
    r.thighL.rotation.x = -1.1;
    r.thighR.rotation.x = -1.0;
    r.shinL.rotation.x = 0.8;
    r.shinR.rotation.x = 0.75;
    r.armL.rotation.x = -0.4;
    r.armR.rotation.x = -0.3;
    r.head.rotation.x = 0.25;
    return;
  }
  r.head.rotation.y = Math.sin(t * 0.55) * 0.28;
  r.head.rotation.x = Math.sin(t * 0.4) * 0.04;
  r.chest.rotation.x = Math.sin(t * 1.6) * 0.02;
  r.armL.rotation.x = 0.12;
  r.armR.rotation.x = 0.08;
  r.foreL.rotation.x = 0.22;
  r.foreR.rotation.x = 0.18;
}

function poseQuad(r: QuadRig, action: Action, t: number, u: number, slot: Slot, inPlace: boolean) {
  r.root.rotation.set(0, slot.yaw, 0);
  r.root.position.set(slot.x, 0, slot.z);
  r.body.rotation.set(0, 0, 0);
  r.body.position.y = (r.actor === "dog" || r.actor === "wolf" || r.actor === "horse" || r.actor === "bear") ? 0.55 : r.actor === "deer" ? 0.6 : 0.48;
  r.head.rotation.set(0, 0, 0);
  r.tail.rotation.set(actorTailBase(r.actor), 0, 0);
  r.hips.forEach((h) => h.rotation.set(0, 0, 0));
  r.knees.forEach((k) => k.rotation.set(0, 0, 0));

  if (slot.lie) {
    r.body.position.y = 0.3;
    r.head.rotation.x = 0.55;
    r.hips[0]!.rotation.x = -1.15;
    r.hips[1]!.rotation.x = -1.15;
    r.knees[0]!.rotation.x = 0.35;
    r.knees[1]!.rotation.x = 0.35;
    r.hips[2]!.rotation.x = 0.9;
    r.hips[3]!.rotation.x = 0.9;
    r.knees[2]!.rotation.x = -1.25;
    r.knees[3]!.rotation.x = -1.25;
    r.tail.rotation.y = Math.sin(t * 1.4) * 0.2;
    r.body.position.y += Math.sin(t * 1.2) * 0.008;
    return;
  }
  if (slot.jumper) {
    const p = Math.min(1, u / 0.68);
    const arc = Math.sin(p * Math.PI);
    r.root.position.x = lerp(slot.x0, slot.x1, p);
    r.root.position.y = arc * (r.actor === "cat" || r.actor === "rabbit" ? 0.95 : r.actor === "bear" || r.actor === "horse" ? 1.4 : 1.2);
    r.root.rotation.y = Math.PI / 2;
    r.root.rotation.x = -arc * 0.4;
    for (let i = 0; i < 4; i++) {
      r.hips[i]!.rotation.x = -0.55 * arc;
      r.knees[i]!.rotation.x = 1.05 * arc;
    }
    r.tail.rotation.x = -1.05;
    r.head.rotation.x = -0.25 * arc;
    if (p >= 1) {
      r.root.position.y = 0;
      r.root.rotation.x = 0;
    }
    return;
  }
  const moving = action === "walk" || action === "run" || action === "dance";
  if (moving) {
    const freq = action === "run" ? 9 : action === "dance" ? 7 : 5.4;
    const amp = action === "run" ? 0.7 : 0.5;
    const phases = [0, Math.PI, Math.PI, 0];
    for (let i = 0; i < 4; i++) {
      const s = Math.sin(t * freq + phases[i]!);
      r.hips[i]!.rotation.x = s * amp;
      r.knees[i]!.rotation.x = Math.max(0, -s) * 0.95;
    }
    r.body.position.y += Math.abs(Math.sin(t * freq * 2)) * 0.03;
    r.body.rotation.z = Math.sin(t * freq) * 0.05;
    r.tail.rotation.y = Math.sin(t * (action === "dance" ? 8 : 3.2)) * (action === "dance" ? 0.8 : 0.45);
    r.head.rotation.y = Math.sin(t * 1.5) * 0.15;
    if (!inPlace && action !== "dance") r.root.position.x = slot.x + (u - 0.5) * (action === "run" ? 3.2 : 2);
    if (action === "dance") r.root.rotation.y = slot.yaw + Math.sin(t * 3) * 0.6;
    return;
  }
  r.tail.rotation.y = Math.sin(t * 2) * 0.35;
  r.head.rotation.y = Math.sin(t * 0.6) * 0.25;
  r.body.position.y += Math.sin(t * 1.5) * 0.01;
}

function actorTailBase(actor: Actor) {
  if (actor === "cat" || actor === "rabbit") return -0.6;
  if (actor === "dog" || actor === "wolf") return -0.9;
  if (actor === "horse" || actor === "deer") return -0.5;
  return -0.45;
}

function poseBird(r: BirdRig, action: Action, t: number, u: number, slot: Slot, inPlace: boolean) {
  const fly = action !== "stand";
  r.root.rotation.set(0, slot.yaw + (fly ? Math.sin(t * 0.4) * 0.2 : 0), Math.sin(t * 8) * (fly ? 0.08 : 0));
  r.root.position.set(slot.x, fly ? 1.15 + Math.sin(t * 5) * 0.12 : 0, slot.z);
  if (fly && !inPlace) r.root.position.x = slot.x + Math.sin(t * 0.35) * 1.4;
  if (!fly) r.root.position.x = slot.x + (inPlace ? 0 : (u - 0.5) * 0.4);
  const flap = fly ? Math.sin(t * (action === "run" ? 14 : 10)) : 0.15;
  r.wingL.rotation.z = -0.35 - flap * 0.95;
  r.wingR.rotation.z = 0.35 + flap * 0.95;
  r.head.rotation.y = Math.sin(t * 1.4) * 0.4;
  r.body.rotation.x = fly ? -0.15 : 0;
}

function poseRig(rig: Rig, action: Action, t: number, u: number, slot: Slot, inPlace: boolean) {
  if (rig.kind === "humanoid") poseHuman(rig, action, t, u, slot, inPlace);
  else if (rig.kind === "quad") poseQuad(rig, action, t, u, slot, inPlace);
  else poseBird(rig, action, t, u, slot, inPlace);
  const lift = rig.root.position.y;
  rig.blob.position.x = rig.root.position.x;
  rig.blob.position.z = rig.root.position.z;
  const s = Math.max(0.28, 1 - lift * 0.28);
  rig.blob.scale.setScalar(s * (rig.kind === "quad" ? 1.15 : rig.kind === "bird" ? 0.55 : 1));
  const mat = rig.blob.material as THREE.MeshBasicMaterial;
  mat.opacity = Math.max(0.05, 0.33 - lift * 0.12);
}

type Slot = {
  x: number;
  z: number;
  yaw: number;
  jumper: boolean;
  lie: boolean;
  x0: number;
  x1: number;
};

function slotsFor(shot: Shot, inPlace: boolean): Slot[] {
  const n = shot.actors.length;
  return shot.actors.map((actor, i) => {
    const jumper = !inPlace && shot.action === "jump" && (n === 1 || i === 0);
    const lie = !jumper && i > 0 && (shot.action === "jump" || shot.action === "lie") && (isQuadActor(actor) || /lazy|sleep|lie|rest/.test(shot.caption));
    const spread = n === 1 ? 0 : i === 0 ? -0.55 : 0.7;
    return {
      x: jumper ? -1.5 : lie ? 0.15 : spread,
      z: lie ? 0.05 : i * 0.2,
      yaw: jumper ? Math.PI / 2 : lie ? 0.6 : 0.28 + i * 0.15,
      jumper,
      lie,
      x0: -1.65,
      x1: 1.45,
    };
  });
}

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare a texture.");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckled(base: string, speck: string, count: number) {
  return makeCanvasTexture((g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      g.globalAlpha = 0.12 + (i % 6) * 0.04;
      g.fillStyle = i % 2 ? speck : "#000000";
      g.fillRect((i * 73) % w, (i * 41) % h, 2 + (i % 5), 2 + (i % 4));
    }
    g.globalAlpha = 1;
  }, 256, 256);
}

function windowTex(night: boolean) {
  return makeCanvasTexture((g, w, h) => {
    g.fillStyle = "#141820";
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 18) {
      for (let x = 6; x < w; x += 14) {
        const on = (x * 3 + y * 5) % 17 > (night ? 6 : 12);
        g.fillStyle = on ? (night ? "#f0d7a4" : "#9ec8e4") : "#0c1016";
        g.fillRect(x, y, 8, 11);
      }
    }
  }, 128, 256);
}

function repeat(tex: THREE.Texture, n: number, aniso: number) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(n, n);
  tex.anisotropy = aniso;
  return tex;
}

function gradeFor(time: TimeOfDay, place: Place, style: string): Grade {
  const noir = style === "noir";
  const gentle = style === "gentle";
  const playful = style === "playful";
  if (place === "space") {
    return {
      sky: ["#02030a", "#0a1024", "#02030a"],
      fog: "#05070f",
      fogDensity: 0.016,
      sunColor: "#d5e2ff",
      sunIntensity: 3.4,
      sunPos: [7, 8, 5],
      hemiSky: "#243056",
      hemiGround: "#07080e",
      hemiIntensity: 0.7,
      fill: 1.3,
      rim: 1.8,
      exposure: 1.05,
      env: 0.28,
    };
  }
  if (place === "interior") {
    return {
      sky: ["#1a140f", "#2a2118", "#100e0c"],
      fog: "#1a140f",
      fogDensity: 0.02,
      sunColor: "#ffc48a",
      sunIntensity: 1.2,
      sunPos: [-2, 3, -2],
      hemiSky: "#ffd7b0",
      hemiGround: "#3a2a1c",
      hemiIntensity: 0.8,
      fill: 1.6,
      rim: 0.4,
      exposure: gentle ? 1.15 : 1.02,
      env: 0.45,
    };
  }
  if (time === "night" || noir) {
    return {
      sky: ["#070b16", "#182033", "#243044"],
      fog: "#121826",
      fogDensity: noir ? 0.045 : 0.03,
      sunColor: "#c5d4ff",
      sunIntensity: noir ? 1.6 : 2.4,
      sunPos: [-6, 8, -3],
      hemiSky: "#1c2744",
      hemiGround: "#0c0e14",
      hemiIntensity: 0.55,
      fill: noir ? 0.7 : 1.15,
      rim: 1.5,
      exposure: noir ? 0.9 : 1,
      env: 0.3,
    };
  }
  if (time === "dusk") {
    return {
      sky: ["#2a2158", "#c45b4a", "#f0b27a"],
      fog: "#c45b4a",
      fogDensity: 0.02,
      sunColor: "#ffb06a",
      sunIntensity: 4.2,
      sunPos: [-9, 5, 4],
      hemiSky: "#ffb089",
      hemiGround: "#3a2a22",
      hemiIntensity: 0.85,
      fill: 1.35,
      rim: 1.3,
      exposure: 1.05,
      env: 0.4,
    };
  }
  if (time === "dawn") {
    return {
      sky: ["#35507a", "#e39a78", "#ffe1c2"],
      fog: "#e7c2a4",
      fogDensity: 0.018,
      sunColor: "#ffd0a4",
      sunIntensity: 4,
      sunPos: [10, 5, 3],
      hemiSky: "#ffd2b0",
      hemiGround: "#6a5344",
      hemiIntensity: 0.9,
      fill: 1.4,
      rim: 0.9,
      exposure: 1.08,
      env: 0.42,
    };
  }
  return {
    sky: ["#6ea6de", "#b7d8f2", "#e7f2ea"],
    fog: "#c5d7cc",
    fogDensity: 0.012,
    sunColor: "#fff4e0",
    sunIntensity: playful ? 5 : 4.4,
    sunPos: [6, 12, 5],
    hemiSky: "#c5e4ff",
    hemiGround: "#6d8a62",
    hemiIntensity: 0.95,
    fill: 1.5,
    rim: 0.7,
    exposure: gentle ? 1.12 : 1.04,
    env: 0.45,
  };
}

function buildWorld(shot: Shot, aniso: number) {
  const group = new THREE.Group();
  const night = shot.time === "night" || shot.place === "space";
  const wet = shot.place === "rain" || shot.place === "alley";
  let groundColor = "#3f6d3c";
  let groundSpec = "#1d3a22";
  if (shot.place === "space") {
    groundColor = "#2a2c33";
    groundSpec = "#121318";
  } else if (shot.place === "interior") {
    groundColor = "#8a6244";
    groundSpec = "#5c3e2a";
  } else if (shot.place === "city" || shot.place === "rain" || shot.place === "alley" || shot.place === "rooftop") {
    groundColor = wet ? "#1c2128" : "#3a3e46";
    groundSpec = "#12141a";
  } else if (shot.place === "beach") {
    groundColor = night ? "#3a3428" : "#d4c4a0";
    groundSpec = "#8a7a58";
  } else if (shot.place === "forest") {
    groundColor = night ? "#121c14" : "#2a3c28";
    groundSpec = "#0e1810";
  } else if (night) {
    groundColor = "#1a2a20";
    groundSpec = "#0c140f";
  } else if (shot.time === "dusk") {
    groundColor = "#3a5a34";
    groundSpec = "#1c3018";
  }
  const gtex = repeat(speckled(groundColor, groundSpec, 220), shot.place === "interior" ? 3 : 8, aniso);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(28, 48),
    new THREE.MeshStandardMaterial({
      map: gtex,
      color: "#ffffff",
      roughness: wet ? 0.22 : shot.place === "interior" ? 0.62 : 0.92,
      metalness: wet ? 0.35 : 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.castShadow = false;
  group.add(ground);

  const tickers: ((t: number) => void)[] = [];

  if (shot.place === "field" || shot.place === "forest" || shot.place === "beach") {
    const hillMat = new THREE.MeshStandardMaterial({ color: shot.time === "night" ? "#142018" : "#2d4a30", roughness: 1 });
    for (const [x, z, s] of [
      [-10, -16, 7],
      [8, -18, 8],
      [0, -22, 10],
      [-16, -12, 5],
    ] as const) {
      const hill = solid(new THREE.SphereGeometry(s, 20, 12), hillMat, false);
      hill.position.set(x, -s * 0.45, z);
      group.add(hill);
    }
    const leaf = new THREE.MeshStandardMaterial({ color: shot.time === "night" ? "#1d3a28" : "#2f6a3a", roughness: 0.9 });
    const leaf2 = new THREE.MeshStandardMaterial({ color: "#3e7d48", roughness: 0.85 });
    const bark = new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 0.9 });
    const spots = [
      [-3.2, -3.4],
      [3.4, -4],
      [-5.5, -6],
      [5.2, -6.5],
      [1.8, -8],
      [-2.2, -9],
      [6.5, -2.5],
    ];
    for (const [x, z] of spots) {
      const tree = new THREE.Group();
      const trunk = solid(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 7), bark);
      trunk.position.y = 0.65;
      trunk.castShadow = true;
      const crown = solid(new THREE.IcosahedronGeometry(0.85, 1), x! > 0 ? leaf : leaf2);
      crown.position.y = 1.7;
      crown.castShadow = true;
      const crown2 = solid(new THREE.IcosahedronGeometry(0.55, 1), leaf2);
      crown2.position.set(0.2, 2.25, 0.1);
      tree.add(trunk, crown, crown2);
      tree.position.set(x!, 0, z!);
      group.add(tree);
    }
    const tuftGeo = new THREE.ConeGeometry(0.04, 0.28, 4);
    const tuftMat = new THREE.MeshStandardMaterial({ color: "#4e8a46", roughness: 1 });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 160);
    tufts.receiveShadow = true;
    tufts.castShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 160; i++) {
      dummy.position.set(((i * 1.7) % 10) - 5, 0.12, ((i * 0.9) % 6) - 2.2);
      dummy.scale.set(1, 0.6 + (i % 5) * 0.15, 1);
      dummy.rotation.y = i;
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
    }
    group.add(tufts);
    if (shot.time === "day" || shot.time === "dawn" || shot.time === "dusk") {
      const cloudMat = new THREE.MeshStandardMaterial({ color: "#fff7f0", roughness: 1, transparent: true, opacity: 0.9 });
      for (const [x, y, z, s] of [
        [-6, 7, -12, 1.4],
        [5, 8, -14, 1.8],
        [0, 9, -20, 2.2],
      ] as const) {
        const cloud = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const p = solid(new THREE.SphereGeometry(0.7, 10, 8), cloudMat, false);
          p.position.set(i * 0.55, (i % 2) * 0.18, 0);
          cloud.add(p);
        }
        cloud.position.set(x, y, z);
        cloud.scale.setScalar(s);
        group.add(cloud);
      }
    }
  }

  if (shot.place === "city" || shot.place === "rain" || shot.place === "alley" || shot.place === "rooftop") {
    const wins = windowTex(night || shot.time === "dusk");
    wins.wrapS = wins.wrapT = THREE.RepeatWrapping;
    wins.repeat.set(1, 2);
    const wall = new THREE.MeshStandardMaterial({
      color: "#8d93a0",
      roughness: 0.82,
      metalness: 0.08,
      emissive: night ? "#ffbf80" : "#8ec4ea",
      emissiveMap: wins,
      emissiveIntensity: night ? 0.7 : 0.18,
    });
    const alley = shot.place === "alley";
    const count = alley ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const w = alley ? 1.6 : 1.5 + (i % 3) * 0.4;
      const h = 2.2 + ((i * 37) % 70) / 10;
      const d = 1.4;
      const b = solid(new THREE.BoxGeometry(w, h, d), wall, false);
      b.receiveShadow = true;
      const x = alley ? (i % 2 === 0 ? -2.3 : 2.3) : (i - count / 2) * 2.1;
      const z = alley ? -1.5 - Math.floor(i / 2) * 2.2 : -6 - (i % 3) * 1.4;
      b.position.set(x, h / 2, z);
      group.add(b);
    }
    if (shot.place === "rooftop") {
      const parapet = new THREE.MeshStandardMaterial({ color: "#2c3138", roughness: 0.8 });
      for (const [x, z, w, d] of [
        [0, -3.2, 8, 0.25],
        [-3.8, 0, 0.25, 6],
        [3.8, 0, 0.25, 6],
      ] as const) {
        const p = solid(new THREE.BoxGeometry(w, 0.55, d), parapet, false);
        p.position.set(x, 0.28, z);
        group.add(p);
      }
    }
    const sign = makeCanvasTexture((g, w, h) => {
      g.fillStyle = "#140810";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = shot.accent;
      g.lineWidth = 10;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = shot.accent;
      g.font = "700 72px ui-sans-serif, system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(shot.place === "alley" ? "NIGHT" : "OPEN", w / 2, h / 2);
    }, 512, 160);
    const signMat = new THREE.MeshStandardMaterial({
      map: sign,
      emissive: shot.accent,
      emissiveMap: sign,
      emissiveIntensity: 1.3,
      roughness: 0.4,
    });
    const board = solid(new THREE.PlaneGeometry(2.1, 0.66), signMat, false);
    board.position.set(alley ? -2.2 : -3.2, 2.4, alley ? -1.2 : -4.5);
    if (!alley) board.rotation.y = 0.4;
    group.add(board);

    for (const x of alley ? [-1.6, 1.6] : [-2.4, 2.6]) {
      const pole = new THREE.Group();
      const post = solid(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), metalMat("#22262c", 0.5), false);
      post.position.y = 1.2;
      const bulb = solid(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({
        color: "#fff4d2",
        emissive: "#ffd27a",
        emissiveIntensity: 2,
      }), false);
      bulb.position.y = 2.45;
      pole.add(post, bulb);
      pole.position.set(x, 0, 1.2);
      group.add(pole);
      const lamp = new THREE.PointLight("#ffd2a0", night ? 6 : 2, 7, 2);
      lamp.position.set(x, 2.4, 1.2);
      group.add(lamp);
    }
  }

  if (shot.place === "interior") {
    const wallMat = new THREE.MeshStandardMaterial({ color: "#4a3b32", roughness: 0.86 });
    const back = solid(new THREE.BoxGeometry(8, 3.2, 0.15), wallMat, false);
    back.position.set(0, 1.6, -3.6);
    back.receiveShadow = true;
    const left = solid(new THREE.BoxGeometry(0.15, 3.2, 7), wallMat, false);
    left.position.set(-3.6, 1.6, 0);
    const right = solid(new THREE.BoxGeometry(0.15, 3.2, 7), wallMat, false);
    right.position.set(3.6, 1.6, 0);
    const ceil = solid(new THREE.BoxGeometry(8, 0.12, 7), new THREE.MeshStandardMaterial({ color: "#2a241e", roughness: 0.9 }), false);
    ceil.position.set(0, 3.15, 0);
    group.add(back, left, right, ceil);
    const glass = solid(
      new THREE.PlaneGeometry(1.4, 1.5),
      new THREE.MeshStandardMaterial({ color: "#cfe6ff", emissive: "#9ec8ff", emissiveIntensity: 0.8, roughness: 0.15 }),
      false,
    );
    glass.position.set(1.4, 1.8, -3.5);
    group.add(glass);
    const wood = new THREE.MeshStandardMaterial({ color: "#7a5136", roughness: 0.7 });
    const top = solid(new RoundedBoxGeometry(1.3, 0.08, 0.7, 2, 0.02), wood);
    top.position.set(-0.9, 0.72, -0.4);
    group.add(top);
    for (const [x, z] of [
      [-1.4, -0.65],
      [-0.4, -0.65],
      [-1.4, -0.15],
      [-0.4, -0.15],
    ] as const) {
      const leg = solid(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), wood, false);
      leg.position.set(x, 0.35, z);
      group.add(leg);
    }
    const shade = solid(
      new THREE.ConeGeometry(0.22, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: "#f0e2c8", emissive: "#ffc98a", emissiveIntensity: 0.4 }),
      false,
    );
    shade.position.set(1.5, 1.7, 0.6);
    group.add(shade);
    const warm = new THREE.PointLight("#ffb36a", 8, 6, 2);
    warm.position.set(1.5, 1.7, 0.6);
    group.add(warm);
  }

  if (shot.place === "space" || night) {
    const positions: number[] = [];
    for (let i = 0; i < (shot.place === "space" ? 500 : 180); i++) {
      const r = 18 + (i % 20);
      const a = i * 2.399;
      const y = 2 + (i % 17) * 0.8;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r - 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#ffffff",
        size: shot.place === "space" ? 0.12 : 0.07,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(stars);
    const moonMap = makeCanvasTexture((g, w, h) => {
      g.fillStyle = "#ddd4c4";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 50; i++) {
        g.fillStyle = i % 2 ? "#c9bfae" : "#f4efe6";
        g.beginPath();
        g.arc((i * 47) % w, (i * 83) % h, 4 + (i % 14), 0, Math.PI * 2);
        g.fill();
      }
    }, 256, 256);
    const moon = solid(
      new THREE.SphereGeometry(shot.place === "space" ? 2.1 : 1.15, 32, 24),
      new THREE.MeshStandardMaterial({ map: moonMap, roughness: 1, emissive: "#2a261c", emissiveIntensity: 0.25 }),
      false,
    );
    moon.position.set(shot.place === "space" ? 4.2 : 7.5, shot.place === "space" ? 2.6 : 6.5, shot.place === "space" ? -8 : -16);
    group.add(moon);
    if (shot.place === "space") {
      const rock = new THREE.MeshStandardMaterial({ color: "#3a3d46", roughness: 0.95 });
      for (let i = 0; i < 8; i++) {
        const stone = solid(new THREE.IcosahedronGeometry(0.18 + (i % 4) * 0.08, 0), rock);
        stone.position.set(((i * 1.3) % 5) - 2.2, 0.1, ((i * 0.7) % 3) - 1.4);
        stone.rotation.set(i, i * 0.4, 0);
        group.add(stone);
      }
    }
  }

  if (wet) {
    const dropGeo = new THREE.BoxGeometry(0.012, 0.26, 0.012);
    const dropMat = new THREE.MeshBasicMaterial({ color: "#e4eeff", transparent: true, opacity: 0.45 });
    const rain = new THREE.InstancedMesh(dropGeo, dropMat, 260);
    rain.frustumCulled = false;
    const base: THREE.Vector3[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 260; i++) {
      base.push(new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 7, (Math.random() - 0.5) * 10));
      dummy.position.copy(base[i]!);
      dummy.updateMatrix();
      rain.setMatrixAt(i, dummy.matrix);
    }
    group.add(rain);
    tickers.push((t) => {
      for (let i = 0; i < base.length; i++) {
        const p = base[i]!;
        p.y -= 0.22;
        p.x -= 0.03;
        if (p.y < 0) p.y = 7;
        dummy.position.copy(p);
        dummy.rotation.z = -0.15;
        dummy.updateMatrix();
        rain.setMatrixAt(i, dummy.matrix);
      }
      rain.instanceMatrix.needsUpdate = true;
      void t;
    });
  }

  group.userData.tick = (t: number) => {
    for (const fn of tickers) fn(t);
  };
  return group;
}

function disposeTree(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const texs = new Set<THREE.Texture>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geos.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      mats.add(m);
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) texs.add(value);
      }
    }
  });
  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
  for (const m of mats) m.dispose();
}

function paintCard(tex: THREE.CanvasTexture, film: Film, title: boolean) {
  const canvas = tex.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#c6f54e";
  ctx.font = "600 28px ui-sans-serif, system-ui";
  ctx.fillText((title ? film.style : "fin").toUpperCase(), w / 2, h * 0.36);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 72px Georgia, serif";
  const headline = title ? film.title : "End";
  const words = headline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w * 0.8 && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, w / 2, h * 0.48 + i * 78));
  ctx.font = "400 26px Georgia, serif";
  ctx.fillStyle = "#b7b3aa";
  if (title && film.logline) {
    const sub = film.logline.length > 92 ? `${film.logline.slice(0, 90)}…` : film.logline;
    ctx.fillText(sub, w / 2, h * 0.72);
  }
  tex.needsUpdate = true;
}

function paintCaption(tex: THREE.CanvasTexture, text: string) {
  const canvas = tex.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!text) {
    tex.needsUpdate = true;
    return;
  }
  ctx.font = "600 42px Georgia, serif";
  const width = Math.min(canvas.width - 40, ctx.measureText(text).width + 64);
  const x = (canvas.width - width) / 2;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, x, 28, width, 72, 16);
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, 64);
  tex.needsUpdate = true;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function skyTexture(colors: [string, string, string]) {
  return makeCanvasTexture((g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.55, colors[1]);
    grd.addColorStop(1, colors[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, 16, 256);
}

const stages = new WeakMap<HTMLCanvasElement, Stage>();

export function attachStage(canvas: HTMLCanvasElement) {
  const existing = stages.get(canvas);
  if (existing) return existing;
  const stage = new Stage(canvas);
  stages.set(canvas, stage);
  return stage;
}

class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, FRAME.W / FRAME.H, 0.08, 180);
  readonly overlay = new THREE.Scene();
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  readonly sun = new THREE.DirectionalLight("#ffffff", 4);
  readonly hemi = new THREE.HemisphereLight("#cfe4ff", "#6a5a48", 0.8);
  readonly fill = new THREE.DirectionalLight("#fff0e0", 1.2);
  readonly rim = new THREE.DirectionalLight("#9eb6ff", 1.2);
  world: THREE.Group | null = null;
  rigs: Rig[] = [];
  sky: THREE.Texture | null = null;
  key = "";
  captionText = "";
  cardMode: "title" | "end" | "off" = "off";
  raf = 0;
  mode: "idle" | "film" | "hold" = "hold";
  readonly cardMap: THREE.CanvasTexture;
  readonly card: THREE.Mesh;
  readonly captionMap: THREE.CanvasTexture;
  readonly caption: THREE.Mesh;
  envTex: THREE.Texture | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(FRAME.W, FRAME.H, false);
    this.renderer.setClearColor("#07080c", 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.4;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.camera.left = -10;
    this.sun.shadow.camera.right = 10;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.04;
    this.sun.position.set(6, 10, 5);
    this.fill.position.set(1, 2.2, 6);
    this.rim.position.set(-4, 3, -4);
    this.scene.add(this.sun, this.sun.target, this.hemi, this.fill, this.rim);
    this.sun.target.position.set(0, 1, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    this.cardMap = makeCanvasTexture((g, w, h) => {
      g.fillStyle = "#07080c";
      g.fillRect(0, 0, w, h);
    }, 1280, 720);
    this.card = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.cardMap, toneMapped: false }),
    );
    this.card.visible = false;
    this.captionMap = makeCanvasTexture(() => undefined, 1280, 160);
    const capMat = new THREE.MeshBasicMaterial({ map: this.captionMap, transparent: true, toneMapped: false, depthTest: false });
    this.caption = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.22), capMat);
    this.caption.position.set(0, -0.78, 0);
    const vigMap = makeCanvasTexture((g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }, 512, 512);
    const vig = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: vigMap, transparent: true, depthTest: false, toneMapped: false }),
    );
    vig.position.z = -0.2;
    this.overlay.add(this.card, vig, this.caption);
    this.renderAt(IDLE, 0.2, true);
  }

  startIdle() {
    if (this.mode === "film") return;
    this.mode = "idle";
    this.stopLoop();
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      if (this.mode !== "idle") return;
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      this.renderAt(IDLE, acc, true);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  renderAt(film: Film, time: number, idle: boolean) {
    if (idle) {
      const shot = film.shots[0]!;
      this.ensureShot(shot, film.style, "idle");
      this.hideCard();
      const local = time % shot.dur;
      this.poseShot(shot, local, true);
      this.frameCamera(shot, film.style, local / shot.dur, 0, true, time);
      this.setCaption("");
      this.draw();
      return;
    }
    const { segs, total } = timeline(film);
    const t = clamp(time, 0, Math.max(0, total - 0.001));
    const seg = segs.find((s) => t >= s.t0 && t < s.t1) ?? segs[segs.length - 1]!;
    if (seg.kind === "title" || seg.kind === "end") {
      if (this.world) this.world.visible = false;
      for (const rig of this.rigs) {
        rig.root.visible = false;
        rig.blob.visible = false;
      }
      this.cardMode = seg.kind;
      paintCard(this.cardMap, film, seg.kind === "title");
      this.card.visible = true;
      this.setCaption("");
      this.scene.background = new THREE.Color("#07080c");
      this.draw();
      return;
    }
    const shot = seg.shot;
    this.ensureShot(shot, film.style, `${film.title}:${seg.index}:${shot.place}:${shot.caption}`);
    this.hideCard();
    const local = t - seg.t0;
    this.poseShot(shot, local, false);
    this.frameCamera(shot, film.style, local / shot.dur, seg.index, false, local);
    this.setCaption(shot.caption);
    this.draw();
  }

  private hideCard() {
    this.card.visible = false;
    this.cardMode = "off";
    if (this.world) this.world.visible = true;
    for (const rig of this.rigs) {
      rig.root.visible = true;
      rig.blob.visible = true;
    }
  }

  private ensureShot(shot: Shot, style: string, key: string) {
    if (this.key === key) return;
    this.clearCast();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const world = buildWorld(shot, aniso);
    this.scene.add(world);
    this.world = world;
    const grade = gradeFor(shot.time, shot.place, style);
    this.sky?.dispose();
    this.sky = skyTexture(grade.sky);
    this.scene.background = this.sky;
    this.scene.fog = new THREE.FogExp2(grade.fog, grade.fogDensity);
    this.scene.environmentIntensity = grade.env;
    this.sun.color.set(grade.sunColor);
    this.sun.intensity = grade.sunIntensity;
    this.sun.position.set(...grade.sunPos);
    this.hemi.color.set(grade.hemiSky);
    this.hemi.groundColor.set(grade.hemiGround);
    this.hemi.intensity = grade.hemiIntensity;
    this.fill.intensity = grade.fill;
    this.fill.color.set(shot.time === "night" || shot.place === "space" ? "#c5d4ff" : "#fff1e4");
    this.rim.intensity = grade.rim;
    this.rim.color.set(shot.place === "space" ? "#c9b6ff" : "#9ebfff");
    this.renderer.toneMappingExposure = grade.exposure;
    for (const actor of shot.actors) {
      const rig = buildActor(actor, shot.accent, shot.caption);
      this.scene.add(rig.root, rig.blob);
      this.rigs.push(rig);
    }
    this.key = key;
  }

  private poseShot(shot: Shot, local: number, inPlace: boolean) {
    const u = clamp(local / shot.dur, 0, 1);
    const slots = slotsFor(shot, inPlace);
    this.rigs.forEach((rig, i) => {
      const slot = slots[i];
      if (!slot) return;
      poseRig(rig, shot.action, local, u, slot, inPlace);
    });
    const tick = this.world?.userData.tick as ((t: number) => void) | undefined;
    tick?.(local);
  }

  private frameCamera(shot: Shot, style: string, u: number, index: number, idle: boolean, time: number) {
    const e = u * u * (3 - 2 * u);
    if (idle) {
      const a = time * 0.22;
      this.camera.position.set(Math.sin(a) * 3.4, 1.48, 4.6 + Math.cos(a) * 0.8);
      this.camera.lookAt(0.1, 1.02, 0);
      this.camera.fov = 34;
      this.camera.updateProjectionMatrix();
      return;
    }
    if (shot.action === "jump") {
      this.camera.position.set(0.35 + e * 0.4, 1.02, 6.3 - e * 0.35);
      this.camera.lookAt(0.05, 0.85, 0);
      this.camera.fov = 32;
    } else if (shot.place === "space") {
      this.camera.position.set(Math.sin(u) * 1.2, 1.55, 6.1);
      this.camera.lookAt(0, 1.05, 0);
      this.camera.fov = 36;
    } else if (shot.place === "interior") {
      this.camera.position.set(-0.3, 1.4, 3.5);
      this.camera.lookAt(0.1, 1.1, -0.6);
      this.camera.fov = 38;
    } else if (style === "epic" || shot.place === "rooftop") {
      this.camera.position.set(-1.8 + e, 0.85, 5.3);
      this.camera.lookAt(0.2, 1.3, 0);
      this.camera.fov = 32;
    } else if (style === "noir" || shot.place === "alley") {
      this.camera.position.set(1.7 - e * 0.3, 1.4, 4.3);
      this.camera.lookAt(-0.2, 1.15, 0);
      this.camera.fov = 34;
    } else {
      const side = index % 2 === 0 ? 1 : -1;
      this.camera.position.set(side * (2.15 - e * 0.45), 1.42, 5.5 - e * 0.7);
      this.camera.lookAt(0, 1.12, 0);
      this.camera.fov = 34;
    }
    this.camera.updateProjectionMatrix();
  }

  private setCaption(text: string) {
    if (text === this.captionText) return;
    this.captionText = text;
    paintCaption(this.captionMap, text);
    this.caption.visible = Boolean(text);
  }

  private draw() {
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.overlay, this.ortho);
    this.renderer.autoClear = true;
  }

  private clearCast() {
    if (this.world) {
      this.scene.remove(this.world);
      disposeTree(this.world);
      this.world = null;
    }
    for (const rig of this.rigs) {
      this.scene.remove(rig.root);
      this.scene.remove(rig.blob);
      disposeTree(rig.root);
      disposeTree(rig.blob);
    }
    this.rigs = [];
    this.key = "";
  }

  async record(film: Film, onProgress: (p: number) => void) {
    this.mode = "film";
    this.stopLoop();
    const { total } = timeline(film);
    this.renderAt(film, 0, false);
    const stream = this.canvas.captureStream(30);
    const audio = new AudioContext();
    await audio.resume();
    const dest = audio.createMediaStreamDestination();
    const master = audio.createGain();
    master.gain.value = 0.9;
    master.connect(dest);
    master.connect(audio.destination);
    score(audio, master, film, total);
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve, reject) => {
      rec.onerror = () => reject(new Error("Recording failed."));
      rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    rec.start(200);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const elapsed = (performance.now() - t0) / 1000;
        this.renderAt(film, Math.min(elapsed, total - 0.001), false);
        onProgress(clamp(elapsed / total, 0, 1));
        if (elapsed < total) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    stream.getTracks().forEach((track) => track.stop());
    const blob = await done;
    setTimeout(() => void audio.close(), 400);
    this.mode = "hold";
    return blob;
  }

  dispose() {
    this.mode = "hold";
    this.stopLoop();
    this.clearCast();
    this.sky?.dispose();
    this.envTex?.dispose();
    this.cardMap.dispose();
    this.captionMap.dispose();
    this.renderer.dispose();
    stages.delete(this.canvas);
  }
}

function tone(ctx: AudioContext, dest: AudioNode, freq: number, when: number, dur: number, type: OscillatorType, gain: number) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.05);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function score(ctx: AudioContext, dest: AudioNode, film: Film, total: number) {
  const root = 98 + (hash(film.title) % 7) * 6;
  const steps = [0, 3, 5, 7, 10];
  for (let t = 0; t < total; t += 0.5) {
    const n = steps[Math.floor(t * 2) % steps.length]!;
    const freq = root * 2 ** (n / 12) * (t % 4 < 2 ? 1 : 2);
    tone(ctx, dest, freq, ctx.currentTime + t, 0.48, "triangle", 0.045);
    if (Math.floor(t) % 2 === 0) tone(ctx, dest, root / 2, ctx.currentTime + t, 0.95, "sine", 0.04);
  }
}

export async function recordFilm(film: Film, canvas: HTMLCanvasElement, onProgress: (p: number) => void) {
  const stage = stages.get(canvas) ?? attachStage(canvas);
  return stage.record(film, onProgress);
}
