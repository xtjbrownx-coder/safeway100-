import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CATALOG, byId, type ProductDef } from "./catalog";

export type GameCallbacks = {
  onPrompt: (text: string | null) => void;
  onPickup: (id: string) => void;
  onCheckout: () => void;
  onLockChange: (locked: boolean) => void;
};

const AISLES = ["Produce", "Dairy", "Bakery", "Pantry", "Snacks", "Drinks", "Household"];

// shelf unit slots: [x, z, rotationY]
const SLOTS: [number, number][] = [
  [-10, -9],
  [0, -9],
  [10, -9],
  [-10, -3.5],
  [0, -3.5],
  [10, -3.5],
  [-10, 2],
];

function labelTexture(p: ProductDef) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = p.color;
  g.fillRect(0, 0, 256, 256);
  // subtle noise for realism
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = p.accent;
  g.fillRect(0, 96, 256, 8);
  g.fillRect(0, 170, 256, 4);
  g.fillStyle = p.accent;
  g.font = "bold 30px Helvetica, Arial, sans-serif";
  g.textAlign = "center";
  const words = p.name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 12) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  lines.push(cur.trim());
  lines.forEach((l, i) => g.fillText(l, 128, 140 + i * 32));
  g.font = "600 20px Helvetica, Arial, sans-serif";
  g.fillText(p.aisle.toUpperCase(), 128, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeProductMesh(p: ProductDef, tex: THREE.Texture) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: p.shape === "bottle" || p.shape === "can" ? 0.25 : 0.75,
    metalness: p.shape === "can" ? 0.55 : 0.05,
  });
  let geo: THREE.BufferGeometry;
  switch (p.shape) {
    case "carton":
      geo = new THREE.BoxGeometry(0.16, 0.34, 0.16);
      break;
    case "box":
      geo = new THREE.BoxGeometry(0.24, 0.3, 0.11);
      break;
    case "bottle":
      geo = new THREE.CylinderGeometry(0.075, 0.085, 0.32, 20);
      break;
    case "can":
      geo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 22);
      break;
    default:
      geo = new THREE.SphereGeometry(0.14, 18, 14);
      geo.scale(1.15, 0.95, 0.9);
  }
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createGame(canvas: HTMLCanvasElement, cb: GameCallbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0e1116");
  scene.fog = new THREE.Fog("#b9c2cc", 45, 110);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 200);
  const player = { pos: new THREE.Vector3(0, 1.65, 14.5), yaw: 0, pitch: 0, vel: new THREE.Vector3() };

  // ---------- store shell ----------
  const W = 44,
    D = 34,
    H = 5;
  const floorTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#d9d6cf";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = 190 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},${Math.random() * 0.5})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    g.strokeStyle = "rgba(120,120,120,0.5)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(W / 1.2, D / 1.2);
    t.anisotropy = 8;
    return t;
  })();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.22, metalness: 0.0, envMapIntensity: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: "#e9ecef", roughness: 0.95 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#dfe3e8", roughness: 0.9 });
  const walls: THREE.Mesh[] = [];
  const mkWall = (w: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
    walls.push(m);
  };
  mkWall(W, 0, -D / 2, 0);
  mkWall(W, 0, D / 2, Math.PI);
  mkWall(D, -W / 2, 0, Math.PI / 2);
  mkWall(D, W / 2, 0, -Math.PI / 2);

  // lighting: ceiling strips
  scene.add(new THREE.HemisphereLight("#eef3f8", "#7d838a", 0.35));
  const key = new THREE.DirectionalLight("#fff6e8", 0.7);
  key.position.set(8, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.bias = -0.0006;
  scene.add(key);

  const stripMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: new THREE.Color("#fff4e0"),
    emissiveIntensity: 1.1,
    roughness: 1,
  });
  for (let zx = -12; zx <= 12; zx += 6) {
    for (let xx = -14; xx <= 14; xx += 14) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 0.7), stripMat);
      strip.position.set(xx, H - 0.35, zx);
      scene.add(strip);
      const pl = new THREE.PointLight("#fff2dd", 9, 18, 2);
      pl.position.set(xx, H - 0.8, zx);
      scene.add(pl);
    }
  }

  // ---------- colliders ----------
  const colliders: THREE.Box3[] = [];
  const addCollider = (cx: number, cz: number, sx: number, sz: number) =>
    colliders.push(
      new THREE.Box3(new THREE.Vector3(cx - sx / 2, 0, cz - sz / 2), new THREE.Vector3(cx + sx / 2, 3, cz + sz / 2)),
    );

  // ---------- shelves + products ----------
  const products: THREE.Mesh[] = [];
  const shelfMetal = new THREE.MeshStandardMaterial({ color: "#b8bec6", roughness: 0.4, metalness: 0.75 });
  const shelfBack = new THREE.MeshStandardMaterial({ color: "#8e959d", roughness: 0.6, metalness: 0.5 });

  const signCanvas = (text: string) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#12324f";
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#ffffff";
    g.font = "bold 62px Helvetica, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.toUpperCase(), 256, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const UNIT_W = 8,
    UNIT_D = 1.5;

  function spawnOnShelf(p: ProductDef, x: number, y: number, z: number, faceZ: number) {
    const mesh = makeProductMesh(p, texCache.get(p.id)!);
    mesh.position.set(x, y, z + faceZ * 0.32);
    mesh.rotation.y = faceZ > 0 ? 0 : Math.PI;
    mesh.userData['productId'] = p.id;
    scene.add(mesh);
    products.push(mesh);
  }

  const texCache = new Map<string, THREE.Texture>();
  CATALOG.forEach((p) => texCache.set(p.id, labelTexture(p)));

  AISLES.forEach((aisle, i) => {
    const [cx, cz] = SLOTS[i] ?? [0, 0];
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    scene.add(group);
    addCollider(cx, cz, UNIT_W + 0.2, UNIT_D + 0.2);

    const back = new THREE.Mesh(new THREE.BoxGeometry(UNIT_W, 2.3, 0.08), shelfBack);
    back.position.y = 1.15;
    back.castShadow = back.receiveShadow = true;
    group.add(back);

    const base = new THREE.Mesh(new THREE.BoxGeometry(UNIT_W, 0.25, UNIT_D), shelfMetal);
    base.position.y = 0.12;
    base.castShadow = base.receiveShadow = true;
    group.add(base);

    const boardYs = [0.62, 1.24, 1.86];
    boardYs.forEach((by) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(UNIT_W, 0.06, UNIT_D), shelfMetal);
      b.position.y = by;
      b.castShadow = b.receiveShadow = true;
      group.add(b);
    });

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.85),
      new THREE.MeshStandardMaterial({ map: signCanvas(aisle), roughness: 0.7 }),
    );
    sign.position.set(0, 2.9, 0.06);
    group.add(sign);
    const sign2 = sign.clone();
    sign2.rotation.y = Math.PI;
    sign2.position.z = -0.06;
    group.add(sign2);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), shelfMetal);
    post.position.y = 2.45;
    group.add(post);

    const items = CATALOG.filter((p) => p.aisle === aisle);
    items.forEach((p, idx) => {
      const shelfY = (boardYs[idx % boardYs.length] ?? 0.62) + 0.2;
      const laneStart = -UNIT_W / 2 + 0.8 + Math.floor(idx / boardYs.length) * 2.4;
      for (let k = 0; k < 4; k++) {
        spawnOnShelf(p, cx + laneStart + k * 0.42, shelfY, cz, 1);
        spawnOnShelf(p, cx + laneStart + k * 0.42, shelfY, cz, -1);
      }
    });
  });

  // ---------- checkout area ----------
  const kioskPos = new THREE.Vector3(0, 0, 10);
  const counterMat = new THREE.MeshStandardMaterial({ color: "#e6e8ea", roughness: 0.35, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#1d2228", roughness: 0.5, metalness: 0.4 });

  for (let i = -1; i <= 1; i++) {
    const g = new THREE.Group();
    g.position.set(i * 5, 0, 10);
    scene.add(g);
    addCollider(i * 5, 10, 2.2, 1.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), counterMat);
    body.position.y = 0.5;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const scale = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.9), darkMat);
    scale.position.set(0, 1.05, 0);
    g.add(scale);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 10), darkMat);
    stand.position.set(-0.7, 1.35, -0.3);
    g.add(stand);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.62, 0.06),
      new THREE.MeshStandardMaterial({
        color: "#0b1a2b",
        emissive: new THREE.Color(i === 0 ? "#2ea8ff" : "#123a55"),
        emissiveIntensity: i === 0 ? 1.4 : 0.5,
        roughness: 0.3,
      }),
    );
    screen.position.set(-0.7, 1.75, -0.3);
    screen.rotation.y = 0.25;
    g.add(screen);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshStandardMaterial({
        color: "#fff",
        emissive: new THREE.Color(i === 0 ? "#31d67a" : "#c8cdd3"),
        emissiveIntensity: 2,
      }),
    );
    beacon.position.set(0.8, 2.15, -0.3);
    g.add(beacon);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), darkMat);
    pole.position.set(0.8, 1.6, -0.3);
    g.add(pole);
  }
  const kioskLight = new THREE.PointLight("#39d17a", 8, 8, 2);
  kioskLight.position.set(0, 2.4, 10);
  scene.add(kioskLight);

  // entrance doors / windows
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#cfe6f2",
    transmission: 0.85,
    roughness: 0.08,
    thickness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4), glass);
  win.position.set(0, 1.9, D / 2 - 0.02);
  win.rotation.y = Math.PI;
  scene.add(win);

  // ---------- input ----------
  const keys = new Set<string>();
  let locked = false;
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (e.code === "KeyE" && locked) interact();
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onMouseMove = (e: MouseEvent) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.3, 1.3);
  };
  const onLock = () => {
    locked = document.pointerLockElement === canvas;
    cb.onLockChange(locked);
  };
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLock);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 3.2;
  let target: THREE.Mesh | null = null;
  let atKiosk = false;

  function interact() {
    if (atKiosk) {
      document.exitPointerLock();
      cb.onCheckout();
      return;
    }
    if (target) {
      const id = target.userData['productId'] as string;
      scene.remove(target);
      products.splice(products.indexOf(target), 1);
      target = null;
      cb.onPickup(id);
    }
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let raf = 0;
  const tmpBox = new THREE.Box3();

  function move(dt: number) {
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    if (keys.has("KeyW") || keys.has("ArrowUp")) dir.add(fwd);
    if (keys.has("KeyS") || keys.has("ArrowDown")) dir.sub(fwd);
    if (keys.has("KeyD") || keys.has("ArrowRight")) dir.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dir.sub(right);
    const speed = keys.has("ShiftLeft") ? 6.2 : 3.4;
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed);
    player.vel.lerp(dir, 1 - Math.pow(0.0015, dt));

    const r = 0.42;
    const tryAxis = (axis: "x" | "z", amount: number) => {
      const old = player.pos[axis];
      player.pos[axis] += amount;
      tmpBox.setFromCenterAndSize(
        new THREE.Vector3(player.pos.x, 1, player.pos.z),
        new THREE.Vector3(r * 2, 2, r * 2),
      );
      if (colliders.some((c) => c.intersectsBox(tmpBox))) player.pos[axis] = old;
    };
    tryAxis("x", player.vel.x * dt);
    tryAxis("z", player.vel.z * dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -W / 2 + 0.6, W / 2 - 0.6);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -D / 2 + 0.6, D / 2 - 0.6);

    const bob = Math.sin(clock.elapsedTime * 9) * Math.min(player.vel.length() / speed, 1) * 0.045;
    camera.position.set(player.pos.x, 1.62 + bob, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  }

  let lastPrompt: string | null = null;
  function updatePrompt() {
    atKiosk = camera.position.distanceTo(kioskPos) < 2.6;
    let text: string | null = null;
    if (atKiosk) {
      text = "Use self-checkout  [E]";
      target = null;
    } else {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hit = raycaster.intersectObjects(products, false)[0];
      target = (hit?.object as THREE.Mesh) ?? null;
      if (target) text = `Take ${byId(target.userData['productId'] as string).name}  [E]`;
    }
    if (text !== lastPrompt) {
      lastPrompt = text;
      cb.onPrompt(text);
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

  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (locked) move(dt);
    else camera.position.set(player.pos.x, 1.62, player.pos.z);
    updatePrompt();
    kioskLight.intensity = 7 + Math.sin(clock.elapsedTime * 2) * 2;
    renderer.render(scene, camera);
  }
  tick();

  return {
    lock: () => canvas.requestPointerLock(),
    dropItem: (id: string) => {
      const p = byId(id);
      const mesh = makeProductMesh(p, texCache.get(id)!);
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      mesh.position.copy(camera.position).add(fwd.multiplyScalar(1.1));
      mesh.position.y = 1.1;
      mesh.userData['productId'] = id;
      scene.add(mesh);
      products.push(mesh);
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      pmrem.dispose();
    },
  };
}

export type Game = ReturnType<typeof createGame>;
