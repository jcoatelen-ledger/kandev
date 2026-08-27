"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "@/lib/routing/client-router";
import { KanbanHeader } from "@/components/kanban/kanban-header";
import { ThreadsBoard } from "@/components/threads/threads-board";
import { useAppStore } from "@/components/state-provider";
import { useAllWorkflowSnapshots } from "@/hooks/domains/kanban/use-all-workflow-snapshots";
import { useKanbanDisplaySettings } from "@/hooks/use-kanban-display-settings";
import { useTaskListingView } from "@/hooks/use-task-listing-view";
import { linkToTask } from "@/lib/links";
import { selectActiveThreads } from "@/lib/threads/active-threads";
import { useKanbanRouteBootstrap } from "@/src/kanban-route";

/** Stable identity so the bootstrap effect does not refire on every render. */
const EMPTY_ROUTE = {};

/**
 * The Threads page: every live agent conversation in the workspace, side by
 * side. It reads the workflow snapshots the board already keeps in the store,
 * so switching to this view costs no extra request and stays live on the same
 * WebSocket updates the cards do.
 */
export function ThreadsPageClient() {
  const router = useRouter();
  // Threads is reachable directly (bookmark, Home restore), so it owns the same
  // workspace/workflow bootstrap the board does instead of assuming the board
  // already ran it.
  useKanbanRouteBootstrap(EMPTY_ROUTE, false);
  const { activeWorkspaceId, activeWorkflowId } = useKanbanDisplaySettings();
  const { setView } = useTaskListingView();
  const snapshots = useAppStore((state) => state.kanbanMulti.snapshots);
  const isLoading = useAppStore((state) => state.kanbanMulti.isLoading);

  useAllWorkflowSnapshots(activeWorkspaceId);

  useEffect(() => {
    setView("threads");
  }, [setView]);

  const threads = useMemo(
    () => selectActiveThreads(snapshots, { workflowId: activeWorkflowId }),
    [snapshots, activeWorkflowId],
  );

  const handleOpenTask = useCallback((taskId: string) => router.push(linkToTask(taskId)), [router]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <KanbanHeader workspaceId={activeWorkspaceId ?? undefined} currentPage="threads" />
      <div className="min-h-0 flex-1">
        <ThreadsBoard threads={threads} isLoading={isLoading} onOpenTask={handleOpenTask} />
      </div>
    </div>
  );
}
