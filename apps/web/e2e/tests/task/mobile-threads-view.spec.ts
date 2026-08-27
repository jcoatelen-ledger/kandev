import { test, expect } from "../../fixtures/test-base";
import { MobileKanbanPage } from "../../pages/mobile-kanban-page";
import { createStandardProfile, openTaskSession } from "../../helpers/git-helper";
import { waitForLatestSessionDone } from "../../helpers/session";

const AGENT_TITLE = "Mobile threads live work";

test.describe("Mobile Threads view", () => {
  test("reaches the deck from the drawer and pages one full-width column", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(180_000);
    const profile = await createStandardProfile(apiClient, "mobile-threads");
    const task = await apiClient.createTaskWithAgent(
      seedData.workspaceId,
      AGENT_TITLE,
      profile.id,
      {
        description: "/e2e:simple-message",
        workflow_id: seedData.workflowId,
        workflow_step_id: seedData.startStepId,
        repository_ids: [seedData.repositoryId],
      },
    );
    await openTaskSession(testPage, AGENT_TITLE);
    await waitForLatestSessionDone(apiClient, task.id, 1, `agent turn for ${AGENT_TITLE}`);

    const mobile = new MobileKanbanPage(testPage);
    await mobile.goto();
    await mobile.mobileMenuButton.click();
    const menu = testPage.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("radio", { name: "Threads", exact: true }).click();
    await expect(testPage).toHaveURL(/\/threads/);

    const column = testPage.getByTestId(`thread-column-${task.id}`);
    await expect(column).toBeVisible();
    await expect(column).toContainText(AGENT_TITLE);

    // The phone layout pages the deck: one column fills the viewport rather
    // than shrinking several into an unreadable row.
    const viewportWidth = testPage.viewportSize()?.width ?? 0;
    const columnWidth = (await column.boundingBox())?.width ?? 0;
    expect(viewportWidth).toBeGreaterThan(0);
    expect(columnWidth).toBeGreaterThan(viewportWidth * 0.7);
    expect(columnWidth).toBeLessThanOrEqual(viewportWidth);
  });
});
