"use client";

import { useAppStore } from "@/components/state-provider";
import { isActiveThreadSession } from "@/lib/threads/active-threads";

/**
 * Whether this session currently has a column in the Threads deck.
 *
 * Reads the already-loaded task sessions rather than fetching: every surface
 * that renders a chat panel has hydrated them (session tabs, the task sidebar),
 * and a status-row control must not be the thing that triggers a request. An
 * unloaded task therefore reports false, which hides the affordance rather than
 * offering a jump to a column that may not exist.
 */
export function useIsDeckThread(taskId: string | null, sessionId: string | null): boolean {
  return useAppStore((state) => {
    if (!taskId || !sessionId) return false;
    const session = state.taskSessionsByTask.itemsByTaskId[taskId]?.find(
      (candidate) => candidate.id === sessionId,
    );
    if (!session) return false;
    return isActiveThreadSession({
      isPrimary: Boolean(session.is_primary),
      state: session.state,
      pendingAction: session.pending_action,
    });
  });
}
