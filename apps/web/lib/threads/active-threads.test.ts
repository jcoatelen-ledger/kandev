import { describe, expect, it } from "vitest";
import type { KanbanState, WorkflowSnapshotData } from "@/lib/state/slices/kanban/types";
import {
  isActiveThreadSession,
  resolveFocusedThreadId,
  selectActiveThreads,
  type ActiveThread,
} from "./active-threads";

type TaskOverrides = Partial<KanbanState["tasks"][number]> & { id: string };

function task(overrides: TaskOverrides): KanbanState["tasks"][number] {
  return {
    workflowId: "wf-1",
    workflowStepId: "step-1",
    title: `Task ${overrides.id}`,
    position: 0,
    updatedAt: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

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

function snapshot(
  workflowId: string,
  workflowName: string,
  tasks: KanbanState["tasks"],
): WorkflowSnapshotData {
  return {
    workflowId,
    workflowName,
    steps: [{ id: "step-1", title: "Build", color: "bg-blue-500", position: 0 }],
    tasks,
  };
}

describe("selectActiveThreads", () => {
  it("keeps only tasks whose agent is running or waiting on a human", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({ id: "running", primarySessionId: "s-1", primarySessionState: "RUNNING" }),
        task({ id: "starting", primarySessionId: "s-2", primarySessionState: "STARTING" }),
        task({ id: "waiting", primarySessionId: "s-3", primarySessionState: "WAITING_FOR_INPUT" }),
        task({ id: "done", primarySessionId: "s-4", primarySessionState: "COMPLETED" }),
        task({ id: "idle", primarySessionId: "s-5", primarySessionState: "IDLE" }),
        task({ id: "never-started" }),
      ]),
    });

    expect(threads.map((thread) => thread.taskId)).toEqual(["waiting", "running", "starting"]);
  });

  it("keeps a parked session that is blocking on a question", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "asking",
          primarySessionId: "s-1",
          primarySessionState: "IDLE",
          primarySessionPendingAction: "clarification",
        }),
      ]),
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].pendingAction).toBe("clarification");
  });

  it("puts threads that need a human before threads that are still working", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "running",
          primarySessionId: "s-1",
          primarySessionState: "RUNNING",
          updatedAt: "2026-08-27T12:00:00Z",
        }),
        task({
          id: "waiting",
          primarySessionId: "s-2",
          primarySessionState: "WAITING_FOR_INPUT",
          updatedAt: "2026-08-27T08:00:00Z",
        }),
      ]),
    });

    expect(threads.map((thread) => thread.taskId)).toEqual(["waiting", "running"]);
  });

  it("orders threads in the same bucket by most recent activity", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "older",
          primarySessionId: "s-1",
          primarySessionState: "RUNNING",
          updatedAt: "2026-08-27T08:00:00Z",
        }),
        task({
          id: "newer",
          primarySessionId: "s-2",
          primarySessionState: "RUNNING",
          updatedAt: "2026-08-27T09:00:00Z",
        }),
      ]),
    });

    expect(threads.map((thread) => thread.taskId)).toEqual(["newer", "older"]);
  });

  it("breaks an activity tie on task id so columns never shuffle between renders", () => {
    const tied = {
      primarySessionState: "RUNNING" as const,
      updatedAt: "2026-08-27T08:00:00Z",
    };
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({ id: "b", primarySessionId: "s-2", ...tied }),
        task({ id: "a", primarySessionId: "s-1", ...tied }),
      ]),
    });

    expect(threads.map((thread) => thread.taskId)).toEqual(["a", "b"]);
  });
});

