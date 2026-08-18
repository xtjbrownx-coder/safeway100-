import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, byId, realisticQty } from "@/game/catalog";
import type { Game, RemotePlayer } from "@/game/engine";
import { PLAYER_COLORS, type Presence, type StoreConnection } from "@/game/multiplayer";
import {
  levelPoints,
  runScore,
  fetchTopRuns,
  fetchHallOfFame,
  submitRun,
  type RunEntry,
  type HallEntry,
} from "@/game/leaderboard";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cart & Aisle — 10-Level 3D Grocery Store Speedrun" },
      {
        name: "description",
        content:
          "Race through 10 shopping levels in a 3D supermarket, scan every item at self-checkout, and put your total time on the in-store world leaderboard.",
      },
      { property: "og:title", content: "Cart & Aisle — 10-Level 3D Grocery Store Speedrun" },
      {
        property: "og:description",
        content: "Ten levels, one stopwatch. Beat the fastest shopper on the world leaderboard at the back of the store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ListEntry = { id: string; qty: number };
type Phase = "lobby" | "shopping" | "checkout" | "receipt" | "finish";

const TOTAL_LEVELS = 10;
const listSizeFor = (level: number) => 3 + Math.floor((level - 1) * 0.7);

function buildList(count: number): ListEntry[] {
  const pool = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, count);
  return pool.map((p) => ({ id: p.id, qty: Math.random() < 0.3 ? 2 : 1 }));
}

const randomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(1);
  const [accuracies, setAccuracies] = useState<number[]>([]);
  const [roster, setRoster] = useState<Presence[]>([]);
  const [name, setName] = useState("Shopper");
  const [mode, setMode] = useState<"public" | "private">("public");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const [board, setBoard] = useState<RunEntry[]>([]);
  const [finalTime, setFinalTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);
  const [cartHeld, setCartHeld] = useState(true);
  const [carrying, setCarrying] = useState<string | null>(null);

  useEffect(() => setList(buildList(listSizeFor(1))), []);

  const refreshBoard = useCallback(async () => {
    const rows = await fetchTopRuns(10);
    setBoard(rows);
    gameRef.current?.setLeaderboard(rows);
  }, []);

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
        onSteal: (victimId, productId) => netRef.current?.steal(victimId, productId),
        onCartModeChange: (attached, held) => {
          setCartHeld(attached);
          setCarrying(held);
        },
      });
      gameRef.current = game;
      void refreshBoard();
    })();
    return () => {
      alive = false;
      game?.dispose();
    };
  }, [refreshBoard]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    netRef.current?.setItems(cart.length);
    netRef.current?.setCart(cart);
  }, [cart]);

  useEffect(() => () => netRef.current?.leave(), []);

  const connect = useCallback(async (roomId: string, playerName: string) => {
    const { joinStore } = await import("@/game/multiplayer");
    netRef.current?.leave();
    netRef.current = joinStore({
      room: roomId,
      name: playerName,
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]!,
      onPlayers: (players: RemotePlayer[]) => gameRef.current?.setRemotePlayers(players),
      onRoster: setRoster,
      onStolen: (productId: string) => {
        gameRef.current?.removeItem(productId);
        setCart((c) => {
          const i = c.indexOf(productId);
          if (i < 0) return c;
          return c.filter((_, j) => j !== i);
        });
      },
    });
  }, []);

  const startRun = useCallback(async () => {
    const playerName = name.trim() || "Shopper";
    const roomId = mode === "public" ? "public-lobby" : code.trim().toUpperCase() || randomCode();
    setCode(roomId);
    setRoom(roomId);
    setLevel(1);
    setAccuracies([]);
    setCart([]);
    setScanned([]);
    setSeconds(0);
    setFinalTime(0);
    setFinalScore(0);
    setFinalAccuracy(0);
    setList(buildList(listSizeFor(1)));
    setPhase("shopping");
    setRunning(true);
    gameRef.current?.clearCart();
    gameRef.current?.lock();
    await connect(roomId, playerName);
  }, [name, mode, code, connect]);

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

  const payAndFinishLevel = useCallback(() => {
    const score = result.score;
    setAccuracies((a) => [...a, score]);
    if (level >= TOTAL_LEVELS) {
      setRunning(false);
      setFinalTime(seconds);
      setPhase("finish");
      const all = [...accuracies, score];
      const avg = Math.round(all.reduce((s, v) => s + v, 0) / TOTAL_LEVELS);
      const total = runScore(all);
      setFinalAccuracy(avg);
      setFinalScore(total);
      void (async () => {
        await submitRun({ name: name.trim() || "Shopper", total_seconds: seconds, accuracy: avg, score: total });
        await refreshBoard();
      })();
    } else {
      setPhase("receipt");
    }
  }, [result.score, level, seconds, accuracies, name, refreshBoard]);


  const nextLevel = useCallback(() => {
    const next = level + 1;
    setLevel(next);
    setList(buildList(listSizeFor(next)));
    setCart([]);
    setScanned([]);
    gameRef.current?.clearCart();
    setPhase("shopping");
    gameRef.current?.lock();
  }, [level]);

  const replayLevel = useCallback(() => {
    setCart([]);
    setScanned([]);
    gameRef.current?.clearCart();
    setPhase("shopping");
    gameRef.current?.lock();
  }, []);

  const restartRun = useCallback(() => {
    setLevel(1);
    setAccuracies([]);
    setCart([]);
    setScanned([]);
    setSeconds(0);
    setRunning(true);
    setList(buildList(listSizeFor(1)));
    gameRef.current?.clearCart();
    setPhase("shopping");
    gameRef.current?.lock();
  }, []);

  const backToLobby = useCallback(() => {
    setRunning(false);
    setSeconds(0);
    setLevel(1);
    setAccuracies([]);
    setCart([]);
    setScanned([]);
    gameRef.current?.clearCart();
    setList(buildList(listSizeFor(1)));
    setPhase("lobby");
  }, []);

  const timeStr = fmt(seconds);
  const done = list.filter((e) => (counts.get(e.id) ?? 0) >= e.qty).length;
  const best = board[0];
  const rank = (board.filter((b) => b.score > finalScore).length || 0) + 1;
  const liveScore = runScore(accuracies) + (phase === "checkout" ? levelPoints(result.score) : 0);


  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <h1 className="sr-only">Cart &amp; Aisle — 10-level 3D grocery store speedrun</h1>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Compact HUD */}
      {phase === "shopping" && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 w-52 rounded-lg border border-white/10 bg-slate-950/65 p-2.5 text-slate-100 shadow-xl backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                Level {level}/{TOTAL_LEVELS}
              </span>
              <span className="font-mono text-[11px] text-amber-300">{timeStr}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Projected score</span>
              <span className="font-mono text-[11px] text-emerald-300">{liveScore} pts</span>
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
              {done}/{list.length} found · Cart {cart.length} · {roster.length || 1} online
            </p>
            <p className="text-[10px] text-slate-400">
              {cartHeld ? (
                <span className="text-slate-300">Pushing cart · [F] to let go</span>
              ) : (
                <span className="text-amber-300">
                  Cart parked · {carrying ? `carrying ${byId(carrying).name}` : "hands free (1 item max)"}
                </span>
              )}
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
            WASD · Shift run · Mouse look · E interact · F drop cart · Click/Q throw
          </div>

          {!locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-sm">
              <button
                onClick={() => gameRef.current?.lock()}
                className="rounded-lg bg-emerald-400 px-6 py-3 text-base font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Resume shopping
              </button>
              <div className="flex gap-2">
                <button
                  onClick={replayLevel}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                >
                  Replay level {level}
                </button>
                <button
                  onClick={restartRun}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                >
                  Restart run
                </button>
                <button
                  onClick={backToLobby}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  Quit to lobby
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lobby */}
      {phase === "lobby" && list.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-950/92 to-slate-900/95 px-6 backdrop-blur">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900/85 p-7 text-slate-100 shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">10-level speedrun</p>
            <h2 className="mt-1 text-3xl font-semibold">Cart &amp; Aisle</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Ten shopping levels, one stopwatch. Grab the exact items on each list and scan them at self-checkout.
              Every level scores on accuracy alone: 99–100% = 100 pts, 80–98% = 80 pts, 60–79% = 50 pts, anything
              lower = 1 pt. A perfect run is 1000 points and tops the world leaderboard at the back of the store.
            </p>


            <div className="mt-4 rounded-lg border border-white/10 bg-slate-800/50 p-3 text-xs">
              <span className="text-slate-400">Top score</span>{" "}
              <span className="font-mono text-amber-300">
                {best ? `${best.score} pts — ${best.name} (${fmt(best.total_seconds)})` : "unclaimed"}
              </span>
            </div>

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
                <span className="text-[11px] text-slate-400">Race everyone in one store</span>
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

            <button
              onClick={startRun}
              className="mt-5 w-full rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Start the 10-level run
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              WASD move · mouse look · E interact · F let go of cart · click/Q throw items
            </p>
          </div>
        </div>
      )}

      {/* Self-checkout */}
      {phase === "checkout" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-400/20 bg-slate-900/90 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Self-Checkout <span className="text-xs text-slate-400">· level {level}/{TOTAL_LEVELS}</span>
              </h2>
              <span className="font-mono text-sm text-amber-300">{timeStr}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              The clock keeps running — scan each item, or return anything you picked up by mistake.
            </p>

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
                onClick={replayLevel}
                className="rounded-lg border border-amber-300/30 px-4 py-2.5 text-sm text-amber-200 hover:bg-amber-300/10"
              >
                Replay level
              </button>
              <button
                onClick={payAndFinishLevel}
                disabled={cart.length === 0 || scanned.length !== cart.length}
                className="flex-1 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-30"
              >
                Pay ${total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level receipt */}
      {phase === "receipt" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-6 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-[#faf7f0] p-7 font-mono text-sm text-slate-800 shadow-2xl">
            <p className="text-center text-[11px] uppercase tracking-[0.35em]">Cart &amp; Aisle Market</p>
            <p className="mt-1 text-center text-[11px] text-slate-500">
              {mode === "public" ? "Public server" : `Private room ${room}`} · level {level} of {TOTAL_LEVELS}
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
                <span>
                  ! extra {byId(e.id).name} ×{e.qty}
                </span>
                <span>${(byId(e.id).price * e.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="my-4 border-t border-dashed border-slate-400" />
            <div className="flex justify-between font-bold">
              <span>Total paid</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Run clock</span>
              <span>{timeStr} (running)</span>
            </div>
            <div className="flex justify-between">
              <span>Accuracy</span>
              <span>{result.score}%</span>
            </div>
            <button
              onClick={nextLevel}
              className="mt-6 w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-slate-50 transition hover:bg-slate-800"
            >
              Start level {level + 1}
            </button>
            <div className="mt-2 flex gap-2">
              <button
                onClick={replayLevel}
                className="flex-1 rounded-lg border border-slate-400 px-4 py-2 text-xs text-slate-700 hover:bg-slate-200"
              >
                Replay level {level}
              </button>
              <button
                onClick={restartRun}
                className="flex-1 rounded-lg border border-slate-400 px-4 py-2 text-xs text-slate-700 hover:bg-slate-200"
              >
                Restart run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final results + world leaderboard */}
      {phase === "finish" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 px-6 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-amber-300/25 bg-slate-900/90 p-7 text-slate-100 shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Run complete</p>
            <h2 className="mt-1 text-3xl font-semibold">All {TOTAL_LEVELS} levels done</h2>
            <p className="mt-3 font-mono text-5xl text-emerald-300">{finalScore} pts</p>
            <p className="mt-1 text-xs text-slate-400">
              {fmt(finalTime)} · average accuracy {finalAccuracy}% · out of {TOTAL_LEVELS * 100} possible points
            </p>


            <p className="mt-2 text-sm text-slate-300">
              {best && finalScore >= best.score
                ? "New world record — highest score in the store."
                : best
                  ? `${best.score - finalScore} pts behind ${best.name}'s ${best.score}.`
                  : "Your score is the first on the board."}
              {` You rank #${rank} worldwide.`}
            </p>

            <div className="mt-5 rounded-xl border border-white/10 bg-slate-800/50 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">World leaderboard · top scores</p>
              <ol className="mt-2 space-y-1 text-sm">
                {board.length === 0 && <li className="text-slate-400">No runs yet.</li>}
                {board.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="flex justify-between">
                    <span className={i === 0 ? "text-amber-300" : "text-slate-200"}>
                      {i + 1}. {b.name} <span className="text-[10px] text-slate-500">{fmt(b.total_seconds)}</span>
                    </span>
                    <span className="font-mono text-emerald-300">{b.score} pts</span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              onClick={startRun}
              className="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Run it again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
