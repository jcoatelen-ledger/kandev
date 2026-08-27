import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveThread } from "@/lib/threads/active-threads";

vi.mock("./thread-conversation", () => ({
  ThreadConversation: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`thread-conversation-${sessionId}`} />
  ),
}));

import { ThreadsBoard } from "./threads-board";

afterEach(() => cleanup());

function thread(overrides: Partial<ActiveThread> & { taskId: string }): ActiveThread {
  return {
    title: `Task ${overrides.taskId}`,
    workflowId: "wf-1",
    workflowName: "Delivery",
    stepTitle: "Build",
    sessionId: `session-${overrides.taskId}`,
    sessionState: "RUNNING",
    pendingAction: null,
    activeSubagentCount: 0,
    queuedPromptCount: 0,
    lastActivityAt: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

describe("ThreadsBoard", () => {
  it("renders one column per active thread, in the order it was given", () => {
    render(
      <ThreadsBoard
        threads={[thread({ taskId: "a" }), thread({ taskId: "b" })]}
        onOpenTask={() => {}}
      />,
    );

    const columns = screen.getAllByTestId(/^thread-column-/);
    expect(columns.map((column) => column.getAttribute("data-testid"))).toEqual([
      "thread-column-a",
      "thread-column-b",
    ]);
  });

  it("mounts the live conversation inside each column", () => {
    render(<ThreadsBoard threads={[thread({ taskId: "a" })]} onOpenTask={() => {}} />);

    expect(screen.getByTestId("thread-conversation-session-a")).not.toBeNull();
  });

  it("labels a thread with its task title, workflow and step", () => {
    render(
      <ThreadsBoard
        threads={[thread({ taskId: "a", title: "Fix the flaky test" })]}
        onOpenTask={() => {}}
      />,
    );

    expect(screen.getByText("Fix the flaky test")).not.toBeNull();
    expect(screen.getByText("Delivery")).not.toBeNull();
    expect(screen.getByText("Build")).not.toBeNull();
  });

  it("says a thread is waiting on the reader rather than working", () => {
    render(
      <ThreadsBoard
        threads={[thread({ taskId: "a", sessionState: "WAITING_FOR_INPUT" })]}
        onOpenTask={() => {}}
      />,
    );

    expect(screen.getByText("Needs you")).not.toBeNull();
    expect(screen.queryByText("Working")).toBeNull();
  });

  it("treats a pending question as needing the reader even while the session is parked", () => {
    render(
      <ThreadsBoard
        threads={[thread({ taskId: "a", sessionState: "IDLE", pendingAction: "clarification" })]}
        onOpenTask={() => {}}
      />,
    );

    expect(screen.getByText("Needs you")).not.toBeNull();
  });

  it("counts subagents and queued prompts only when there are some", () => {
    render(
      <ThreadsBoard
        threads={[
          thread({ taskId: "a", activeSubagentCount: 2, queuedPromptCount: 1 }),
          thread({ taskId: "b" }),
        ]}
        onOpenTask={() => {}}
      />,
    );

    expect(screen.getByText("2 subagents")).not.toBeNull();
    expect(screen.getByText("1 queued prompt")).not.toBeNull();
    expect(screen.queryByText("0 subagents")).toBeNull();
  });

  it("opens the full task page from the column header", () => {
    const onOpenTask = vi.fn();
    render(<ThreadsBoard threads={[thread({ taskId: "a" })]} onOpenTask={onOpenTask} />);

    fireEvent.click(screen.getByRole("button", { name: "Open task" }));

    expect(onOpenTask).toHaveBeenCalledWith("a");
  });

  it("explains the empty board instead of showing a bare surface", () => {
    render(<ThreadsBoard threads={[]} onOpenTask={() => {}} />);

    expect(screen.getByTestId("threads-empty-state")).not.toBeNull();
    expect(screen.getByText("No agent is working right now")).not.toBeNull();
    expect(screen.queryByTestId("threads-board")).toBeNull();
  });

  it("shows a loading state before the first snapshot lands, not the empty state", () => {
    render(<ThreadsBoard threads={[]} isLoading onOpenTask={() => {}} />);

    expect(screen.getByText("Loading threads...")).not.toBeNull();
    expect(screen.queryByTestId("threads-empty-state")).toBeNull();
  });

  it("keeps a landed board visible while a background refresh runs", () => {
    render(<ThreadsBoard threads={[thread({ taskId: "a" })]} isLoading onOpenTask={() => {}} />);

    expect(screen.getByTestId("thread-column-a")).not.toBeNull();
    expect(screen.queryByText("Loading threads...")).toBeNull();
  });
});
