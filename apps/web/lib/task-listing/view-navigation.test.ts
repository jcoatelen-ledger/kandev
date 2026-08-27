import { describe, expect, it } from "vitest";
import { resolveTaskListingNavigation } from "./view-navigation";

describe("resolveTaskListingNavigation", () => {
  it("sends Threads to its own route from the board", () => {
    expect(
      resolveTaskListingNavigation({
        view: "threads",
        currentPage: "kanban",
        workspaceId: "workspace-1",
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
        workspaceId: "workspace-1",
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
