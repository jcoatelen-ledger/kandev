"use client";

import {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconLoader2,
  IconMessageQuestion,
  IconPlayerPause,
  IconShieldQuestion,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MobilePickerSheet } from "@/components/task/mobile/mobile-picker-sheet";
import { MobilePillButton } from "@/components/task/mobile/mobile-pill-button";
import { SessionTabs, type SessionTab } from "@/components/session-tabs";
import { useResponsiveBreakpoint } from "@/hooks/use-responsive-breakpoint";
import type { TaskSession } from "@/lib/types/http";
import { resolveThreadSessionStatus, type ThreadStatus } from "@/lib/threads/thread-session-status";
import { sortSessions } from "@/components/task/session-sort";

export type ThreadSessionView = {
  session: TaskSession;
  label: string;
  status: ThreadStatus;
  isPrimary: boolean;
  position: number;
};

function sessionLabel(session: TaskSession, position: number, fallbackLabel: string): string {
  if (session.name) return session.name;
  const snapshotLabel = session.agent_profile_snapshot?.label;
  if (typeof snapshotLabel === "string" && snapshotLabel) return snapshotLabel;
  return fallbackLabel ? fallbackLabel.replace("{{position}}", String(position)) : session.id;
}

export function buildThreadSessionViews(
  sessions: readonly TaskSession[],
  fallbackLabel = "",
): ThreadSessionView[] {
  return sortSessions(sessions).map((session, index) => ({
    session,
    label: sessionLabel(session, index + 1, fallbackLabel),
    status: resolveThreadSessionStatus(session),
    isPrimary: session.is_primary === true,
    position: index + 1,
  }));
}

export function ThreadSessionStatusIcon({
  status,
  label,
  testId,
}: {
  status: ThreadStatus;
  label: string;
  testId?: string;
}) {
  const iconProps = {
    "aria-label": label,
    "data-testid": testId,
    className: "h-3.5 w-3.5 shrink-0",
  };
  switch (status.kind) {
    case "needs-you":
      return (
        <IconMessageQuestion {...iconProps} className={`${iconProps.className} text-yellow-500`} />
      );
    case "permission":
      return (
        <IconShieldQuestion {...iconProps} className={`${iconProps.className} text-amber-500`} />
      );
    case "clarification":
      return (
        <IconMessageQuestion {...iconProps} className={`${iconProps.className} text-yellow-500`} />
      );
    case "starting":
    case "working":
      return (
        <IconLoader2
          {...iconProps}
          className={`${iconProps.className} animate-spin text-blue-500`}
        />
      );
    case "failed":
      return <IconAlertCircle {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case "cancelled":
      return <IconX {...iconProps} className={`${iconProps.className} text-muted-foreground`} />;
    case "finished":
      return (
        <IconCheck {...iconProps} className={`${iconProps.className} text-muted-foreground`} />
      );
    case "review-ready":
      return <IconCheck {...iconProps} className={`${iconProps.className} text-green-500`} />;
    case "completed":
      return <IconCircleCheck {...iconProps} className={`${iconProps.className} text-green-500`} />;
    case "waiting":
      return (
        <IconPlayerPause
          {...iconProps}
          className={`${iconProps.className} text-muted-foreground`}
        />
      );
    case "created":
      return (
        <IconAlertCircle
          {...iconProps}
          className={`${iconProps.className} text-muted-foreground`}
        />
      );
    default:
      return null;
  }
}

function DesktopSessionTabs({
  views,
  selectedSessionId,
  onSelect,
}: {
  views: ThreadSessionView[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const { t } = useTranslation();
  const tabs: SessionTab[] = views.map((view) => ({
    id: view.session.id,
    label: view.label,
    icon: <ThreadSessionStatusIcon status={view.status} label={t(view.status.labelKey)} />,
    testId: `thread-session-tab-${view.session.id}`,
    className: "bg-transparent data-[state=active]:bg-muted",
  }));
  return (
    <div className="min-w-0 w-full" data-testid="thread-session-tabs">
      <SessionTabs
        tabs={tabs}
        activeTab={selectedSessionId ?? views[0]?.session.id ?? ""}
        onTabChange={onSelect}
        className="min-w-0 w-full"
        listClassName="min-w-0 w-full max-w-full shrink overflow-x-auto overflow-y-hidden bg-transparent p-0 !h-7 gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      />
    </div>
  );
}

function MobileSessionPicker({
  views,
  selectedSessionId,
  onSelect,
}: {
  views: ThreadSessionView[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    views.findIndex((view) => view.session.id === selectedSessionId),
  );
  const selected = views[selectedIndex] ?? views[0];
  const handleSelect = (sessionId: string) => {
    onSelect(sessionId);
    setOpen(false);
  };

  return (
    <>
      <MobilePillButton
        label={selected?.label ?? t("threads:selectSession")}
        count={`${selectedIndex + 1}/${views.length}`}
        compact={false}
        isOpen={open}
        onClick={() => setOpen(true)}
        data-testid="thread-session-picker-trigger"
        ariaLabel={t("threads:selectSession")}
      />
      <MobilePickerSheet
        open={open}
        onOpenChange={setOpen}
        title={t("threads:selectSession")}
        description={t("threads:selectSessionDescription")}
        contentTestId="thread-session-picker-sheet"
      >
        <div role="list" className="flex flex-col gap-1">
          {views.map((view) => {
            const statusLabel = t(view.status.labelKey);
            const isSelected = view.session.id === selected?.session.id;
            return (
              <button
                key={view.session.id}
                type="button"
                aria-current={isSelected ? "true" : undefined}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left hover:bg-muted data-[selected=true]:border-primary/50 data-[selected=true]:bg-card"
                data-selected={isSelected ? "true" : undefined}
                data-testid={`thread-session-row-${view.session.id}`}
                onClick={() => handleSelect(view.session.id)}
              >
                <ThreadSessionStatusIcon
                  status={view.status}
                  label={statusLabel}
                  testId={`thread-session-status-${view.session.id}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{view.label}</span>
                {view.isPrimary && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {t("threads:primarySession")}
                  </span>
                )}
                {isSelected && <IconCheck aria-hidden="true" className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </MobilePickerSheet>
    </>
  );
}

/**
 * Switch-only presentation for the existing sessions of one task. The
 * component owns no session lifecycle action and never changes task-page
 * active-session state.
 */
export function ThreadSessionSwitcher({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: readonly TaskSession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const { isMobile } = useResponsiveBreakpoint();
  const views = buildThreadSessionViews(sessions);
  if (views.length <= 1) return null;

  return isMobile ? (
    <div className="min-w-0 shrink-0" data-testid="thread-session-switcher">
      <MobileSessionPicker
        views={views}
        selectedSessionId={selectedSessionId}
        onSelect={onSelect}
      />
    </div>
  ) : (
    <div className="min-w-0 max-w-[52%] shrink" data-testid="thread-session-switcher">
      <DesktopSessionTabs views={views} selectedSessionId={selectedSessionId} onSelect={onSelect} />
    </div>
  );
}
