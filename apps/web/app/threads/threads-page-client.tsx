"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "@/lib/routing/client-router";
import { KanbanHeader } from "@/components/kanban/kanban-header";
import { ThreadsBoard } from "@/components/threads/threads-board";
import { useAppStore } from "@/components/state-provider";
import { useAllWorkflowSnapshots } from "@/hooks/domains/kanban/use-all-workflow-snapshots";
import { useKanbanDisplaySettings } from "@/hooks/use-kanban-display-settings";
import { useTaskListingView } from "@/hooks/use-task-listing-view";
import { linkToTask } from "@/lib/links";
import { resolveFocusedThreadId, selectActiveThreads } from "@/lib/threads/active-threads";
import { useStableThreadOrder } from "@/lib/threads/stable-order";
import { useKanbanRouteBootstrap } from "@/src/kanban-route";

/**
 * The Threads page: every live agent conversation in the workspace, side by
 * side. It reads the workflow snapshots the board already keeps in the store,
 * so switching to this view costs no extra request and stays live on the same
 * WebSocket updates the cards do.
 */
export function ThreadsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Threads is reachable directly (bookmark, Home restore, a cross-workspace
  // link), so it owns the same workspace bootstrap the board does instead of
  // assuming the board already ran it. The requested workspace has to reach
  // the bootstrap: without it a `/threads?workspace=A` link silently loads
  // whichever workspace the cookie or saved setting last named.
  const requestedWorkspaceId = searchParams.get("workspace") ?? undefined;
  const bootstrapRoute = useMemo(
    () => ({ workspaceId: requestedWorkspaceId }),
    [requestedWorkspaceId],
  );
  useKanbanRouteBootstrap(bootstrapRoute, false);
  const { activeWorkspaceId, activeWorkflowId } = useKanbanDisplaySettings();
  const { setView } = useTaskListingView();
  const snapshots = useAppStore((state) => state.kanbanMulti.snapshots);
  const isLoading = useAppStore((state) => state.kanbanMulti.isLoading);

  useAllWorkflowSnapshots(activeWorkspaceId);

  useEffect(() => {
    setView("threads");
  }, [setView]);

  const ranked = useMemo(
    () => selectActiveThreads(snapshots, { workflowId: activeWorkflowId }),
    [snapshots, activeWorkflowId],
  );
  // Ranking decides where a column first appears; after that the slot is the
  // reader's, so replying to a thread cannot slide it across the deck.
  const threads = useStableThreadOrder(ranked);

  const handleOpenTask = useCallback((taskId: string) => router.push(linkToTask(taskId)), [router]);

  // Resolved against the rendered deck rather than trusted from the URL: the
  // requested thread may have settled between the link being offered and
  // followed, and a focus id no column matches would ring nothing.
  const focusedTaskId = resolveFocusedThreadId(threads, searchParams.get("taskId"));

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <KanbanHeader workspaceId={activeWorkspaceId ?? undefined} currentPage="threads" />
      <div className="min-h-0 flex-1">
        <ThreadsBoard
          threads={threads}
          isLoading={isLoading}
          focusedTaskId={focusedTaskId}
          onOpenTask={handleOpenTask}
        />
      </div>
    </div>
  );
}