describe("selectActiveThreads — thread contents and scope", () => {
  it("prefers the live status summary over the cached primary-session fields", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "task-1",
          primarySessionId: "stale-session",
          primarySessionState: "COMPLETED",
          statusSummary: {
            revision: 4,
            updated_at: "2026-08-27T10:05:00Z",
            last_activity_at: "2026-08-27T10:04:00Z",
            primary_session: { id: "live-session", state: "RUNNING" },
            active_subagent_count: 2,
            queued_prompt_count: 1,
          },
        }),
      ]),
    });

    expect(threads).toEqual([
      expect.objectContaining({
        taskId: "task-1",
        sessionId: "live-session",
        sessionState: "RUNNING",
        activeSubagentCount: 2,
        queuedPromptCount: 1,
        lastActivityAt: "2026-08-27T10:04:00Z",
      }),
    ]);
  });

  it("carries the workflow and step a thread belongs to", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({ id: "task-1", primarySessionId: "s-1", primarySessionState: "RUNNING" }),
      ]),
    });

    expect(threads[0]).toMatchObject({
      workflowId: "wf-1",
      workflowName: "Delivery",
      stepTitle: "Build",
      title: "Task task-1",
    });
  });

  it("reports an unknown step as absent rather than inventing a label", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "task-1",
          workflowStepId: "deleted-step",
          primarySessionId: "s-1",
          primarySessionState: "RUNNING",
        }),
      ]),
    });

    expect(threads[0].stepTitle).toBeNull();
  });

  it("excludes archived tasks", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({
          id: "task-1",
          primarySessionId: "s-1",
          primarySessionState: "RUNNING",
          isArchived: true,
        }),
      ]),
    });

    expect(threads).toEqual([]);
  });
});

describe("selectActiveThreads — workspace scope", () => {
  it("merges threads from every workflow in the workspace", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({ id: "task-1", primarySessionId: "s-1", primarySessionState: "RUNNING" }),
      ]),
      "wf-2": snapshot("wf-2", "Support", [
        task({
          id: "task-2",
          workflowId: "wf-2",
          primarySessionId: "s-2",
          primarySessionState: "RUNNING",
        }),
      ]),
    });

    expect(threads.map((thread) => thread.workflowName).sort()).toEqual(["Delivery", "Support"]);
  });

  it("narrows to a single workflow when one is selected", () => {
    const threads = selectActiveThreads(
      {
        "wf-1": snapshot("wf-1", "Delivery", [
          task({ id: "task-1", primarySessionId: "s-1", primarySessionState: "RUNNING" }),
        ]),
        "wf-2": snapshot("wf-2", "Support", [
          task({
            id: "task-2",
            workflowId: "wf-2",
            primarySessionId: "s-2",
            primarySessionState: "RUNNING",
          }),
        ]),
      },
      { workflowId: "wf-2" },
    );

    expect(threads.map((thread) => thread.taskId)).toEqual(["task-2"]);
  });

  it("drops a thread whose session id is unknown, because it has nothing to show", () => {
    const threads = selectActiveThreads({
      "wf-1": snapshot("wf-1", "Delivery", [
        task({ id: "task-1", primarySessionState: "RUNNING" }),
      ]),
    });

    expect(threads).toEqual([]);
  });
});

describe("isActiveThreadSession", () => {
  it("accepts a primary session the deck would show a column for", () => {
    for (const state of ["RUNNING", "STARTING", "WAITING_FOR_INPUT"] as const) {
      expect(isActiveThreadSession({ isPrimary: true, state })).toBe(true);
    }
  });

  it("accepts a parked primary session that is blocking on a question", () => {
    expect(
      isActiveThreadSession({ isPrimary: true, state: "IDLE", pendingAction: "clarification" }),
    ).toBe(true);
  });

  it("rejects a settled primary session", () => {
    for (const state of ["COMPLETED", "FAILED", "CANCELLED", "IDLE", "CREATED"] as const) {
      expect(isActiveThreadSession({ isPrimary: true, state })).toBe(false);
    }
  });

  it("rejects a non-primary session, because the deck has no column for it", () => {
    expect(isActiveThreadSession({ isPrimary: false, state: "RUNNING" })).toBe(false);
  });

  it("rejects a session whose state is unknown", () => {
    expect(isActiveThreadSession({ isPrimary: true, state: null })).toBe(false);
  });
});

describe("resolveFocusedThreadId", () => {
  const threads = [thread({ taskId: "a" }), thread({ taskId: "b" })];

  it("focuses a requested task that has a column", () => {
    expect(resolveFocusedThreadId(threads, "b")).toBe("b");
  });

  it("focuses nothing when the requested task settled out of the deck", () => {
    expect(resolveFocusedThreadId(threads, "gone")).toBeNull();
  });

  it("focuses nothing when no task was requested", () => {
    expect(resolveFocusedThreadId(threads, null)).toBeNull();
  });
});
