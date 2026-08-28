import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const bootstrapMock = vi.hoisted(() => vi.fn());
const searchMock = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/routing/client-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchMock.value),
}));
vi.mock("@/src/kanban-route", () => ({ useKanbanRouteBootstrap: bootstrapMock }));
vi.mock("@/components/kanban/kanban-header", () => ({ KanbanHeader: () => null }));
vi.mock("@/components/threads/threads-board", () => ({ ThreadsBoard: () => null }));
vi.mock("@/hooks/domains/kanban/use-all-workflow-snapshots", () => ({
  useAllWorkflowSnapshots: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/hooks/use-kanban-display-settings", () => ({
  useKanbanDisplaySettings: () => ({
    activeWorkspaceId: "stored-workspace",
    activeWorkflowId: null,
  }),
}));
vi.mock("@/hooks/use-task-listing-view", () => ({
  useTaskListingView: () => ({ setView: vi.fn() }),
}));
vi.mock("@/components/state-provider", () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ kanbanMulti: { snapshots: {}, isLoading: false } }),
}));

import { ThreadsPageClient } from "./threads-page-client";

afterEach(() => {
  cleanup();
  bootstrapMock.mockReset();
  searchMock.value = "";
});

describe("ThreadsPageClient — workspace deep links", () => {
  it("bootstraps the workspace the link asked for, not the stored one", () => {
    searchMock.value = "workspace=requested-workspace";

    render(<ThreadsPageClient />);

    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "requested-workspace" }),
      false,
    );
  });

  it("leaves the workspace unset when the link names none", () => {
    render(<ThreadsPageClient />);

    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: undefined }),
      false,
    );
  });

  it("keeps one bootstrap route identity across re-renders of the same link", () => {
    searchMock.value = "workspace=requested-workspace";
    const { rerender } = render(<ThreadsPageClient />);
    rerender(<ThreadsPageClient />);

    const [first] = bootstrapMock.mock.calls[0];
    const [second] = bootstrapMock.mock.calls[bootstrapMock.mock.calls.length - 1];
    expect(first).toBe(second);
  });
});
