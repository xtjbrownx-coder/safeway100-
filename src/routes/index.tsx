import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, byId } from "@/game/catalog";
import type { Game, RemotePlayer } from "@/game/engine";
import { PLAYER_COLORS, type Presence, type StoreConnection } from "@/game/multiplayer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cart & Aisle — Online 3D Grocery Store Simulator" },
      {
        name: "description",
        content:
          "Shop a modern 3D supermarket in first person with a real cart, metal aisles and live shoppers. Play the public server or a private game with friends.",
      },
      { property: "og:title", content: "Cart & Aisle — Online 3D Grocery Store Simulator" },
      {
        property: "og:description",
        content: "Push a cart through metal aisles, find every item on your list, and ring it up at self-checkout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ListEntry = { id: string; qty: number };
type Phase = "lobby" | "shopping" | "checkout" | "receipt";

function buildList(count: number): ListEntry[] {
  const pool = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, count);
  return pool.map((p) => ({ id: p.id, qty: Math.random() < 0.3 ? 2 : 1 }));
}

const randomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const netRef = useRef<StoreConnection | null>(null);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [locked, setLocked] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [list, setList] = useState<ListEntry[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [scanned, setScanned] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roster, setRoster] = useState<Presence[]>([]);
  const [name, setName] = useState("Shopper");
  const [mode, setMode] = useState<"public" | "private">("public");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<string | null>(null);

  useEffect(() => setList(buildList(5)), []);

  useEffect(() => {
    let alive = true;
    let game: Game | null = null;
    (async () => {
      const { createGame } = await import("@/game/engine");
      if (!alive || !canvasRef.current) return;
      game = createGame(canvasRef.current, {
        onPrompt: setPrompt,
        onPickup: (id) => setCart((c) => [...c, id]),
        onCheckout: () => setPhase("checkout"),
        onLockChange: setLocked,
        onMove: (x, z, yaw) => netRef.current?.send(x, z, yaw),
      });
      gameRef.current = game;
    })();
    return () => {
      alive = false;
      game?.dispose();
    };
  }, []);

  useEffect(() => {
    if (phase !== "shopping" && phase !== "checkout") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    netRef.current?.setItems(cart.length);
  }, [cart.length]);

  useEffect(() => () => netRef.current?.leave(), []);

  const connect = useCallback(
    async (roomId: string, playerName: string) => {
      const { joinStore } = await import("@/game/multiplayer");
      netRef.current?.leave();
      netRef.current = joinStore({
        room: roomId,
        name: playerName,
        color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]!,
        onPlayers: (players: RemotePlayer[]) => gameRef.current?.setRemotePlayers(players),
        onRoster: setRoster,
      });
    },
    [],
  );

  const enterStore = useCallback(async () => {
    const playerName = name.trim() || "Shopper";
    const roomId = mode === "public" ? "public-lobby" : (code.trim().toUpperCase() || randomCode());
    setCode(roomId);
    setRoom(roomId);
    setList(buildList(mode === "public" ? 5 : 6));
    setPhase("shopping");
    gameRef.current?.lock();
    await connect(roomId, playerName);
  }, [name, mode, code, connect]);

  const nextTrip = useCallback(() => {
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    const size = mode === "public" ? Math.min(5 + nextStreak * 2, 14) : 6;
    setList(buildList(size));
    setCart([]);
    setScanned([]);
    setSeconds(0);
    gameRef.current?.clearCart();
    setPhase("shopping");
    gameRef.current?.lock();
  }, [streak, mode]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    return m;
  }, [cart]);

  const total = useMemo(() => scanned.reduce((s, id) => s + byId(id).price, 0), [scanned]);

  const result = useMemo(() => {
    const sc = new Map<string, number>();
    scanned.forEach((id) => sc.set(id, (sc.get(id) ?? 0) + 1));
    const rows = list.map((e) => ({ ...e, got: sc.get(e.id) ?? 0 }));
    const extras: ListEntry[] = [];
    sc.forEach((qty, id) => {
      const need = list.find((e) => e.id === id)?.qty ?? 0;
      if (qty > need) extras.push({ id, qty: qty - need });
    });
    const correct = rows.filter((r) => r.got === r.qty).length;
    return { rows, extras, correct, score: Math.round((correct / Math.max(list.length, 1)) * 100) };
  }, [scanned, list]);

  const timeStr = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const done = list.filter((e) => (counts.get(e.id) ?? 0) >= e.qty).length;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <h1 className="sr-only">Cart &amp; Aisle — online 3D grocery store simulator</h1>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Compact HUD */}
      {phase === "shopping" && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 w-52 rounded-lg border border-white/10 bg-slate-950/65 p-2.5 text-slate-100 shadow-xl backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">List</span>
              <span className="font-mono text-[10px] text-slate-400">
                {done}/{list.length} · {timeStr}
              </span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {list.map((e) => {
                const have = counts.get(e.id) ?? 0;
                const ok = have >= e.qty;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                    <span className={ok ? "text-emerald-300 line-through" : "text-slate-200"}>{byId(e.id).name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {Math.min(have, e.qty)}/{e.qty}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 border-t border-white/10 pt-1 text-[10px] text-slate-400">
              Cart {cart.length} · {mode === "public" ? "Public server" : `Private ${room}`} · {roster.length || 1} online
            </p>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/85 shadow-[0_0_6px_rgba(0,0,0,0.9)]" />
          </div>

          {prompt && locked && (
            <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur">
              {prompt}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.22em] text-slate-200/60">
            WASD · Shift run · Mouse look · E interact
          </div>

          {!locked && (
            <button
              onClick={() => gameRef.current?.lock()}
              className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-base font-medium text-slate-100 backdrop-blur-sm"
            >
              Click to resume shopping
            </button>
          )}
        </>
      )}

      {/* Lobby */}
      {phase === "lobby" && list.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-950/92 to-slate-900/95 px-6 backdrop-blur">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900/85 p-7 text-slate-100 shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">Online store simulator</p>
            <h2 className="mt-1 text-3xl font-semibold">Cart &amp; Aisle</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Push your cart through the aisles, grab the exact items on your list, then scan everything at
              self-checkout. Other shoppers are in the store with you.
            </p>

            <label className="mt-5 block text-[11px] uppercase tracking-[0.16em] text-slate-400">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={14}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("public")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  mode === "public"
                    ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="block font-semibold">Public server</span>
                <span className="text-[11px] text-slate-400">Everyone in one store · lists get harder</span>
              </button>
              <button
                onClick={() => setMode("private")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  mode === "private"
                    ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="block font-semibold">Private game</span>
                <span className="text-[11px] text-slate-400">Invite-only room code</span>
              </button>
            </div>

            {mode === "private" && (
              <div className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Room code"
                  maxLength={6}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 font-mono text-sm tracking-[0.2em] outline-none focus:border-emerald-400/60"
                />
                <button
                  onClick={() => setCode(randomCode())}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  Generate
                </button>
              </div>
            )}

            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-slate-300">
              {list.map((e) => (
                <li key={e.id}>
                  • {byId(e.id).name} <span className="text-slate-500">×{e.qty}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={enterStore}
              className="mt-5 w-full rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Enter the store
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">WASD to move · mouse to look · E to interact</p>
          </div>
        </div>
      )}

      {/* Self-checkout */}
      {phase === "checkout" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-400/20 bg-slate-900/90 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Self-Checkout</h2>
              <span className="font-mono text-sm text-emerald-300">${total.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Scan each item, or return anything you picked up by mistake.</p>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {cart.length === 0 && <p className="text-sm text-slate-400">Your cart is empty.</p>}
              {cart.map((id, i) => {
                const isScanned = i < scanned.length;
                return (
                  <div
                    key={`${id}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  >
                    <span className={isScanned ? "text-emerald-300" : ""}>
                      {byId(id).name} <span className="text-slate-500">${byId(id).price.toFixed(2)}</span>
                    </span>
                    {isScanned ? (
                      <span className="text-[10px] uppercase tracking-widest text-emerald-400">Scanned</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setScanned((s) => [...s, cart[s.length]!])}
                          disabled={i !== scanned.length}
                          className="rounded-md bg-emerald-400 px-3 py-1 text-xs font-semibold text-slate-950 disabled:opacity-30"
                        >
                          Scan
                        </button>
                        <button
                          onClick={() => {
                            gameRef.current?.returnItem(id);
                            setCart((c) => c.filter((_, j) => j !== i));
                          }}
                          className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
                        >
                          Return
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setPhase("shopping");
                  gameRef.current?.lock();
                }}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
              >
                Back to shopping
              </button>
              <button
                onClick={() => setPhase("receipt")}
                disabled={cart.length === 0 || scanned.length !== cart.length}
                className="flex-1 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-30"
              >
                Pay ${total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt */}
      {phase === "receipt" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-6 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-[#faf7f0] p-7 font-mono text-sm text-slate-800 shadow-2xl">
            <p className="text-center text-[11px] uppercase tracking-[0.35em]">Cart &amp; Aisle Market</p>
            <p className="mt-1 text-center text-[11px] text-slate-500">
              {mode === "public" ? "Public server" : `Private room ${room}`} · trip {streak + 1}
            </p>
            <div className="my-4 border-t border-dashed border-slate-400" />
            {result.rows.map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>
                  {r.got === r.qty ? "✓" : "✗"} {byId(r.id).name} ×{r.qty}
                </span>
                <span>{r.got === r.qty ? `$${(byId(r.id).price * r.qty).toFixed(2)}` : "missing"}</span>
              </div>
            ))}
            {result.extras.map((e) => (
              <div key={`x-${e.id}`} className="flex justify-between text-rose-700">
                <span>! extra {byId(e.id).name} ×{e.qty}</span>
                <span>${(byId(e.id).price * e.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="my-4 border-t border-dashed border-slate-400" />
            <div className="flex justify-between font-bold">
              <span>Total paid</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Time</span>
              <span>{timeStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Accuracy</span>
              <span>{result.score}%</span>
            </div>
            <button
              onClick={nextTrip}
              className="mt-6 w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-slate-50 transition hover:bg-slate-800"
            >
              {mode === "public" ? "Next trip (harder list)" : "Shop again"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
