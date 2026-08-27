"use client";

import { IconColumns } from "@tabler/icons-react";
import type { ActiveThread } from "@/lib/threads/active-threads";
import { useTranslation } from "react-i18next";
import { ThreadColumn } from "./thread-column";

type ThreadsBoardProps = {
  threads: ActiveThread[];
  isLoading?: boolean;
  /** Column a deep link asked for; scrolled into view and ringed on arrival. */
  focusedTaskId?: string | null;
  onOpenTask: (taskId: string) => void;
};

function ThreadsPlaceholder({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 px-6 text-center"
    >
      {children}
    </div>
  );
}

function ThreadsEmptyState() {
  const { t } = useTranslation();
  return (
    <ThreadsPlaceholder testId="threads-empty-state">
      <IconColumns aria-hidden="true" className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium">{t("threads:emptyTitle")}</p>
      <p className="max-w-md text-sm text-muted-foreground">{t("threads:emptyBody")}</p>
    </ThreadsPlaceholder>
  );
}

function ThreadsLoadingState() {
  const { t } = useTranslation();
  return (
    <ThreadsPlaceholder testId="threads-loading-state">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {t("threads:loading")}
      </p>
    </ThreadsPlaceholder>
  );
}

/**
 * The deck: every live agent conversation as its own column, scrolled
 * horizontally. Columns keep the order the selector gave them, so a thread the
 * reader is following does not jump while they read it.
 */
export function ThreadsBoard({
  threads,
  isLoading = false,
  focusedTaskId = null,
  onOpenTask,
}: ThreadsBoardProps) {
  if (threads.length === 0) {
    return isLoading ? <ThreadsLoadingState /> : <ThreadsEmptyState />;
  }

  return (
    <div
      data-testid="threads-board"
      className="flex h-full min-h-0 w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden p-3 sm:snap-none"
    >
      {threads.map((thread) => (
        <ThreadColumn
          key={thread.taskId}
          thread={thread}
          isFocused={thread.taskId === focusedTaskId}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}
