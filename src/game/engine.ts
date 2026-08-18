import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CATALOG, AISLES, byId, type ProductDef } from "./catalog";

export type RemotePlayer = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  color: string;
  cart?: string[];
};

export type GameCallbacks = {
  onPrompt: (text: string | null) => void;
  onPickup: (id: string) => void;
  onCheckout: () => void;
  onLockChange: (locked: boolean) => void;
  onMove?: (x: number, z: number, yaw: number) => void;
  onSteal?: (victimId: string, productId: string) => void;
  onCartModeChange?: (attached: boolean, carrying: string | null) => void;
};


// ---------------------------------------------------------------- textures
function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

let MAX_ANISO = 8;

function toTex(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}


function labelTexture(p: ProductDef) {
  const [c, g] = makeCanvas(512, 512);
  g.scale(2, 2);

  g.fillStyle = p.color;
  g.fillRect(0, 0, 256, 256);
  // soft vertical sheen
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.20)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // brand band
  g.fillStyle = p.accent;
  g.fillRect(0, 24, 256, 46);
  g.fillStyle = p.color;
  g.font = "700 22px Helvetica, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(p.brand.toUpperCase(), 128, 48);
  // product name
  g.fillStyle = "rgba(255,255,255,0.94)";
  g.font = "700 27px Helvetica, Arial, sans-serif";
  const words = p.name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 13) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  lines.push(cur.trim());
  lines.forEach((l, i) => g.fillText(l, 128, 132 + i * 30 - (lines.length - 1) * 15));
  // footer bar + faux barcode
  g.fillStyle = p.accent;
  g.fillRect(0, 196, 256, 60);
  g.fillStyle = "rgba(0,0,0,0.75)";
  for (let x = 24; x < 232; x += 6) g.fillRect(x, 210, 1 + Math.random() * 3, 32);
  return toTex(c);
}

// ---------------------------------------------------------------- product meshes
const geoCache = new Map<string, THREE.BufferGeometry>();
function shapeGeo(shape: ProductDef["shape"]) {
  const cached = geoCache.get(shape);
  if (cached) return cached;
  let geo: THREE.BufferGeometry;
  switch (shape) {
    case "carton":
      geo = new THREE.BoxGeometry(0.15, 0.34, 0.15);
      break;
    case "box":
      geo = new THREE.BoxGeometry(0.22, 0.3, 0.1);
      break;
    case "bottle":
      geo = new THREE.CylinderGeometry(0.065, 0.08, 0.32, 18);
      break;
    case "can":
      geo = new THREE.CylinderGeometry(0.07, 0.07, 0.23, 20);
      break;
    case "jar":
      geo = new THREE.CylinderGeometry(0.085, 0.085, 0.2, 20);
      break;
    case "tub":
      geo = new THREE.CylinderGeometry(0.1, 0.085, 0.16, 20);
      break;
    case "tray":
      geo = new THREE.BoxGeometry(0.26, 0.09, 0.19);
      break;
    case "produce":
      geo = new THREE.IcosahedronGeometry(0.11, 1);
      break;
    default:
      geo = new THREE.BoxGeometry(0.24, 0.28, 0.13);
  }
  geoCache.set(shape, geo);
  return geo;
}

function productMaterial(p: ProductDef, tex: THREE.Texture) {
  const metal = p.shape === "can" || p.shape === "jar";
  return new THREE.MeshStandardMaterial({
    map: tex,
    color: p.shape === "produce" ? new THREE.Color(p.color) : 0xffffff,
    roughness: metal ? 0.28 : p.shape === "bottle" ? 0.32 : 0.72,
    metalness: metal ? 0.5 : 0.04,
    envMapIntensity: 1.0,
  });
}

