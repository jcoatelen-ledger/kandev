import { useMemo, useRef } from "react";
import type { ActiveThread } from "./active-threads";

/**
 * Holds the deck's columns in the slots they already occupy.
 *
 * `selectActiveThreads` ranks by attention and recency, which is the right
 * order to *arrive* at but the wrong thing to re-apply live: replying to a
 * thread moves it from "needs a human" to "working" and refreshes its
 * activity, so the column the reader was typing into would slide across the
 * deck, then slide back when the turn ended. A deck whose columns move while
 * you use them is unusable, so ranking decides where a column first appears
 * and nothing after that.
 *
 * New threads append rather than sorting in, so an arriving column never
 * displaces one already on screen. A thread that leaves gives up its slot
 * outright; reserving it would mean holding a gap for work that may never
 * come back.
 */
export function applyStableThreadOrder(
  previousOrder: readonly string[],
  threads: readonly ActiveThread[],
): ActiveThread[] {
  const byTaskId = new Map(threads.map((thread) => [thread.taskId, thread]));
  const held = previousOrder
    .map((taskId) => byTaskId.get(taskId))
    .filter((thread): thread is ActiveThread => thread !== undefined);

  const heldIds = new Set(held.map((thread) => thread.taskId));
  const arrived = threads.filter((thread) => !heldIds.has(thread.taskId));
  return [...held, ...arrived];
}

/**
 * Applies {@link applyStableThreadOrder} across renders. Safe to derive during
 * render because the ordering is idempotent: feeding it an already-stable
 * order returns that order unchanged.
 */
export function useStableThreadOrder(threads: ActiveThread[]): ActiveThread[] {
  const orderRef = useRef<string[]>([]);
  const ordered = useMemo(
    () => applyStableThreadOrder(orderRef.current, threads),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ref is the
    // carried-over order, deliberately read without re-running on its change.
    [threads],
  );
  orderRef.current = ordered.map((thread) => thread.taskId);
  return ordered;
}
