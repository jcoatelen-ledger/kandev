"use client";

import type { ReactNode } from "react";
import { IconStack2 } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kandev/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { Repository, RepositorySet } from "@/lib/types/http";
import type { TaskRepoRow } from "@/components/task-create-dialog-types";
import { applyRepositorySet } from "@/components/task-create-dialog-repository-sets";

type RepositorySetsControlProps = {
  sets: RepositorySet[];
  repositories: Repository[];
  rows: TaskRepoRow[];
  onApply: (set: RepositorySet) => void;
  /**
   * Why sets cannot be applied right now, or null when they can. Rendered as
   * visible text next to the disabled trigger rather than in a tooltip, because a
   * touch device never surfaces a hover tooltip.
   */
  disabledReason: string | null;
  /** Extra actions appended under the set list, e.g. "Save as set". */
  footerActions?: ReactNode;
};

/**
 * The **Sets** control beside "add repository": picks a repository set and fills
 * the picker with its members in one action.
 *
 * Rendered as a Radix DropdownMenu on purpose. Those already get inset,
 * safe-area-aware bottom-sheet treatment below 640px, so the phone presentation
 * comes from the shared primitive rather than a parallel mobile menu.
 */
export function RepositorySetsControl({
  sets,
  repositories,
  rows,
  onApply,
  disabledReason,
  footerActions,
}: RepositorySetsControlProps) {
  const { t } = useTranslation();
  // Absent rather than disabled when there is nothing to offer: a control that
  // only ever says "you have no sets" is noise in a crowded row.
  if (sets.length === 0 && !footerActions) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={Boolean(disabledReason)}
            aria-label={t("task:repositorySetsApplyLabel")}
            data-testid="repository-sets-trigger"
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground",
              disabledReason
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:bg-muted hover:text-foreground",
            )}
          >
            <IconStack2 className="h-3.5 w-3.5" />
            <span>{t("task:repositorySetsTrigger")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <RepositorySetMenuItems
            sets={sets}
            repositories={repositories}
            rows={rows}
            onApply={onApply}
            footerActions={footerActions}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {disabledReason ? (
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      ) : null}
    </div>
  );
}

type RepositorySetMenuItemsProps = {
  sets: RepositorySet[];
  repositories: Repository[];
  rows: TaskRepoRow[];
  onApply: (set: RepositorySet) => void;
  footerActions?: ReactNode;
};

/**
 * The menu body, separate from the trigger so it can be rendered (and tested)
 * inside an already-open menu.
 */
export function RepositorySetMenuItems({
  sets,
  repositories,
  rows,
  onApply,
  footerActions,
}: RepositorySetMenuItemsProps) {
  const { t } = useTranslation();
  return (
    <>
      <DropdownMenuLabel>{t("task:repositorySetsMenuLabel")}</DropdownMenuLabel>
      {sets.map((set) => (
        <RepositorySetOption
          key={set.id}
          set={set}
          rows={rows}
          repositories={repositories}
          onApply={onApply}
        />
      ))}
      {footerActions ? (
        <>
          {sets.length > 0 ? <DropdownMenuSeparator /> : null}
          {footerActions}
        </>
      ) : null}
    </>
  );
}

type RepositorySetOptionProps = {
  set: RepositorySet;
  rows: TaskRepoRow[];
  repositories: Repository[];
  onApply: (set: RepositorySet) => void;
};

/**
 * One set in the menu. The summary is computed with the same pure applier the
 * click runs, so what the row promises and what applying does cannot drift.
 */
function RepositorySetOption({ set, rows, repositories, onApply }: RepositorySetOptionProps) {
  const { t } = useTranslation();
  const outcome = applyRepositorySet({ rows, set, repositories });
  const fullyApplied = outcome.addedCount === 0 && outcome.alreadyPresentCount > 0;

  return (
    <DropdownMenuItem
      className="cursor-pointer flex-col items-start gap-0.5"
      data-testid="repository-set-option"
      data-fully-applied={fullyApplied ? "true" : "false"}
      onSelect={() => onApply(set)}
    >
      <span className="font-medium">{set.name}</span>
      <span className="text-xs text-muted-foreground">
        {t("task:repositorySetsMemberCount", { count: set.repositories.length })}
        {outcome.missingCount > 0
          ? ` ${t("task:repositorySetsMissingMembers", { count: outcome.missingCount })}`
          : ""}
        {fullyApplied ? ` ${t("task:repositorySetsAlreadyApplied")}` : ""}
      </span>
    </DropdownMenuItem>
  );
}
