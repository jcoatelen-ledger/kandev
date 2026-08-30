import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskSession } from "@/lib/types/http";
import { sessionId, taskId } from "@/lib/types/ids";
import type { ResponsiveBreakpoint } from "@/hooks/use-responsive-breakpoint";

const responsiveMocks = vi.hoisted(() => ({
  useResponsiveBreakpoint: vi.fn(),
}));

vi.mock("@/hooks/use-responsive-breakpoint", () => responsiveMocks);

import { ThreadSessionSwitcher } from "./thread-session-switcher";

const SESSION_A = "session-a";
const SESSION_B = "session-b";

function session(id: string, name: string): TaskSession {
  return {
    id: sessionId(id),
    task_id: taskId("task-1"),
    name,
    state: "RUNNING",
    started_at: "2026-08-27T10:00:00Z",
    updated_at: "2026-08-27T12:00:00Z",
  };
}

function desktop(): ResponsiveBreakpoint {
  return { isMobile: false } as ResponsiveBreakpoint;
}

function mobile(): ResponsiveBreakpoint {
  return { isMobile: true } as ResponsiveBreakpoint;
}

afterEach(cleanup);

describe("ThreadSessionSwitcher", () => {
  beforeEach(() => {
    responsiveMocks.useResponsiveBreakpoint.mockReturnValue(desktop());
  });

  it("renders switch-only tabs in the existing desktop metadata row", () => {
    render(
      <ThreadSessionSwitcher
        sessions={[session(SESSION_A, "Planner"), session(SESSION_B, "Builder")]}
        selectedSessionId={SESSION_A}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("thread-session-switcher")).not.toBeNull();
    expect(screen.getByRole("tab", { name: /Planner/ })).not.toBeNull();
    expect(screen.getByRole("tab", { name: /Builder/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /add|new/i })).toBeNull();
  });

  it("reports a selected desktop session without changing global task state", () => {
    const onSelect = vi.fn();
    render(
      <ThreadSessionSwitcher
        sessions={[session(SESSION_A, "Planner"), session(SESSION_B, "Builder")]}
        selectedSessionId={SESSION_A}
        onSelect={onSelect}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Builder/ }), { button: 0 });

    expect(onSelect).toHaveBeenCalledWith(SESSION_B);
  });

  it("keeps long desktop labels inside the constrained metadata flex item", () => {
    render(
      <ThreadSessionSwitcher
        sessions={[
          session(SESSION_A, "Planner with a deliberately long session label"),
          session(SESSION_B, "Builder with another deliberately long session label"),
        ]}
        selectedSessionId={SESSION_A}
        onSelect={vi.fn()}
      />,
    );

    const switcher = screen.getByTestId("thread-session-switcher");
    const tabs = screen.getByTestId("thread-session-tabs");
    const tabList = screen.getByRole("tablist");
    expect(switcher.className).toContain("min-w-0");
    expect(switcher.className).toContain("max-w-[52%]");
    expect(switcher.className).toContain("shrink");
    expect(tabs.className).toContain("w-full");
    expect(tabList.className).toContain("w-full");
    expect(tabList.className).toContain("overflow-x-auto");
  });

  it("uses a phone pill and a 44-pixel bottom-sheet row instead of tabs", () => {
    responsiveMocks.useResponsiveBreakpoint.mockReturnValue(mobile());
    const onSelect = vi.fn();
    render(
      <ThreadSessionSwitcher
        sessions={[session(SESSION_A, "Planner"), session(SESSION_B, "Builder")]}
        selectedSessionId={SESSION_A}
        onSelect={onSelect}
      />,
    );

    expect(screen.queryByRole("tab")).toBeNull();
    fireEvent.click(screen.getByTestId("thread-session-picker-trigger"));

    const row = screen.getByTestId(`thread-session-row-${SESSION_B}`);
    expect(row.className).toContain("min-h-11");
    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith(SESSION_B);
  });
});
