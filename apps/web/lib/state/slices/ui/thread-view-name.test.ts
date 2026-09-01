import { describe, expect, it } from "vitest";
import { DEFAULT_THREAD_VIEW, threadViewName } from "./thread-view-builtins";

describe("threadViewName", () => {
  it("translates the unrenamed built-in view", () => {
    expect(threadViewName(DEFAULT_THREAD_VIEW, (key) => `translated:${key}`)).toBe(
      "translated:threads:allThreads",
    );
  });

  it("preserves a custom view name", () => {
    expect(
      threadViewName({ id: DEFAULT_THREAD_VIEW.id, name: "My threads" }, () => "translated"),
    ).toBe("My threads");
  });
});
