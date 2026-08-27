import { linkToTaskOverview, linkToTasks, linkToThreads } from "@/lib/links";
import { parseTaskListingView, type TaskListingView } from "./view-preference";

/** Which top-level page the user is looking at when they pick a view. */
export type TaskListingPage = "kanban" | "tasks" | "threads";

type TaskListingNavigationInput = {
  view: string;
  currentPage: TaskListingPage;
  workspaceId?: string;
  workflowId?: string | null;
  /** False on phones, where Pipeline has no layout and falls back to Kanban. */
  allowPipeline?: boolean;
};

export type TaskListingNavigation = {
  view: TaskListingView;
  /** Null when the current page already renders the chosen view. */
  href: string | null;
};

/** The page each view renders on, so the same switch drives every surface. */
const VIEW_PAGE: Record<TaskListingView, TaskListingPage> = {
  kanban: "kanban",
  pipeline: "kanban",
  list: "tasks",
  threads: "threads",
};

function hrefFor(
  view: TaskListingView,
  workspaceId: string | undefined,
  workflowId: string | null | undefined,
): string {
  if (view === "list") return linkToTasks(workspaceId);
  if (view === "threads") return linkToThreads(workspaceId);
  return linkToTaskOverview({ workspaceId, workflowId: workflowId ?? undefined });
}

/**
 * Resolves a view-toggle pick into the view to remember and the page to
 * navigate to. Shared by the desktop topbar and the phone menu sheet so the two
 * cannot drift apart on where a view lives.
 *
 * Returns null when the pick is not a view this surface can honour, and the
 * caller should do nothing at all.
 */
export function resolveTaskListingNavigation({
  view,
  currentPage,
  workspaceId,
  workflowId,
  allowPipeline = true,
}: TaskListingNavigationInput): TaskListingNavigation | null {
  const parsed = parseTaskListingView(JSON.stringify(view));
  if (!parsed) return null;
  if (parsed === "pipeline" && !allowPipeline) return null;
  return {
    view: parsed,
    href: VIEW_PAGE[parsed] === currentPage ? null : hrefFor(parsed, workspaceId, workflowId),
  };
}