// ---------------------------------------------------------------- audio
let sharedAudio: AudioContext | null = null;
function audio() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedAudio ??= new Ctor();
  if (sharedAudio.state === "suspended") void sharedAudio.resume();
  return sharedAudio;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 1) {
  try {
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

function thunk(open: boolean) {
  tone(open ? 240 : 150, 0.22, "sine", 0.16, open ? 1.35 : 0.7);
}

// ---------------------------------------------------------------- game
export function createGame(canvas: HTMLCanvasElement, cb: GameCallbacks) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
  });
  MAX_ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  let renderScale = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(renderScale);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;


  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c8d2dc");
  scene.fog = new THREE.Fog("#cfd8e0", 40, 120);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.environmentIntensity = 1.05;


  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 220);
  const player = { pos: new THREE.Vector3(0, 1.68, 18), yaw: 0, pitch: -0.08, vel: new THREE.Vector3() };

  // ---------- dimensions ----------
  const W = 58;
  const D = 46;
  const H = 6.2;
  const RUN_X = [-15, -8.5, -2, 4.5, 11]; // gondola run centers
  const RUN_Z0 = -17;
  const RUN_Z1 = 5;
  const RUN_LEN = RUN_Z1 - RUN_Z0;
  const RUN_HALF_D = 0.62; // half width of a run (each side faces outward)

  // ---------- floor ----------
  const floorTex = (() => {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = "#e9e7e2";
    g.fillRect(0, 0, 512, 512);
    // terrazzo speckle
    for (let i = 0; i < 26000; i++) {
      const v = 195 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v - 3},${v - 10},${Math.random() * 0.4})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (let i = 0; i < 700; i++) {
      const r = 2 + Math.random() * 5;
      g.fillStyle = `rgba(${120 + Math.random() * 90},${118 + Math.random() * 90},${115 + Math.random() * 90},0.32)`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
      g.fill();
    }
    // visible grid: 2x2 tiles per texture repeat, deep grout + highlight bevel
    const grout = (x: number, y: number, w: number, h: number) => {
      g.fillStyle = "rgba(96,101,108,0.85)";
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.fillRect(x + w, y, Math.max(1, w * 0.4), h);
      g.fillRect(x, y + h, w, Math.max(1, h * 0.4));
    };
    for (const p of [0, 256]) {
      grout(p, 0, 5, 512);
      grout(0, p, 512, 5);
    }
    grout(507, 0, 5, 512);
    grout(0, 507, 512, 5);
    return toTex(c, [W / 3, D / 3]);
  })();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.14, metalness: 0.04, envMapIntensity: 1.5 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // polished-concrete walkway strips between runs
  const walkMat = new THREE.MeshStandardMaterial({
    color: "#dfe3e6",
    roughness: 0.08,
    metalness: 0.08,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < RUN_X.length - 1; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, RUN_LEN + 4), walkMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((RUN_X[i]! + RUN_X[i + 1]!) / 2, 0.006, (RUN_Z0 + RUN_Z1) / 2);
    scene.add(strip);
  }


  // ---------- ceiling + structure ----------
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: "#2a2f36", roughness: 0.95 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  const steel = new THREE.MeshPhysicalMaterial({ color: "#9aa3ac", roughness: 0.28, metalness: 0.9, envMapIntensity: 2.0, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  for (let x = -W / 2 + 6; x <= W / 2 - 6; x += 8) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, D), steel);
    truss.position.set(x, H - 0.4, 0);
    scene.add(truss);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: "#eef1f4", roughness: 0.85 });
  const mkWall = (w: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
  };
  mkWall(W, 0, -D / 2, 0);
  mkWall(W, 0, D / 2, Math.PI);
  mkWall(D, -W / 2, 0, Math.PI / 2);
  mkWall(D, W / 2, 0, -Math.PI / 2);

  // back-wall accent band (department color, Target/Safeway style)
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(W, 1.6),
    new THREE.MeshStandardMaterial({ color: "#c8202c", roughness: 0.6 }),
  );
  band.position.set(0, H - 1.4, -D / 2 + 0.03);
  scene.add(band);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight("#f4f8ff", "#8d949c", 0.85));
  const key = new THREE.DirectionalLight("#fff6ea", 0.75);
  key.position.set(14, 20, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -32;
  key.shadow.camera.right = 32;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  key.shadow.bias = -0.0008;
  scene.add(key);

  const stripMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: new THREE.Color("#fff8ec"),
    emissiveIntensity: 1.5,
    roughness: 1,
  });
  const stripGeo = new THREE.BoxGeometry(0.5, 0.1, RUN_LEN + 6);
  RUN_X.forEach((x, i) => {
    for (const off of [-4, 4]) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(x + off, H - 0.75, (RUN_Z0 + RUN_Z1) / 2);
      scene.add(strip);
    }
    if (i === 2) {
      const pl = new THREE.PointLight("#fff4e2", 16, 34, 2);
      pl.position.set(x, H - 1.6, (RUN_Z0 + RUN_Z1) / 2);
      scene.add(pl);
    }
  });
  for (const z of [13]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 8, 0.1, 0.5), stripMat);
    strip.position.set(0, H - 0.75, z);
    scene.add(strip);
    const pl = new THREE.PointLight("#fff4e2", 12, 32, 2);
    pl.position.set(0, H - 1.6, z);
    scene.add(pl);
  }

  // ---------- colliders ----------
  const colliders: THREE.Box3[] = [];
  const addCollider = (cx: number, cz: number, sx: number, sz: number) =>
    colliders.push(
      new THREE.Box3(new THREE.Vector3(cx - sx / 2, 0, cz - sz / 2), new THREE.Vector3(cx + sx / 2, 3, cz + sz / 2)),
    );

  // ---------- shared shelf materials ----------
  const shelfSteel = new THREE.MeshPhysicalMaterial({ color: "#c3c9cf", roughness: 0.2, metalness: 0.95, envMapIntensity: 2.2, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  const shelfDeck = new THREE.MeshPhysicalMaterial({ color: "#d6dade", roughness: 0.16, metalness: 0.9, envMapIntensity: 2.4, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const pegboard = (() => {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = "#aeb6bd";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "rgba(60,66,72,0.55)";
    for (let y = 8; y < 128; y += 16)
      for (let x = 8; x < 128; x += 16) {
        g.beginPath();
        g.arc(x, y, 2.4, 0, Math.PI * 2);
        g.fill();
      }
    const t = toTex(c, [10, 3]);
    return new THREE.MeshStandardMaterial({ map: t, color: "#f0f3f5", roughness: 0.5, metalness: 0.6 });
  })();

  const signTex = (text: string, sub: string, color: string) => {
    const [c, g] = makeCanvas(768, 256);
    g.fillStyle = color;
    g.fillRect(0, 0, 768, 256);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(0, 0, 768, 90);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 108px Helvetica, Arial, sans-serif";
    g.fillText(text, 384, 96);
    g.font = "600 46px Helvetica, Arial, sans-serif";
    g.fillText(sub.toUpperCase(), 384, 190);
    return toTex(c);
  };

  // ---------- products + gondola runs ----------
  const products: THREE.Mesh[] = [];
  const texCache = new Map<string, THREE.Texture>();
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  CATALOG.forEach((p) => {
    const t = labelTexture(p);
    texCache.set(p.id, t);
    matCache.set(p.id, productMaterial(p, t));
  });
  const meshFor = (p: ProductDef) => new THREE.Mesh(shapeGeo(p.shape), matCache.get(p.id)!);

  const SHELF_Y = [0.5, 1.0, 1.5, 1.98];

  RUN_X.forEach((cx, runIndex) => {
    const group = new THREE.Group();
    group.position.set(cx, 0, (RUN_Z0 + RUN_Z1) / 2);
    scene.add(group);
    addCollider(cx, (RUN_Z0 + RUN_Z1) / 2, RUN_HALF_D * 2 + 0.5, RUN_LEN + 0.2);

    // pegboard spine (both faces)
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, RUN_LEN), pegboard);
    spine.position.y = 1.14;
    spine.castShadow = spine.receiveShadow = true;
    group.add(spine);

    // kickplate base
    const base = new THREE.Mesh(new THREE.BoxGeometry(RUN_HALF_D * 2, 0.16, RUN_LEN), shelfSteel);
    base.position.y = 0.08;
    base.receiveShadow = true;
    group.add(base);

    // vertical uprights every 2.2m
    for (let z = -RUN_LEN / 2; z <= RUN_LEN / 2 + 0.01; z += 2.2) {
      for (const s of [-1, 1]) {
        const up = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.3, 0.09), shelfSteel);
        up.position.set(s * RUN_HALF_D * 0.85, 1.15, z);
        up.castShadow = true;
        group.add(up);
      }
    }

    // shelf decks + front price rails, per side
    for (const s of [-1, 1]) {
      SHELF_Y.forEach((y) => {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(RUN_HALF_D - 0.06, 0.035, RUN_LEN), shelfDeck);
        deck.position.set((s * (RUN_HALF_D + 0.07)) / 2, y, 0);
        deck.receiveShadow = true;
        deck.castShadow = true;
        group.add(deck);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, RUN_LEN), shelfSteel);
        rail.position.set(s * (RUN_HALF_D - 0.02), y + 0.05, 0);
        group.add(rail);
      });
    }

    // aisle marker sign hanging over the run
    const aisleA = AISLES[runIndex * 2] ?? "Grocery";
    const aisleB = AISLES[runIndex * 2 + 1] ?? "Grocery";
    const signColors = ["#12406b", "#8c1d2c", "#0f5c46", "#5a2d82", "#a35a08"];
    const sc = signColors[runIndex % signColors.length]!;
    const signGeo = new THREE.PlaneGeometry(3.6, 1.2);
    for (const s of [-1, 1]) {
      const face = s < 0 ? aisleA : aisleB;
      const sign = new THREE.Mesh(
        signGeo,
        new THREE.MeshStandardMaterial({
          map: signTex(String(runIndex * 2 + (s < 0 ? 1 : 2)), face, sc),
          roughness: 0.55,
          emissive: new THREE.Color(sc),
          emissiveIntensity: 0.18,
        }),
      );
      sign.position.set(s * 0.09, 3.35, RUN_LEN / 2 - 1.2);
      sign.rotation.y = s < 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(sign);
      const sign2 = sign.clone();
      sign2.position.z = -RUN_LEN / 2 + 1.2;
      group.add(sign2);
    }
    for (const z of [RUN_LEN / 2 - 1.2, -RUN_LEN / 2 + 1.2]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), shelfSteel);
      rod.position.set(0, 4.3, z);
      group.add(rod);
    }

    // ---- stock both faces ----
    for (const s of [-1, 1]) {
      const aisle = s < 0 ? aisleA : aisleB;
      const items = CATALOG.filter((p) => p.aisle === aisle);
      if (!items.length) continue;
      const STEP = 0.9;
      const perItem = Math.max(2, Math.floor(RUN_LEN / STEP / items.length));
      SHELF_Y.forEach((y, level) => {
        let n = 0;
        for (let z = -RUN_LEN / 2 + 0.45; z <= RUN_LEN / 2 - 0.45; z += STEP) {
          const p = items[Math.floor((n / perItem + level) % items.length)]!;
          const m = meshFor(p);
          const yOff =
            p.shape === "tray" ? 0.07 : p.shape === "produce" ? 0.13 : p.shape === "tub" ? 0.1 : p.shape === "jar" ? 0.12 : 0.17;
          m.position.set(cx + s * (RUN_HALF_D - 0.18), y + yOff, (RUN_Z0 + RUN_Z1) / 2 + z + (Math.random() - 0.5) * 0.04);
          m.rotation.y = s < 0 ? -Math.PI / 2 : Math.PI / 2;
          m.userData['productId'] = p.id;
          m.updateMatrix();
          m.matrixAutoUpdate = false;
          scene.add(m);
          products.push(m);
          n++;
        }
      });
    }
  });

  // ---------- produce tables + open coolers at the front ----------
  const woodMat = new THREE.MeshStandardMaterial({ color: "#8a6136", roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group();
    t.position.set(-22 + i * 0, 0, 0);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 2.6), woodMat);
    table.position.set(-24, 0.38, -8 + i * 6);
    table.castShadow = table.receiveShadow = true;
    scene.add(table);
    addCollider(-24, -8 + i * 6, 2.8, 2.8);
    const produceItems = CATALOG.filter((p) => p.aisle === "Produce");
    for (let k = 0; k < 14; k++) {
      const p = produceItems[(k + i * 3) % produceItems.length]!;
      const m = meshFor(p);
      m.position.set(-24 + (Math.random() - 0.5) * 2.1, 0.82 + Math.random() * 0.08, -8 + i * 6 + (Math.random() - 0.5) * 2.1);
      m.rotation.set(Math.random(), Math.random(), Math.random());
      m.userData['productId'] = p.id;
      scene.add(m);
      products.push(m);
    }
    scene.add(t);
  }

  // ---------- refrigerated cases (openable glass doors) ----------
  type FridgeDoor = { pivot: THREE.Group; panel: THREE.Mesh; open: boolean; angle: number; stock: THREE.Mesh[] };
  const fridgeDoors: FridgeDoor[] = [];
  const doorPanels: THREE.Mesh[] = [];

  const fridgeGlass = new THREE.MeshPhysicalMaterial({
    color: "#dff0f7",
    transmission: 0.86,
    roughness: 0.04,
    thickness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    envMapIntensity: 2.4,
    clearcoat: 1,
  });
  const fridgeBody = new THREE.MeshPhysicalMaterial({
    color: "#e7ecf0",
    roughness: 0.22,
    metalness: 0.85,
    envMapIntensity: 2.2,
    clearcoat: 0.6,
  });
  const fridgeInner = new THREE.MeshStandardMaterial({ color: "#c9d6dd", roughness: 0.35, metalness: 0.4 });
  const chromeBar = new THREE.MeshPhysicalMaterial({
    color: "#e6ebee",
    roughness: 0.09,
    metalness: 1,
    envMapIntensity: 2.6,
    clearcoat: 1,
  });

  function buildFridgeBank(aisle: string, x: number, z0: number, facing: 1 | -1, units: number, label: string) {
    const items = CATALOG.filter((p) => p.aisle === aisle);
    const UW = 1.5;
    const depth = 1.5;
    const height = 2.6;
    const bankLen = units * UW;
    addCollider(x, z0 + bankLen / 2 - UW / 2, depth + 0.2, bankLen + 0.2);

    // shell
    const shell = new THREE.Mesh(new THREE.BoxGeometry(depth, height, bankLen), fridgeBody);
    shell.position.set(x, height / 2, z0 + bankLen / 2 - UW / 2);
    shell.castShadow = shell.receiveShadow = true;
    scene.add(shell);

    // header sign
    const header = new THREE.Mesh(
      new THREE.PlaneGeometry(bankLen, 0.8),
      new THREE.MeshStandardMaterial({
        map: signTex(label, aisle, "#0d4f7a"),
        roughness: 0.5,
        emissive: new THREE.Color("#0d4f7a"),
        emissiveIntensity: 0.3,
      }),
    );
    header.position.set(x + facing * (depth / 2 + 0.02), height + 0.45, z0 + bankLen / 2 - UW / 2);
    header.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(header);

    const caseLight = new THREE.PointLight("#eaf6ff", 6, 12, 2);
    caseLight.position.set(x + facing * 1.2, 2.2, z0 + bankLen / 2 - UW / 2);
    scene.add(caseLight);

    for (let u = 0; u < units; u++) {
      const cz = z0 + u * UW;

      // interior alcove + stock on 3 racks
      const alcove = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.3, height - 0.5, UW - 0.14), fridgeInner);
      alcove.position.set(x - facing * 0.12, height / 2 - 0.05, cz);
      scene.add(alcove);

      const stock: THREE.Mesh[] = [];
      if (items.length) {
        [0.62, 1.24, 1.86].forEach((sy, level) => {
          const rack = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.4, 0.03, UW - 0.2), shelfDeck);
          rack.position.set(x - facing * 0.1, sy, cz);
          scene.add(rack);
          for (let k = 0; k < 4; k++) {
            const p = items[(u * 3 + level * 2 + k) % items.length]!;
            const m = meshFor(p);
            m.position.set(x + facing * (depth / 2 - 0.45), sy + 0.17, cz - UW / 2 + 0.28 + k * 0.3);
            m.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
            m.userData['productId'] = p.id;
            m.updateMatrix();
            m.matrixAutoUpdate = false;
            scene.add(m);
            stock.push(m);
          }
        });
      }

      // hinged glass door
      const pivot = new THREE.Group();
      pivot.position.set(x + facing * (depth / 2 + 0.03), height / 2 - 0.1, cz - (UW / 2) * facing);
      scene.add(pivot);

      const panel = new THREE.Mesh(new THREE.PlaneGeometry(UW - 0.06, height - 0.4), fridgeGlass);
      panel.position.set(0, 0, (facing * (UW - 0.06)) / 2);
      panel.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      panel.userData['fridgeIndex'] = fridgeDoors.length;
      pivot.add(panel);
      doorPanels.push(panel);

      const frameMat = fridgeBody;
      for (const off of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, height - 0.4, 0.06), frameMat);
        bar.position.set(0, 0, (facing * (UW - 0.06)) / 2 + off * ((UW - 0.06) / 2));
        pivot.add(bar);
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height - 0.9, 8), chromeBar);
      handle.position.set(facing * 0.07, 0, (facing * (UW - 0.06)) / 2 + facing * ((UW - 0.06) / 2 - 0.12));
      pivot.add(handle);

      fridgeDoors.push({ pivot, panel, open: false, angle: 0, stock });
    }
  }

  buildFridgeBank("Dairy", -W / 2 + 1.4, -13, 1, 5, "DAIRY");
  buildFridgeBank("Meat", W / 2 - 1.4, -13, -1, 5, "MEAT");

  function updateFridgeDoors(dt: number) {
    for (const d of fridgeDoors) {
      const wanted = d.open ? 1 : 0;
      if (Math.abs(d.angle - wanted) < 0.001) continue;
      d.angle += (wanted - d.angle) * Math.min(1, dt * 7);
      d.pivot.rotation.y = -d.angle * 1.9;
    }
  }

  function toggleFridge(index: number) {
    const d = fridgeDoors[index];
    if (!d) return;
    d.open = !d.open;
    if (d.open) {
      for (const m of d.stock) if (!products.includes(m)) products.push(m);
    } else {
      for (const m of d.stock) {
        const i = products.indexOf(m);
        if (i >= 0) products.splice(i, 1);
      }
    }
    thunk(d.open);
  }


  // ---------- checkout front end ----------
  const kiosks: THREE.Vector3[] = [];
  const counterMat = new THREE.MeshStandardMaterial({ color: "#f2f4f6", roughness: 0.3, metalness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#1b2027", roughness: 0.45, metalness: 0.5 });
  const beltMat = new THREE.MeshStandardMaterial({ color: "#22262b", roughness: 0.9 });

  for (let i = -2; i <= 2; i++) {
    const g = new THREE.Group();
    const x = i * 5.5;
    const z = 13;
    g.position.set(x, 0, z);
    scene.add(g);
    addCollider(x, z, 2.4, 2.2);
    kiosks.push(new THREE.Vector3(x, 0, z));

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.02, 1.8), counterMat);
    body.position.y = 0.51;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.1), beltMat);
    belt.position.y = 1.05;
    g.add(belt);
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.5), darkMat);
    scanner.position.set(0.55, 1.12, 0);
    g.add(scanner);
    const scanGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.3),
      new THREE.MeshStandardMaterial({ color: "#ff2a2a", emissive: new THREE.Color("#ff2a2a"), emissiveIntensity: 2 }),
    );
    scanGlow.rotation.x = -Math.PI / 2;
    scanGlow.position.set(0.55, 1.21, 0);
    g.add(scanGlow);

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.75, 10), darkMat);
    stand.position.set(-0.75, 1.4, -0.35);
    g.add(stand);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.58, 0.06),
      new THREE.MeshStandardMaterial({
        color: "#0b1a2b",
        emissive: new THREE.Color("#2ea8ff"),
        emissiveIntensity: 1.1,
        roughness: 0.25,
      }),
    );
    screen.position.set(-0.75, 1.85, -0.35);
    screen.rotation.y = 0.3;
    g.add(screen);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), darkMat);
    pole.position.set(0.9, 1.8, -0.4);
    g.add(pole);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 12),
      new THREE.MeshStandardMaterial({ color: "#fff", emissive: new THREE.Color("#39d17a"), emissiveIntensity: 2.4 }),
    );
    beacon.position.set(0.9, 2.6, -0.4);
    g.add(beacon);
    const laneSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.75),
      new THREE.MeshStandardMaterial({ map: signTex(String(i + 3), "self checkout", "#0f5c46"), roughness: 0.6 }),
    );
    laneSign.position.set(0, 3.1, -0.4);
    g.add(laneSign);
  }
  const kioskLight = new THREE.PointLight("#4bf0a0", 10, 20, 2);
  kioskLight.position.set(0, 3, 13);
  scene.add(kioskLight);

  // entrance storefront glass
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#d8ecf6",
    transmission: 0.9,
    roughness: 0.05,
    thickness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.45,
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(30, 4.2), glass);
  win.position.set(0, 2.3, D / 2 - 0.05);
  win.rotation.y = Math.PI;
  scene.add(win);
  for (let x = -15; x <= 15; x += 3) {
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.12), steel);
    mull.position.set(x, 2.3, D / 2 - 0.1);
    scene.add(mull);
  }

  // ---------- shopping cart (first person, visible when looking down) ----------
  function buildCart(tint: string, small = false) {
    const g = new THREE.Group();
    const chrome = new THREE.MeshPhysicalMaterial({ color: "#e6ebee", roughness: 0.1, metalness: 1.0, envMapIntensity: 2.6, clearcoat: 1, clearcoatRoughness: 0.06 });
    const plastic = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.4, metalness: 0.1 });
    const s = small ? 0.85 : 1;

    const basket = new THREE.Group();
    basket.position.y = 0.62 * s;
    // wire basket: floor + 4 walls made of thin bars
    const barGeoZ = new THREE.BoxGeometry(0.02, 0.02, 0.78 * s);
    const barGeoX = new THREE.BoxGeometry(0.62 * s, 0.02, 0.02);
    for (let i = -4; i <= 4; i++) {
      const b = new THREE.Mesh(barGeoZ, chrome);
      b.position.set((i / 4) * 0.3 * s, 0, 0);
      basket.add(b);
    }
    for (let i = -5; i <= 5; i++) {
      const b = new THREE.Mesh(barGeoX, chrome);
      b.position.set(0, 0, (i / 5) * 0.38 * s);
      basket.add(b);
    }
    const wall = (w: number, h: number, x: number, z: number, ry: number) => {
      const wg = new THREE.Group();
      for (let i = 0; i <= 8; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.018, h, 0.018), chrome);
        b.position.set((i / 8 - 0.5) * w, h / 2, 0);
        wg.add(b);
      }
      for (let j = 0; j <= 3; j++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, 0.018), chrome);
        b.position.set(0, (j / 3) * h, 0);
        wg.add(b);
      }
      wg.position.set(x, 0, z);
      wg.rotation.y = ry;
      basket.add(wg);
    };
    wall(0.78 * s, 0.34 * s, 0.31 * s, 0, Math.PI / 2);
    wall(0.78 * s, 0.34 * s, -0.31 * s, 0, Math.PI / 2);
    wall(0.62 * s, 0.34 * s, 0, 0.39 * s, 0);
    wall(0.62 * s, 0.34 * s, 0, -0.39 * s, 0);
    g.add(basket);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.62 * s, 10), plastic);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.0 * s, 0.42 * s);
    g.add(handle);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42 * s, 8), chrome);
      post.position.set(sx * 0.3 * s, 0.79 * s, 0.42 * s);
      g.add(post);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6 * s, 8), chrome);
      leg.position.set(sx * 0.28 * s, 0.3 * s, 0.3 * s);
      g.add(leg);
      const leg2 = leg.clone();
      leg2.position.z = -0.3 * s;
      g.add(leg2);
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), plastic);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 0.28 * s, 0.06, sz * 0.3 * s);
        g.add(wheel);
      }
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.16 * s, 0.02), plastic);
    plate.position.set(0, 0.72 * s, 0.4 * s);
    g.add(plate);

    return { group: g, basketY: 0.66 * s };
  }

  const cart = buildCart("#c8202c");
  scene.add(cart.group);
  const cartItems: THREE.Mesh[] = [];
  const cartAnchor = new THREE.Object3D();

  // detachable-cart state
  let cartAttached = true;
  const cartVel = new THREE.Vector3();
  let carried: { id: string; mesh: THREE.Mesh } | null = null;
  const projectiles: { mesh: THREE.Mesh; id: string; vel: THREE.Vector3 }[] = [];
  const RIM_Y = 0.95;

  function layoutCart() {
    cartItems.forEach((m, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3) % 4;
      const layer = Math.floor(i / 12);
      m.position.set(-0.2 + col * 0.2, cart.basketY + 0.08 + layer * 0.17, -0.28 + row * 0.19);
      m.rotation.set(0, (i % 5) * 0.4, 0);
    });
  }

  function addToCart(id: string) {
    const p = byId(id);
    const m = meshFor(p);
    m.castShadow = false;
    m.userData['productId'] = id;
    cart.group.add(m);
    cartItems.push(m);
    layoutCart();
  }

  function removeFromCart(id: string) {
    const idx = cartItems.findIndex((m) => m.userData['productId'] === id);
    if (idx >= 0) {
      const [m] = cartItems.splice(idx, 1);
      m && cart.group.remove(m);
      layoutCart();
    }
  }


  // ---------- shoppers (NPCs) + remote players ----------
  const skinTones = ["#e8c39e", "#c98b62", "#8d5a3b", "#f0d5bd", "#5f3b28"];

  function buildAvatar(shirt: string, skin: string, withCart: boolean) {
    const g = new THREE.Group();
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.82 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: "#2b3038", roughness: 0.92 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: "#16181d", roughness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: "#2a1e18", roughness: 0.95 });

    // legs (pivot at hip so they can swing)
    const makeLeg = (sx: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.11, 0.86, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.093, 0.34, 3, 8), pantsMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      pivot.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.077, 0.32, 3, 8), pantsMat);
      shin.position.y = -0.6;
      pivot.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), shoeMat);
      shoe.position.set(0, -0.82, 0.05);
      pivot.add(shoe);
      g.add(pivot);
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.12, 3, 10), pantsMat);
    hips.position.y = 0.92;
    hips.scale.z = 0.8;
    g.add(hips);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 4, 12), shirtMat);
    torso.position.y = 1.24;
    torso.scale.set(1.12, 1, 0.72);
    torso.castShadow = true;
    g.add(torso);
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 3, 10), shirtMat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.y = 1.42;
    shoulders.scale.z = 0.78;
    g.add(shoulders);

    // arms (pivot at shoulder, reaching slightly forward toward the cart handle)
    const makeArm = (sx: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.245, 1.42, 0);
      pivot.rotation.x = withCart ? -0.75 : -0.15;
      pivot.rotation.z = sx * 0.06;
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.26, 3, 8), shirtMat);
      upper.position.y = -0.17;
      pivot.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.24, 3, 8), skinMat);
      fore.position.y = -0.44;
      pivot.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), skinMat);
      hand.position.y = -0.6;
      hand.scale.set(1, 1.1, 0.7);
      pivot.add(hand);
      g.add(pivot);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 8), skinMat);
    neck.position.y = 1.5;
    g.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skinMat);
    head.position.y = 1.63;
    head.scale.set(0.92, 1.12, 1);
    head.castShadow = true;
    g.add(head);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skinMat);
    jaw.position.set(0, 1.58, 0.015);
    jaw.scale.set(0.88, 0.8, 1);
    g.add(jaw);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skinMat);
      ear.position.set(sx * 0.115, 1.63, 0);
      ear.scale.set(0.5, 1, 0.8);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: "#1a1d22", roughness: 0.3 }));
      eye.position.set(sx * 0.045, 1.655, 0.105);
      g.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 6), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.625, 0.12);
    g.add(nose);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), hairMat);
    hair.position.y = 1.64;
    hair.scale.set(0.96, 1.2, 1.04);
    g.add(hair);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.128, 12, 10, 0, Math.PI, 0, Math.PI / 1.5), hairMat);
    back.position.set(0, 1.62, -0.01);
    back.rotation.y = -Math.PI / 2;
    g.add(back);

    g.userData['limbs'] = { legL, legR, armL, armR };
    if (withCart) {
      const c = buildCart("#3a4550", true);
      c.group.position.set(0, 0, 0.78);
      c.group.rotation.y = Math.PI; // handle faces the shopper
      g.add(c.group);
      g.userData['cartGroup'] = c.group;
      g.userData['basketY'] = c.basketY;
    }
    return g;
  }



  // ---------- world leaderboard board (back wall) ----------
  const boardCanvas = makeCanvas(1024, 768);
  const boardTex = toTex(boardCanvas[0]);
  const boardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshStandardMaterial({ map: boardTex, emissive: new THREE.Color("#ffffff"), emissiveMap: boardTex, emissiveIntensity: 0.55, roughness: 0.5 }),
  );
  boardMesh.position.set(0, 3.2, -D / 2 + 0.08);
  scene.add(boardMesh);
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.5, 0.16), shelfSteel);
  boardFrame.position.set(0, 3.2, -D / 2 - 0.02);
  scene.add(boardFrame);
  const boardLight = new THREE.PointLight("#dff3ff", 6, 14, 2);
  boardLight.position.set(0, 4.6, -D / 2 + 2);
  scene.add(boardLight);

  function drawBoard(entries: { name: string; total_seconds: number; score: number }[]) {
    const [, g] = boardCanvas;
    g.fillStyle = "#0d1420";
    g.fillRect(0, 0, 1024, 768);
    g.fillStyle = "#c8202c";
    g.fillRect(0, 0, 1024, 110);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 62px Helvetica, Arial, sans-serif";
    g.fillText("WORLD LEADERBOARD", 512, 56);
    g.font = "600 30px Helvetica, Arial, sans-serif";
    g.fillStyle = "#8fe3b6";
    g.fillText("HIGHEST SCORING 10-LEVEL RUNS", 512, 148);
    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    if (!entries.length) {
      g.fillStyle = "#7f8b9b";
      g.font = "500 34px Helvetica, Arial, sans-serif";
      g.fillText("No runs yet — be the first to finish", 512, 400);
    }
    entries.slice(0, 10).forEach((e, i) => {
      const y = 210 + i * 54;
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)";
      g.fillRect(90, y - 22, 844, 46);
      g.textAlign = "left";
      g.fillStyle = i === 0 ? "#ffd76a" : "#e6edf5";
      g.font = "700 34px Helvetica, Arial, sans-serif";
      g.fillText(`${i + 1}.`, 110, y);
      g.fillText(e.name.slice(0, 12), 180, y);
      g.textAlign = "right";
      g.fillStyle = "#7f8b9b";
      g.font = "600 26px monospace";
      g.fillText(fmt(e.total_seconds), 700, y);
      g.fillStyle = i === 0 ? "#ffd76a" : "#8fe3b6";
      g.font = "700 36px monospace";
      g.fillText(`${e.score} pts`, 914, y);
    });
    boardTex.needsUpdate = true;
  }
  drawBoard([]);


  // remote players
  type RemoteEntry = {
    group: THREE.Group;
    target: THREE.Vector3;
    yaw: number;
    label: THREE.Sprite;
    name: string;
    cart: string[];
    cartMeshes: THREE.Mesh[];
  };
  const remotes = new Map<string, RemoteEntry>();

  function nameSprite(name: string, color: string) {
    const [c, g] = makeCanvas(256, 64);
    g.fillStyle = "rgba(12,16,22,0.72)";
    g.fillRect(0, 8, 256, 48);
    g.fillStyle = color;
    g.fillRect(0, 8, 6, 48);
    g.fillStyle = "#ffffff";
    g.font = "600 28px Helvetica, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name.slice(0, 14), 132, 32);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTex(c), depthTest: false, transparent: true }));
    sp.scale.set(1.3, 0.33, 1);
    sp.position.y = 2.0;
    return sp;
  }

  function syncRemoteCart(entry: RemoteEntry, ids: string[]) {
    const same = ids.length === entry.cart.length && ids.every((v, i) => entry.cart[i] === v);
    if (same) return;
    entry.cart = [...ids];
    const cg = entry.group.userData['cartGroup'] as THREE.Group | undefined;
    if (!cg) return;
    entry.cartMeshes.forEach((m) => cg.remove(m));
    entry.cartMeshes.length = 0;
    const basketY = (entry.group.userData['basketY'] as number) ?? 0.56;
    ids.slice(0, 24).forEach((id, i) => {
      const m = meshFor(byId(id));
      m.castShadow = false;
      const col = i % 3;
      const row = Math.floor(i / 3) % 4;
      const layer = Math.floor(i / 12);
      m.position.set(-0.17 + col * 0.17, basketY + 0.07 + layer * 0.15, -0.24 + row * 0.16);
      m.rotation.set(0, (i % 5) * 0.4, 0);
      cg.add(m);
      entry.cartMeshes.push(m);
    });
  }

  function setRemotePlayers(list: RemotePlayer[]) {
    const seen = new Set<string>();
    for (const rp of list) {
      seen.add(rp.id);
      let entry = remotes.get(rp.id);
      if (!entry) {
        const group = buildAvatar(rp.color, skinTones[Math.floor(Math.random() * skinTones.length)]!, true);
        const label = nameSprite(rp.name, rp.color);
        group.add(label);
        scene.add(group);
        group.position.set(rp.x, 0, rp.z);
        entry = {
          group,
          target: new THREE.Vector3(rp.x, 0, rp.z),
          yaw: rp.yaw,
          label,
          name: rp.name,
          cart: [],
          cartMeshes: [],
        };
        remotes.set(rp.id, entry);
      }
      entry.target.set(rp.x, 0, rp.z);
      entry.yaw = rp.yaw;
      entry.name = rp.name;
      if (rp.cart) syncRemoteCart(entry, rp.cart);
    }
    for (const [id, entry] of remotes) {
      if (!seen.has(id)) {
        scene.remove(entry.group);
        remotes.delete(id);
      }
    }
  }


  // ---------- input ----------
  const keys = new Set<string>();
  let locked = false;
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (!locked) return;
    if (e.code === "KeyE") interact();
    if (e.code === "KeyF") toggleCartHold();
    if (e.code === "KeyQ") throwCarried();
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onMouseMove = (e: MouseEvent) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0021;
    player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0021, -1.35, 1.2);
  };
  const onMouseDown = (e: MouseEvent) => {
    if (!locked || e.button !== 0) return;
    throwCarried();
  };
  const onLock = () => {
    locked = document.pointerLockElement === canvas;
    cb.onLockChange(locked);
  };
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("pointerlockchange", onLock);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 3.4;
  let target: THREE.Mesh | null = null;
  let doorTarget: number | null = null;
  let stealTarget: string | null = null;
  let atKiosk = false;

  function notifyCartMode() {
    cb.onCartModeChange?.(cartAttached, carried?.id ?? null);
  }

  function toggleCartHold() {
    if (!cartAttached) {
      // must be next to the cart to grab it again
      const d = Math.hypot(cart.group.position.x - player.pos.x, cart.group.position.z - player.pos.z);
      if (d > 1.9) {
        cb.onPrompt("Walk back to your cart to grab it  [F]");
        lastPrompt = "grab";
        return;
      }
      cartAttached = true;
      cartVel.set(0, 0, 0);
      tone(300, 0.16, "square", 0.09, 1.4);
    } else {
      cartAttached = false;
      cartVel.set(0, 0, 0);
      tone(210, 0.18, "square", 0.09, 0.8);
    }
    notifyCartMode();
  }

  function dropCarriedIntoCart() {
    if (!carried) return;
    scene.remove(carried.mesh);
    addToCart(carried.id);
    cb.onPickup(carried.id);
    tone(520, 0.12, "sine", 0.1, 1.6);
    carried = null;
    notifyCartMode();
  }

  function throwCarried() {
    if (!carried) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const mesh = carried.mesh;
    scene.add(mesh);
    mesh.position.copy(camera.position).add(dir.clone().multiplyScalar(0.5));
    projectiles.push({
      mesh,
      id: carried.id,
      vel: dir.multiplyScalar(9.5).add(new THREE.Vector3(0, 2.4, 0)),
    });
    carried = null;
    tone(420, 0.1, "triangle", 0.07, 0.7);
    notifyCartMode();
  }

  function takeProduct(mesh: THREE.Mesh) {
    const id = mesh.userData['productId'] as string;
    const i = products.indexOf(mesh);
    if (i >= 0) products.splice(i, 1);
    if (cartAttached) {
      scene.remove(mesh);
      addToCart(id);
      cb.onPickup(id);
    } else {
      if (carried) {
        cb.onPrompt("Hands full — stash this in your cart first");
        lastPrompt = "full";
        products.push(mesh);
        return;
      }
      mesh.matrixAutoUpdate = true;
      carried = { id, mesh };
      notifyCartMode();
    }
    target = null;
  }

  function interact() {
    if (doorTarget !== null) {
      toggleFridge(doorTarget);
      return;
    }
    if (stealTarget) {
      const victim = remotes.get(stealTarget);
      if (victim && victim.cart.length) {
        const id = victim.cart[Math.floor(Math.random() * victim.cart.length)]!;
        cb.onSteal?.(stealTarget, id);
        if (cartAttached) {
          addToCart(id);
          cb.onPickup(id);
        } else if (!carried) {
          const mesh = meshFor(byId(id));
          mesh.userData['productId'] = id;
          scene.add(mesh);
          carried = { id, mesh };
          notifyCartMode();
        }
        tone(880, 0.13, "square", 0.1, 1.5);
      }
      return;
    }
    if (!cartAttached && carried) {
      const d = Math.hypot(cart.group.position.x - player.pos.x, cart.group.position.z - player.pos.z);
      if (d < 1.8) {
        dropCarriedIntoCart();
        return;
      }
    }
    if (atKiosk) {
      document.exitPointerLock();
      cb.onCheckout();
      return;
    }
    if (target) takeProduct(target);
  }


  // ---------- loop ----------
  const clock = new THREE.Clock();
  let raf = 0;
  const tmpBox = new THREE.Box3();
  const tmpV = new THREE.Vector3();

  function hitsCollider(x: number, z: number, r: number) {
    tmpBox.setFromCenterAndSize(tmpV.set(x, 1, z), new THREE.Vector3(r * 2, 2, r * 2));
    return colliders.some((c) => c.intersectsBox(tmpBox));
  }

  function move(dt: number) {
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    if (keys.has("KeyW") || keys.has("ArrowUp")) dir.add(fwd);
    if (keys.has("KeyS") || keys.has("ArrowDown")) dir.sub(fwd);
    if (keys.has("KeyD") || keys.has("ArrowRight")) dir.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dir.sub(right);
    const freeBoost = cartAttached ? 1 : 1.55;
    const speed = (keys.has("ShiftLeft") ? 5.8 : 3.2) * freeBoost;
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed);
    player.vel.lerp(dir, 1 - Math.pow(0.0015, dt));

    const r = 0.4;
    const tryAxis = (axis: "x" | "z", amount: number) => {
      const old = player.pos[axis];
      player.pos[axis] += amount;
      if (hitsCollider(player.pos.x, player.pos.z, r)) player.pos[axis] = old;
    };
    tryAxis("x", player.vel.x * dt);
    tryAxis("z", player.vel.z * dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -W / 2 + 0.8, W / 2 - 0.8);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -D / 2 + 0.8, D / 2 - 0.8);

    const bob = Math.sin(clock.elapsedTime * 9) * Math.min(player.vel.length() / speed, 1) * 0.04;
    camera.position.set(player.pos.x, 1.68 + bob, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  }

  const CART_BODY_R = 0.5;
  let shelfHitCooldown = 0;

  function pushCart(impulse: THREE.Vector3, fromDir: THREE.Vector3) {
    // rolling axis is the cart's local forward (wheels roll along it)
    const cy = cart.group.rotation.y;
    const fwd = new THREE.Vector3(-Math.sin(cy), 0, -Math.cos(cy));
    const along = Math.abs(fromDir.dot(fwd));
    const factor = along > 0.6 ? 3.2 : 0.6; // rolling side vs. sideways skid
    cartVel.add(impulse.multiplyScalar(factor));
  }

  function updateCart(dt: number) {
    if (cartAttached) {
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const wantX = player.pos.x + fwd.x * 1.05;
      const wantZ = player.pos.z + fwd.z * 1.05;
      cartAnchor.position.set(wantX, 0, wantZ);
      cart.group.position.lerp(cartAnchor.position, 1 - Math.pow(0.0008, dt));

      // cart body collides with shelves, fridges, counters
      if (hitsCollider(cart.group.position.x, cart.group.position.z, CART_BODY_R)) {
        const back = new THREE.Vector3(player.pos.x - cart.group.position.x, 0, player.pos.z - cart.group.position.z);
        if (back.lengthSq() > 1e-6) {
          back.normalize().multiplyScalar(0.09);
          player.pos.x += back.x;
          player.pos.z += back.z;
          camera.position.set(player.pos.x, camera.position.y, player.pos.z);
          cart.group.position.x += back.x;
          cart.group.position.z += back.z;
          cartAnchor.position.copy(cart.group.position);
        }
        player.vel.multiplyScalar(0.25);
        if (shelfHitCooldown === 0) {
          shelfHitCooldown = 0.5;
          burstSparks(new THREE.Vector3(cart.group.position.x, 0.7, cart.group.position.z));
          dink();
        }
      }

      const wanted = player.yaw;
      const delta = ((wanted - cart.group.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      cart.group.rotation.y += delta * Math.min(1, dt * 8);
    } else {
      // loose cart: rolls, slows down, bumps into fixtures
      cartVel.multiplyScalar(Math.pow(0.12, dt));
      if (cartVel.lengthSq() < 0.0004) cartVel.set(0, 0, 0);
      const step = (axis: "x" | "z") => {
        const old = cart.group.position[axis];
        cart.group.position[axis] += cartVel[axis] * dt;
        if (hitsCollider(cart.group.position.x, cart.group.position.z, CART_BODY_R)) {
          cart.group.position[axis] = old;
          cartVel[axis] *= -0.28;
          if (shelfHitCooldown === 0 && Math.abs(cartVel[axis]) > 0.6) {
            shelfHitCooldown = 0.5;
            burstSparks(new THREE.Vector3(cart.group.position.x, 0.7, cart.group.position.z));
            dink();
          }
        }
      };
      step("x");
      step("z");
      cart.group.position.x = THREE.MathUtils.clamp(cart.group.position.x, -W / 2 + 1, W / 2 - 1);
      cart.group.position.z = THREE.MathUtils.clamp(cart.group.position.z, -D / 2 + 1, D / 2 - 1);
      cartAnchor.position.copy(cart.group.position);

      // the player can shove their own parked cart around
      const dx = cart.group.position.x - player.pos.x;
      const dz = cart.group.position.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.95 && d > 1e-4) {
        const fromDir = new THREE.Vector3(dx / d, 0, dz / d);
        pushCart(fromDir.clone().multiplyScalar(1.6), fromDir);
        player.pos.x -= (dx / d) * 0.05;
        player.pos.z -= (dz / d) * 0.05;
      }
    }
  }

  function updateCarried(dt: number) {
    shelfHitCooldown = Math.max(0, shelfHitCooldown - dt);
    if (carried) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
      carried.mesh.position
        .copy(camera.position)
        .add(dir.multiplyScalar(0.62))
        .add(right.multiplyScalar(0.24))
        .add(new THREE.Vector3(0, -0.22, 0));
      carried.mesh.rotation.y += dt * 1.2;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i]!;
      pr.vel.y -= 12 * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.mesh.rotation.x += dt * 6;
      pr.mesh.rotation.z += dt * 4;

      const cp = cart.group.position;
      const inXZ = Math.hypot(pr.mesh.position.x - cp.x, pr.mesh.position.z - cp.z) < 0.44;
      // must drop in through the TOP half of the basket
      if (inXZ && pr.vel.y < 0 && pr.mesh.position.y < RIM_Y + 0.1 && pr.mesh.position.y > RIM_Y - 0.35) {
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        addToCart(pr.id);
        cb.onPickup(pr.id);
        tone(760, 0.14, "sine", 0.12, 1.7);
        continue;
      }
      if (inXZ && pr.mesh.position.y < RIM_Y - 0.35 && pr.mesh.position.y > 0.25) {
        // clanged off the side of the basket
        pr.vel.multiplyScalar(-0.35);
        dink();
      }
      if (pr.mesh.position.y <= 0.11) {
        pr.mesh.position.y = 0.11;
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        const dropped = meshFor(byId(pr.id));
        dropped.userData['productId'] = pr.id;
        dropped.position.copy(pr.mesh.position);
        scene.add(dropped);
        products.push(dropped);
        tone(160, 0.1, "sine", 0.06, 0.6);
      }
    }
  }

  let lastPrompt: string | null = null;
  const nearby: THREE.Mesh[] = [];
  const remoteCartPos = new THREE.Vector3();
  function updatePrompt() {
    let bestK = Infinity;
    for (const k of kiosks) bestK = Math.min(bestK, camera.position.distanceTo(k));
    atKiosk = bestK < 2.8;
    doorTarget = null;
    stealTarget = null;
    target = null;
    let text: string | null = null;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // steal from another shopper's cart
    let bestSteal = 2.6;
    for (const [id, r] of remotes) {
      if (!r.cart.length) continue;
      const ry = r.group.rotation.y;
      remoteCartPos.set(r.group.position.x + Math.sin(ry) * 0.75, 1, r.group.position.z + Math.cos(ry) * 0.75);
      const d = remoteCartPos.distanceTo(camera.position);
      if (d < bestSteal) {
        bestSteal = d;
        stealTarget = id;
        text = `Swipe an item from ${r.name}'s cart (${r.cart.length})  [E]`;
      }
    }

    if (!stealTarget) {
      const doorHit = raycaster.intersectObjects(doorPanels, false)[0];
      if (doorHit && doorHit.distance < 2.6) {
        doorTarget = doorHit.object.userData['fridgeIndex'] as number;
        text = `${fridgeDoors[doorTarget]?.open ? "Close" : "Open"} cooler door  [E]`;
      }
    }

    if (!stealTarget && doorTarget === null && !cartAttached && carried) {
      const d = Math.hypot(cart.group.position.x - player.pos.x, cart.group.position.z - player.pos.z);
      if (d < 1.8) text = "Put item in cart  [E]  ·  or throw it  [click / Q]";
    }

    if (!text && atKiosk) {
      text = "Use self-checkout  [E]";
    } else if (!text) {
      nearby.length = 0;
      for (const p of products) {
        if (p.position.distanceToSquared(camera.position) < 16) nearby.push(p);
      }
      const hit = raycaster.intersectObjects(nearby, false)[0];
      target = (hit?.object as THREE.Mesh) ?? null;
      if (target) {
        const p = byId(target.userData['productId'] as string);
        text =
          !cartAttached && carried
            ? "Hands full — stash the item in your cart first"
            : `Take ${p.brand} ${p.name}  ·  $${p.price.toFixed(2)}  [E]`;
      }
    }

    if (!text) {
      text = cartAttached ? "Let go of cart  [F] — run faster, carry one item" : "Grab your cart  [F]";
    }

    if (text !== lastPrompt) {
      lastPrompt = text;
      cb.onPrompt(text);
    }
  }


  let walkPhase = 0;
  function updateRemotes(dt: number) {
    walkPhase += dt;
    for (const [, r] of remotes) {
      const prevX = r.group.position.x;
      const prevZ = r.group.position.z;
      r.group.position.lerp(r.target, Math.min(1, dt * 6));
      const delta = ((r.yaw + Math.PI - r.group.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      r.group.rotation.y += delta * Math.min(1, dt * 6);

      const speed = Math.hypot(r.group.position.x - prevX, r.group.position.z - prevZ) / Math.max(dt, 0.001);
      const limbs = r.group.userData['limbs'] as
        | { legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group }
        | undefined;
      if (limbs) {
        const amp = Math.min(speed / 3.2, 1) * 0.6;
        const swing = Math.sin(walkPhase * 7) * amp;
        limbs.legL.rotation.x = swing;
        limbs.legR.rotation.x = -swing;
        limbs.armL.rotation.x = -0.75 + swing * 0.15;
        limbs.armR.rotation.x = -0.75 - swing * 0.15;
      }
    }
  }


  // ---------- cart-to-cart collisions: sparks + dink ----------
  let audioCtx: AudioContext | null = null;
  function dink() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtx ??= new Ctor();
      const ctx = audioCtx;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      gain.connect(ctx.destination);
      for (const [f, d] of [[1650, 1], [2480, 0.5]] as const) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, t0);
        osc.frequency.exponentialRampToValueAtTime(f * 0.82, t0 + 0.22);
        const g2 = ctx.createGain();
        g2.gain.value = d;
        osc.connect(g2).connect(gain);
        osc.start(t0);
        osc.stop(t0 + 0.28);
      }
    } catch {
      /* audio unavailable */
    }
  }

  const SPARKS = 48;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  let sparkLife = 0;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkPoints = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: "#ffd27a", size: 0.055, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sparkPoints.frustumCulled = false;
  sparkPoints.visible = false;
  scene.add(sparkPoints);
  const sparkLight = new THREE.PointLight("#ffbe55", 0, 5, 2);
  scene.add(sparkLight);

  function burstSparks(at: THREE.Vector3) {
    for (let i = 0; i < SPARKS; i++) {
      sparkPos[i * 3] = at.x;
      sparkPos[i * 3 + 1] = at.y;
      sparkPos[i * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2.6;
      sparkVel[i * 3] = Math.cos(a) * sp;
      sparkVel[i * 3 + 1] = 1.0 + Math.random() * 2.4;
      sparkVel[i * 3 + 2] = Math.sin(a) * sp;
    }
    sparkLife = 0.5;
    sparkPoints.visible = true;
    sparkLight.position.copy(at);
  }

  function updateSparks(dt: number) {
    if (sparkLife <= 0) return;
    sparkLife -= dt;
    if (sparkLife <= 0) {
      sparkPoints.visible = false;
      sparkLight.intensity = 0;
      return;
    }
    for (let i = 0; i < SPARKS; i++) {
      sparkVel[i * 3 + 1]! -= 9 * dt;
      sparkPos[i * 3]! += sparkVel[i * 3]! * dt;
      sparkPos[i * 3 + 1]! += sparkVel[i * 3 + 1]! * dt;
      sparkPos[i * 3 + 2]! += sparkVel[i * 3 + 2]! * dt;
    }
    sparkGeo.attributes['position']!.needsUpdate = true;
    (sparkPoints.material as THREE.PointsMaterial).opacity = Math.max(0, sparkLife / 0.5);
    sparkLight.intensity = sparkLife * 12;
  }

  const CART_R = 0.55;
  let hitCooldown = 0;
  const remoteCart = new THREE.Vector3();
  const myCart = new THREE.Vector3();
  function updateCartCollisions(dt: number) {
    hitCooldown = Math.max(0, hitCooldown - dt);
    myCart.copy(cart.group.position);
    for (const [, r] of remotes) {
      const ry = r.group.rotation.y;
      remoteCart.set(r.group.position.x + Math.sin(ry) * 0.75, 0, r.group.position.z + Math.cos(ry) * 0.75);
      const dx = myCart.x - remoteCart.x;
      const dz = myCart.z - remoteCart.z;
      const d = Math.hypot(dx, dz);
      const minD = CART_R * 2;
      const bodyD = Math.hypot(myCart.x - r.group.position.x, myCart.z - r.group.position.z);

      if (!cartAttached && (d < minD || bodyD < CART_R + 0.45)) {
        // someone ran into my parked cart — direction decides how far it rolls
        const ox = d < minD ? dx : myCart.x - r.group.position.x;
        const oz = d < minD ? dz : myCart.z - r.group.position.z;
        const len = Math.hypot(ox, oz) || 1;
        const fromDir = new THREE.Vector3(ox / len, 0, oz / len);
        pushCart(fromDir.clone().multiplyScalar(2.2), fromDir);
        if (hitCooldown === 0) {
          hitCooldown = 0.35;
          burstSparks(new THREE.Vector3(myCart.x, 0.72, myCart.z));
          dink();
        }
        continue;
      }

      if (!cartAttached || d > minD || d < 1e-4) continue;
      // push the player (and their cart) out of the other cart
      const push = minD - d + 0.02;
      player.pos.x += (dx / d) * push;
      player.pos.z += (dz / d) * push;
      player.vel.multiplyScalar(0.2);
      cartAnchor.position.set(myCart.x + (dx / d) * push, 0, myCart.z + (dz / d) * push);
      camera.position.set(player.pos.x, camera.position.y, player.pos.z);
      if (hitCooldown === 0) {
        hitCooldown = 0.35;
        burstSparks(new THREE.Vector3((myCart.x + remoteCart.x) / 2, 0.72, (myCart.z + remoteCart.z) / 2));
        dink();
      }
      break;
    }
  }


  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let netAcc = 0;
  let frame = 0;
  // adaptive resolution: keep the frame rate high on weaker GPUs
  let perfAcc = 0;
  let perfFrames = 0;
  function adaptResolution(dt: number) {
    perfAcc += dt;
    perfFrames++;
    if (perfAcc < 1) return;
    const fps = perfFrames / perfAcc;
    perfAcc = 0;
    perfFrames = 0;
    const min = 0.6;
    const max = Math.min(devicePixelRatio, 1.25);
    let next = renderScale;
    if (fps < 50) next = Math.max(min, renderScale - 0.15);
    else if (fps > 58 && renderScale < max) next = Math.min(max, renderScale + 0.1);
    if (Math.abs(next - renderScale) > 0.01) {
      renderScale = next;
      renderer.setPixelRatio(renderScale);
      resize();
    }
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frame++;
    adaptResolution(dt);
    if (locked) move(dt);
    else camera.position.set(player.pos.x, 1.68, player.pos.z);
    updateCart(dt);
    updateCarried(dt);
    updateFridgeDoors(dt);
    updateCartCollisions(dt);
    if (frame % 3 === 0) updatePrompt();


    updateRemotes(dt);
    updateSparks(dt);

    kioskLight.intensity = 8 + Math.sin(t * 2) * 2;
    netAcc += dt;
    if (netAcc > 0.1) {
      netAcc = 0;
      cb.onMove?.(player.pos.x, player.pos.z, player.yaw);
    }
    renderer.render(scene, camera);
  }
  tick();

  (window as unknown as Record<string, unknown>)['__three'] = { scene, camera, products, player, colliders };

  return {
    lock: () => canvas.requestPointerLock(),
    setRemotePlayers,
    setLeaderboard: (entries: { name: string; total_seconds: number; score: number }[]) => drawBoard(entries),
    returnItem: (id: string) => {
      removeFromCart(id);
      const p = byId(id);
      const mesh = meshFor(p);
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      mesh.position.copy(camera.position).add(fwd.multiplyScalar(1.3));
      mesh.position.y = 1.12;
      mesh.userData['productId'] = id;
      scene.add(mesh);
      products.push(mesh);
    },
    clearCart: () => {
      cartItems.forEach((m) => cart.group.remove(m));
      cartItems.length = 0;
      if (carried) {
        scene.remove(carried.mesh);
        carried = null;
      }
      projectiles.forEach((p) => scene.remove(p.mesh));
      projectiles.length = 0;
      cartAttached = true;
      cartVel.set(0, 0, 0);
      cart.group.position.set(player.pos.x, 0, player.pos.z);
      notifyCartMode();
    },
    removeItem: (id: string) => removeFromCart(id),
    getCartIds: () => cartItems.map((m) => m.userData['productId'] as string),

    dispose: () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
      });
    },
  };
}

export type Game = ReturnType<typeof createGame>;
