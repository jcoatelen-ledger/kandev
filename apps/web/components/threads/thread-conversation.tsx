"use client";

import { useCallback } from "react";
import type { ChatSubmitPayload } from "@/components/task/chat/chat-input-container";
import { TaskChatPanel } from "@/components/task/task-chat-panel";
import { sendMessageRequest } from "@/hooks/use-message-handler";

/**
 * One column's live conversation.
 *
 * `isVisible` stays false for the same reason the kanban preview keeps it
 * false: a wall of columns is a glance across running work, and letting every
 * mounted column advance its own Slack-style read cursor would mark threads
 * read that the user never looked at.
 */
export function ThreadConversation({ taskId, sessionId }: { taskId: string; sessionId: string }) {
  const handleSend = useCallback(
    async (payload: ChatSubmitPayload) => {
      await sendMessageRequest({
        taskId,
        resolvedSessionId: sessionId,
        finalMessage: payload.message,
        modelToSend: undefined,
        planMode: false,
        hasReviewComments: !!payload.reviewComments?.length,
        attachments: payload.attachments,
        entityReferences: payload.entityReferences,
      });
    },
    [taskId, sessionId],
  );

  return (
    <TaskChatPanel
      onSend={handleSend}
      sessionId={sessionId}
      taskId={taskId}
      hideSessionsDropdown
      isVisible={false}
    />
  );
}
