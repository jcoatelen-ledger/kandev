import { test, expect } from "../../fixtures/test-base";
import { MobileKanbanPage } from "../../pages/mobile-kanban-page";
import { seedSecondaryClarificationTask } from "../../helpers/clarification";
import { createStandardProfile, openTaskSession } from "../../helpers/git-helper";
import { assertNoHorizontalOverflow } from "../../helpers/session-stream-overload";
import { waitForLatestSessionDone } from "../../helpers/session";
import { attachGatewayTrafficCapture, type GatewayTrafficFrame } from "../../helpers/ws-traffic";

const AGENT_TITLE = "Mobile threads live work";

function sentSessionIds(frames: readonly GatewayTrafficFrame[], action: string): string[] {
  return frames
    .filter((frame) => frame.direction === "sent" && frame.action === action && frame.sessionId)
    .map((frame) => frame.sessionId as string);
}

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

  test("uses a bounded native picker for the selected session on phone", async ({
    testPage,
    apiClient,
    seedData,
  }) => {
    test.setTimeout(180_000);
    const target = await seedSecondaryClarificationTask(
      apiClient,
      seedData,
      "Mobile threads multi-session target",
    );
    const capture = attachGatewayTrafficCapture(testPage);
    await testPage.goto(`/threads?taskId=${target.id}&sessionId=${target.clarificationSessionId}`);

    const board = testPage.getByTestId("threads-board");
    const column = testPage.getByTestId(`thread-column-${target.id}`);
    await expect(board).toBeVisible();
    await expect(column).toBeVisible();
    const picker = column.getByTestId("thread-session-picker-trigger");
    await expect(picker).toBeVisible();
    await expect
      .poll(() => sentSessionIds(capture.frames, "session.subscribe"), {
        timeout: 30_000,
        message: "mobile Threads did not subscribe the deep-linked session",
      })
      .toContain(target.clarificationSessionId);
    expect(sentSessionIds(capture.frames, "session.subscribe")).not.toContain(
      target.primarySessionId,
    );
    await expect(column.getByTestId("session-chat")).toHaveCount(1);

    await picker.tap();
    const sheet = testPage.getByRole("dialog", { name: "Select session" });
    await expect(sheet).toBeVisible();
    const sheetContent = testPage.getByTestId("thread-session-picker-sheet");
    await expect(sheetContent).toBeVisible();
    await expect
      .poll(() => sheet.getByTestId(/^thread-session-row-/).count(), {
        timeout: 15_000,
        message: "mobile session picker did not load every task session",
      })
      .toBe(2);
    await expect(
      sheet.getByTestId(`thread-session-row-${target.clarificationSessionId}`),
    ).toHaveAttribute("aria-current", "true");
    const primaryRow = sheet.getByTestId(`thread-session-row-${target.primarySessionId}`);
    const primaryRowBox = await primaryRow.boundingBox();
    expect(primaryRowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await sheetContent.evaluate((element) => element.className)).toContain(
      "safe-area-inset-bottom",
    );

    await primaryRow.tap();
    await expect(sheet).toBeHidden();
    await expect
      .poll(() => sentSessionIds(capture.frames, "session.subscribe"), {
        timeout: 30_000,
        message: "mobile picker did not activate the primary session",
      })
      .toContain(target.primarySessionId);
    await expect
      .poll(() => sentSessionIds(capture.frames, "session.unsubscribe"), {
        timeout: 30_000,
        message: "mobile picker did not release the sibling session",
      })
      .toContain(target.clarificationSessionId);
    await expect(column.getByTestId("session-chat")).toHaveCount(1);
    await assertNoHorizontalOverflow(testPage, "mobile Threads session picker");
  });
});
