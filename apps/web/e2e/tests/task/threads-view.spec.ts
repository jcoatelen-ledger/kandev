import { expect, type Page } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import type { SeedData } from "../../fixtures/test-base";
import type { ApiClient } from "../../helpers/api-client";
import { KanbanPage } from "../../pages/kanban-page";
import { createStandardProfile, openTaskSession } from "../../helpers/git-helper";
import { waitForLatestSessionDone } from "../../helpers/session";

const AGENT_TITLE = "Threads live agent work";
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
) {
  const profile = await createStandardProfile(apiClient, profileName);
  const task = await apiClient.createTaskWithAgent(seedData.workspaceId, AGENT_TITLE, profile.id, {
    description: "/e2e:simple-message",
    workflow_id: seedData.workflowId,
    workflow_step_id: seedData.startStepId,
    repository_ids: [seedData.repositoryId],
  });
  await openTaskSession(page, AGENT_TITLE);
  // `POST /tasks` answers with the Task itself, so the id lives on `id` — the
  // `task_id` shape belongs to the seed harness.
  await waitForLatestSessionDone(apiClient, task.id, 1, `agent turn for ${AGENT_TITLE}`);
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
