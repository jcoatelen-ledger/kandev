"use client";

import { useEffect, useRef } from "react";
import { IconArrowsMaximize, IconMessageQuestion } from "@tabler/icons-react";
import { Badge } from "@kandev/ui/badge";
import { Button } from "@kandev/ui/button";
import { GridSpinner } from "@/components/grid-spinner";
import type { ActiveThread } from "@/lib/threads/active-threads";
import { useTranslation } from "react-i18next";
import { ThreadConversation } from "./thread-conversation";

type ThreadStatus = "needsYou" | "starting" | "working";

const STATUS_LABEL_KEYS: Record<ThreadStatus, string> = {
  needsYou: "threads:statusNeedsYou",
  starting: "threads:statusStarting",
  working: "threads:statusWorking",
};

export function resolveThreadStatus(thread: ActiveThread): ThreadStatus {
  if (thread.pendingAction || thread.sessionState === "WAITING_FOR_INPUT") return "needsYou";
  return thread.sessionState === "STARTING" ? "starting" : "working";
}

function ThreadStatusIcon({ status }: { status: ThreadStatus }) {
  if (status === "needsYou") {
    return (
      <IconMessageQuestion
        data-testid="thread-status-needs-you"
        aria-hidden="true"
        className="mt-[2px] h-3.5 w-3.5 shrink-0 text-yellow-500"
      />
    );
  }
  return (
    <GridSpinner
      data-testid="thread-status-working"
      className="mt-[2px] shrink-0 text-[14px] text-muted-foreground"
    />
  );
}

function ThreadMeta({ thread, status }: { thread: ActiveThread; status: ThreadStatus }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70">{t(STATUS_LABEL_KEYS[status])}</span>
      <span className="truncate">{thread.workflowName}</span>
      {thread.stepTitle && <span className="truncate">{thread.stepTitle}</span>}
      {thread.activeSubagentCount > 0 && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
          {t("threads:subagentCount", { count: thread.activeSubagentCount })}
        </Badge>
      )}
      {thread.queuedPromptCount > 0 && (
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
          {t("threads:queuedPromptCount", { count: thread.queuedPromptCount })}
        </Badge>
      )}
    </div>
  );
}

/**
 * Brings a deep-linked column into view once.
 *
 * The effect is keyed on `isFocused` alone, and the column is keyed by task id,
 * so a column that only mounts when a later snapshot lands still scrolls, while
 * a column that merely re-renders with fresh messages does not yank the deck
 * back under the reader.
 */
function useScrollWhenFocused(isFocused: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isFocused) return;
    ref.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [isFocused]);
  return ref;
}

export function ThreadColumn({
  thread,
  isFocused = false,
  onOpenTask,
}: {
  thread: ActiveThread;
  isFocused?: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const status = resolveThreadStatus(thread);
  const ref = useScrollWhenFocused(isFocused);

  return (
    <section
      ref={ref}
      data-testid={`thread-column-${thread.taskId}`}
      data-focused={isFocused ? "true" : undefined}
      aria-label={t("threads:columnLabel", { title: thread.title })}
      // Phone: one column fills the viewport and snaps, so the deck is paged
      // instead of pinch-scrolled.
      //
      // Desktop: columns share the width rather than taking a fixed slice, so
      // two threads fill the board instead of leaving it mostly empty. The min
      // width is the floor they stop shrinking at, which is what turns a busy
      // deck into a horizontal scroll rather than a row of slivers.
      //
      // Two marks, deliberately different properties so they can coexist
      // without fighting over one ring colour:
      //   ring    — where the caret is. A composer's own border tracks agent
      //             state, not focus, so in a deck of composers nothing else
      //             says where typing would land.
      //   outline — the column a deep link asked for.
      className="flex h-full min-h-0 w-[85vw] shrink-0 snap-start flex-col overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring data-[focused=true]:outline data-[focused=true]:outline-2 data-[focused=true]:outline-offset-2 data-[focused=true]:outline-primary sm:w-auto sm:min-w-[360px] sm:flex-1 sm:shrink"
    >
      <header className="flex flex-col gap-1 border-b px-3 py-2">
        <div className="flex items-start gap-2">
          <ThreadStatusIcon status={status} />
          <p className="min-w-0 flex-1 truncate text-sm font-medium" title={thread.title}>
            {thread.title}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 cursor-pointer"
            aria-label={t("threads:openTask")}
            onClick={() => onOpenTask(thread.taskId)}
          >
            <IconArrowsMaximize className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ThreadMeta thread={thread} status={status} />
      </header>
      <div className="min-h-0 flex-1">
        <ThreadConversation taskId={thread.taskId} sessionId={thread.sessionId} />
      </div>
    </section>
  );
}
