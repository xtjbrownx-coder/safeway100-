import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, byId } from "@/game/catalog";
import type { Game } from "@/game/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cart & Aisle — 3D Grocery Shopping Simulator" },
      {
        name: "description",
        content:
          "Walk a photoreal 3D store in first person, find every item on your shopping list, and ring it up at the self-checkout.",
      },
      { property: "og:title", content: "Cart & Aisle — 3D Grocery Shopping Simulator" },
      {
        property: "og:description",
        content: "Find the exact items on your list, load your cart, and scan them at the self-checkout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ListEntry = { id: string; qty: number };
type Phase = "intro" | "shopping" | "checkout" | "receipt";

function buildList(count: number): ListEntry[] {
  const pool = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, count);
  return pool.map((p) => ({ id: p.id, qty: Math.random() < 0.25 ? 2 : 1 }));
}

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [locked, setLocked] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [list] = useState<ListEntry[]>(() => buildList(5));
  const [cart, setCart] = useState<string[]>([]);
  const [scanned, setScanned] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;

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

  const start = useCallback(() => {
    setPhase("shopping");
    gameRef.current?.lock();
  }, []);

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
    return { rows, extras, correct, score: Math.round((correct / list.length) * 100) };
  }, [scanned, list]);

  const timeStr = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <h1 className="sr-only">Cart & Aisle — 3D grocery shopping simulator</h1>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      {phase === "shopping" && (
        <>
          <div className="pointer-events-none absolute left-6 top-6 w-72 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-slate-100 shadow-2xl backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Shopping list</h2>
              <span className="font-mono text-xs text-slate-400">{timeStr}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {list.map((e) => {
                const have = counts.get(e.id) ?? 0;
                const done = have >= e.qty;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={done ? "text-emerald-300 line-through" : "text-slate-200"}>
                      {byId(e.id).name}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {Math.min(have, e.qty)}/{e.qty}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-400">
              Cart: {cart.length} item{cart.length === 1 ? "" : "s"} · head to the green self-checkout
            </p>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
          </div>

          {prompt && locked && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/80 px-4 py-2 text-sm font-medium text-slate-100 backdrop-blur">
              {prompt}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-slate-300/70">
            WASD move · Shift run · Mouse look · E interact
          </div>

          {!locked && (
            <button
              onClick={() => gameRef.current?.lock()}
              className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-lg font-medium text-slate-100 backdrop-blur-sm"
            >
              Click to resume shopping
            </button>
          )}
        </>
      )}

      {/* Intro */}
      {phase === "intro" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-950/90 to-slate-900/95 px-6 backdrop-blur">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-slate-100 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Self-checkout simulator</p>
            <h2 className="mt-2 text-3xl font-semibold">Cart &amp; Aisle</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Find the exact items on your list — no substitutes — then take them to the glowing self-checkout,
              scan every item, and pay. Grab the wrong thing and your score drops.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-slate-200">
              {list.map((e) => (
                <li key={e.id}>
                  • {byId(e.id).name} <span className="text-slate-400">×{e.qty}</span>{" "}
                  <span className="text-slate-500">— {byId(e.id).aisle}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={start}
              className="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Enter the store
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">WASD to move · mouse to look · E to interact</p>
          </div>
        </div>
      )}

      {/* Self-checkout */}
      {phase === "checkout" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-400/20 bg-slate-900/90 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Self-Checkout · Lane 3</h2>
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
                      <span className="text-xs uppercase tracking-widest text-emerald-400">Scanned</span>
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
                            gameRef.current?.dropItem(id);
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
            <p className="text-center text-xs uppercase tracking-[0.35em]">Cart &amp; Aisle Market</p>
            <p className="mt-1 text-center text-xs text-slate-500">Self-checkout · Lane 3 · {timeStr}</p>
            <div className="my-4 border-t border-dashed border-slate-400" />
            {result.rows.map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>
                  {r.got === r.qty ? "✓" : "✗"} {byId(r.id).name} ×{r.qty}
                </span>
                <span>{r.got === r.qty ? `$${(byId(r.id).price * r.qty).toFixed(2)}` : "MISSING"}</span>
              </div>
            ))}
            {result.extras.map((e) => (
              <div key={`x-${e.id}`} className="flex justify-between text-red-700">
                <span>! Not on list: {byId(e.id).name} ×{e.qty}</span>
                <span>${(byId(e.id).price * e.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="my-4 border-t border-dashed border-slate-400" />
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <p className="mt-4 text-center text-lg font-bold">
              Accuracy {result.score}% · {result.correct}/{list.length}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-sans text-sm font-semibold text-slate-50"
            >
              New shopping trip
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
