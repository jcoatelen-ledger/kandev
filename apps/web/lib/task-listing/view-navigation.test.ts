import { describe, expect, it } from "vitest";
import { linkToThreads } from "@/lib/links";
import { resolveTaskListingNavigation } from "./view-navigation";

const WORKSPACE_ID = "workspace-1";

describe("resolveTaskListingNavigation", () => {
  it("sends Threads to its own route from the board", () => {
    expect(
      resolveTaskListingNavigation({
        view: "threads",
        currentPage: "kanban",
        workspaceId: WORKSPACE_ID,
      }),
    ).toEqual({ view: "threads", href: "/threads?workspace=workspace-1" });
  });

  it("stays put when the target view already owns this page", () => {
    expect(resolveTaskListingNavigation({ view: "threads", currentPage: "threads" })).toEqual({
      view: "threads",
      href: null,
    });
    expect(resolveTaskListingNavigation({ view: "list", currentPage: "tasks" })).toEqual({
      view: "list",
      href: null,
    });
    expect(resolveTaskListingNavigation({ view: "kanban", currentPage: "kanban" })).toEqual({
      view: "kanban",
      href: null,
    });
  });

  it("routes both board views back to the task overview", () => {
    expect(
      resolveTaskListingNavigation({
        view: "pipeline",
        currentPage: "threads",
        workspaceId: WORKSPACE_ID,
        workflowId: "workflow-1",
      }),
    ).toEqual({
      view: "pipeline",
      href: "/?home=overview&workspaceId=workspace-1&workflowId=workflow-1",
    });
  });

  it("refuses Pipeline where it has no layout to render", () => {
    expect(
      resolveTaskListingNavigation({
        view: "pipeline",
        currentPage: "kanban",
        allowPipeline: false,
      }),
    ).toBeNull();
  });

  it("ignores a value that is not a listing view", () => {
    expect(resolveTaskListingNavigation({ view: "", currentPage: "kanban" })).toBeNull();
    expect(resolveTaskListingNavigation({ view: "office", currentPage: "kanban" })).toBeNull();
  });
});

describe("linkToThreads", () => {
  it("keeps the deck link plain when no task is focused", () => {
    expect(linkToThreads()).toBe("/threads");
    expect(linkToThreads(WORKSPACE_ID)).toBe("/threads?workspace=workspace-1");
  });

  it("carries the task a caller wants the deck to scroll to", () => {
    expect(linkToThreads(undefined, "task-1")).toBe("/threads?taskId=task-1");
    expect(linkToThreads(WORKSPACE_ID, "task-1")).toBe(
      "/threads?workspace=workspace-1&taskId=task-1",
    );
  });

  it("escapes a task id rather than splicing it into the query raw", () => {
    expect(linkToThreads(undefined, "a b&c")).toBe("/threads?taskId=a+b%26c");
  });
});
