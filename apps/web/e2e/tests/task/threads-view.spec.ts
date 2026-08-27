import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import type { SeedData } from "../../fixtures/test-base";
import type { ApiClient } from "../../helpers/api-client";
import { KanbanPage } from "../../pages/kanban-page";
import { createStandardProfile, openTaskSession } from "../../helpers/git-helper";
import { waitForLatestSessionDone } from "../../helpers/session";

const AGENT_TITLE = "Threads live agent work";
const SECOND_TITLE = "Threads second live agent work";
const IDLE_TITLE = "Threads never started";

/**
 * Runs a real agent turn so the task ends with a primary session in
 * WAITING_FOR_INPUT. Seeded sessions are never marked primary, and the deck
 * follows production's primary-session rule, so they would not appear.
 *
 * The task page is what launches the session (`useEnsureTaskSession`), so
 * opening it is part of arranging the fixture, not an assertion.
 */
async function startAgentTask(
  page: Page,
  apiClient: ApiClient,
  seedData: SeedData,
  profileName: string,
  options: { title?: string } = {},
) {
  const title = options.title ?? AGENT_TITLE;
  const profile = await createStandardProfile(apiClient, profileName);
  const task = await apiClient.createTaskWithAgent(seedData.workspaceId, title, profile.id, {
    description: "/e2e:simple-message",
    workflow_id: seedData.workflowId,
    workflow_step_id: seedData.startStepId,
    repository_ids: [seedData.repositoryId],
  });
  await openTaskSession(page, title);
  // `POST /tasks` answers with the Task itself, so the id lives on `id` — the
  // `task_id` shape belongs to the seed harness.
  await waitForLatestSessionDone(apiClient, task.id, 1, `agent turn for ${title}`);
  return task;
}

test.describe("Threads view", () => {
  test("decks live agent threads and leaves work with no agent out", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(180_000);
    const live = await startAgentTask(testPage, apiClient, seedData, "threads-live");
    const idle = await apiClient.seedTask(seedData.workspaceId, IDLE_TITLE, {
      workflow_id: seedData.workflowId,
      workflow_step_id: seedData.startStepId,
    });

    await testPage.goto("/");
    await expect(new KanbanPage(testPage).board).toBeVisible();
    await testPage.getByTestId("view-toggle-threads").click();
    await expect(testPage).toHaveURL(/\/threads/);

    await expect(testPage.getByTestId("threads-board")).toBeVisible();
    const column = testPage.getByTestId(`thread-column-${live.id}`);
    await expect(column).toBeVisible();
    await expect(column).toContainText(AGENT_TITLE);
    // The turn ended on a question, so the deck reports it as blocked on a person.
    await expect(column.getByTestId("thread-status-needs-you")).toBeVisible();
    await expect(testPage.getByTestId(`thread-column-${idle.task_id}`)).toHaveCount(0);
  });

  test("remembers Threads as the device listing view and reopens Home there", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(180_000);
    const live = await startAgentTask(testPage, apiClient, seedData, "threads-remembered");

    await testPage.goto("/");
    await expect(new KanbanPage(testPage).board).toBeVisible();
    await testPage.getByTestId("view-toggle-threads").click();
    await expect(testPage).toHaveURL(/\/threads/);
    await expect(testPage.getByTestId("view-toggle-threads")).toHaveAttribute("data-state", "on");

    await testPage.goto("/");
    await expect(testPage).toHaveURL(/\/threads/);
    await expect(testPage.getByTestId(`thread-column-${live.id}`)).toBeVisible();
  });

  test("opens the full task page from a column", async ({ testPage, apiClient, seedData }) => {
    test.setTimeout(180_000);
    const live = await startAgentTask(testPage, apiClient, seedData, "threads-open-task");

    await testPage.goto("/threads");
    const column = testPage.getByTestId(`thread-column-${live.id}`);
    await expect(column).toBeVisible();

    await column.getByRole("button", { name: "Open task" }).click();
    await expect(testPage).toHaveURL(new RegExp(`/t/${live.id}`));
  });

  test("hands a discussion back to the deck, scrolled to its column", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(180_000);
    const live = await startAgentTask(testPage, apiClient, seedData, "threads-round-trip");

    // startAgentTask leaves the browser on the task page, which is the surface
    // the button lives on.
    await testPage.getByTestId("open-in-threads-button").click();

    await expect(testPage).toHaveURL(new RegExp(`/threads\\?taskId=${live.id}`));
    const column = testPage.getByTestId(`thread-column-${live.id}`);
    await expect(column).toBeVisible();
    await expect(column).toHaveAttribute("data-focused", "true");
    // The deck is the round trip's destination, so it must not re-offer the jump.
    await expect(testPage.getByTestId("open-in-threads-button")).toHaveCount(0);
  });

  test("shares the board width between columns instead of leaving it empty", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(240_000);
    const first = await startAgentTask(testPage, apiClient, seedData, "threads-width-a");
    const second = await startAgentTask(testPage, apiClient, seedData, "threads-width-b", {
      title: SECOND_TITLE,
    });

    await testPage.goto("/threads");
    const board = testPage.getByTestId("threads-board");
    await expect(board).toBeVisible();
    const columns = [
      testPage.getByTestId(`thread-column-${first.id}`),
      testPage.getByTestId(`thread-column-${second.id}`),
    ];
    for (const column of columns) await expect(column).toBeVisible();

    const boardWidth = (await board.boundingBox())?.width ?? 0;
    const widths = await Promise.all(
      columns.map(async (column) => (await column.boundingBox())?.width ?? 0),
    );
    expect(boardWidth).toBeGreaterThan(0);
    // Two threads on a desktop board fill it rather than sitting at a fixed
    // 380px with the rest of the deck blank.
    expect(Math.min(...widths)).toBeGreaterThan(400);
    expect(widths[0] + widths[1]).toBeGreaterThan(boardWidth * 0.8);
  });

  test("shows which column the cursor is in, and moves that mark on click", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(240_000);
    const first = await startAgentTask(testPage, apiClient, seedData, "threads-focus-a");
    const second = await startAgentTask(testPage, apiClient, seedData, "threads-focus-b", {
      title: SECOND_TITLE,
    });

    await testPage.goto("/threads");
    const columns = {
      first: testPage.getByTestId(`thread-column-${first.id}`),
      second: testPage.getByTestId(`thread-column-${second.id}`),
    };
    for (const column of Object.values(columns)) await expect(column).toBeVisible();

    // The composer's own border tracks agent state, not the caret, so the
    // column has to carry the focus mark or a deck of composers gives the
    // reader no way to tell where typing will land.
    const ringed = (column: Locator) =>
      column.evaluate((node) => getComputedStyle(node).boxShadow !== "none");

    await columns.second.locator(".tiptap.ProseMirror").click();
    await expect.poll(() => ringed(columns.second)).toBe(true);
    expect(await ringed(columns.first)).toBe(false);

    await columns.first.locator(".tiptap.ProseMirror").click();
    await expect.poll(() => ringed(columns.first)).toBe(true);
    expect(await ringed(columns.second)).toBe(false);
  });

  test("explains an empty deck when nothing is running", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    await apiClient.seedTask(seedData.workspaceId, IDLE_TITLE, {
      workflow_id: seedData.workflowId,
      workflow_step_id: seedData.startStepId,
    });

    await testPage.goto("/threads");
    await expect(testPage.getByTestId("threads-empty-state")).toBeVisible();
    await expect(testPage.getByTestId("threads-board")).toHaveCount(0);
  });
});
