import { supabase } from "@/integrations/supabase/client";
import type { RemotePlayer } from "./engine";

export const PLAYER_COLORS = ["#2f5d8f", "#c8202c", "#2f7d55", "#7a45b8", "#d9822b", "#1f8fa8", "#b8437a"];

export type Presence = { id: string; name: string; color: string; items: number };

type Opts = {
  room: string;
  name: string;
  color: string;
  onPlayers: (players: RemotePlayer[]) => void;
  onRoster: (roster: Presence[]) => void;
  onStolen?: (productId: string) => void;
};

export function joinStore({ room, name, color, onPlayers, onRoster, onStolen }: Opts) {
  const id = Math.random().toString(36).slice(2, 10);
  const positions = new Map<string, RemotePlayer>();
  let itemCount = 0;
  let cartIds: string[] = [];

  const channel = supabase.channel(`store:${room}`, {
    config: { presence: { key: id }, broadcast: { self: false } },
  });

  const emit = () => onPlayers([...positions.values()]);

  channel
    .on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as RemotePlayer;
      if (!p || p.id === id) return;
      positions.set(p.id, p);
      emit();
    })
    .on("broadcast", { event: "steal" }, ({ payload }) => {
      const p = payload as { victim: string; productId: string };
      if (p?.victim === id) onStolen?.(p.productId);
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Presence>();
      const roster: Presence[] = [];
      const alive = new Set<string>();
      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          alive.add(e.id);
          roster.push(e);
        });
      });
      for (const key of [...positions.keys()]) if (!alive.has(key)) positions.delete(key);
      emit();
      onRoster(roster);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ id, name, color, items: itemCount } satisfies Presence);
      }
    });

  let last = 0;
  return {
    id,
    send(x: number, z: number, yaw: number) {
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      void channel.send({ type: "broadcast", event: "pos", payload: { id, name, color, x, z, yaw, cart: cartIds } });
    },
    setCart(ids: string[]) {
      cartIds = ids;
    },
    steal(victim: string, productId: string) {
      void channel.send({ type: "broadcast", event: "steal", payload: { victim, productId } });
    },
    setItems(n: number) {
      if (n === itemCount) return;
      itemCount = n;
      void channel.track({ id, name, color, items: n } satisfies Presence);
    },
    leave() {
      void supabase.removeChannel(channel);
    },
  };
}

export type StoreConnection = ReturnType<typeof joinStore>;

/** Live headcount for a room, without joining it as a player. */
export function watchRoomCount(room: string, onCount: (n: number) => void) {
  const channel = supabase.channel(`store:${room}`, {
    config: { presence: { key: `watch-${Math.random().toString(36).slice(2, 8)}` } },
  });
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Presence>();
      const ids = new Set<string>();
      Object.values(state).forEach((entries) =>
        entries.forEach((e) => {
          if (e?.id) ids.add(e.id);
        }),
      );
      onCount(ids.size);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
