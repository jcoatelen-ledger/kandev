import type { KanbanState, WorkflowSnapshotData } from "@/lib/state/slices/kanban/types";
import type { TaskPendingAction, TaskSessionState } from "@/lib/types/http";

type KanbanTask = KanbanState["tasks"][number];

/**
 * One live agent conversation, projected into the shape a Threads column needs.
 *
 * Derived entirely from the workflow snapshots the board already keeps in the
 * store, so opening the Threads view costs no extra request.
 */
export type ActiveThread = {
  taskId: string;
  title: string;
  workflowId: string;
  workflowName: string;
  /** Null when the task sits in a step the snapshot no longer lists. */
  stepTitle: string | null;
  sessionId: string;
  sessionState: TaskSessionState;
  pendingAction: TaskPendingAction | null;
  activeSubagentCount: number;
  queuedPromptCount: number;
  lastActivityAt: string | null;
};

/**
 * Attention buckets. A thread blocked on a person is the one the user came to
 * this view to find, so it sorts ahead of threads the agent is still driving.
 */
const NEEDS_HUMAN = 0;
const WORKING = 1;

const WORKING_STATES: TaskSessionState[] = ["RUNNING", "STARTING"];

type ThreadSession = {
  id: string | null;
  state: TaskSessionState | null;
  pendingAction: TaskPendingAction | null;
  lastActivityAt: string | null;
};

function resolvePendingAction(task: KanbanTask): TaskPendingAction | null {
  return (
    task.statusSummary?.pending_action ??
    task.primarySessionPendingAction ??
    task.taskPendingAction ??
    null
  );
}

function resolveLastActivityAt(task: KanbanTask): string | null {
  const summary = task.statusSummary;
  return summary?.last_activity_at ?? summary?.updated_at ?? task.updatedAt ?? null;
}

/**
 * The status summary is the bounded live projection the backend pushes over
 * WebSockets, so it leads; the cached primary-session fields only fill gaps a
 * summary-less task would otherwise leave blank.
 */
function resolveThreadSession(task: KanbanTask): ThreadSession {
  const summarySession = task.statusSummary?.primary_session ?? null;
  return {
    id: summarySession?.id ?? task.primarySessionId ?? null,
    state: summarySession?.state ?? (task.primarySessionState as TaskSessionState | null) ?? null,
    pendingAction: resolvePendingAction(task),
    lastActivityAt: resolveLastActivityAt(task),
  };
}

function attentionBucket(session: {
  state: TaskSessionState | null | undefined;
  pendingAction?: TaskPendingAction | null;
}): number | null {
  if (session.pendingAction || session.state === "WAITING_FOR_INPUT") return NEEDS_HUMAN;
  return session.state && WORKING_STATES.includes(session.state) ? WORKING : null;
}

/**
 * Whether one session is the thread the deck would give a column to.
 *
 * The deck keys columns by task and renders the task's primary session, so a
 * non-primary session has no column of its own however busy it is. Surfaces
 * that offer to jump into the deck ask this first, so they never point at a
 * column that is not there.
 */
export function isActiveThreadSession(session: {
  isPrimary: boolean;
  state: TaskSessionState | null | undefined;
  pendingAction?: TaskPendingAction | null;
}): boolean {
  if (!session.isPrimary) return false;
  return attentionBucket(session) !== null;
}

/**
 * The column a deep link asked to focus, or null when that task is not in the
 * deck — it may have settled between the link being offered and followed.
 */
export function resolveFocusedThreadId(
  threads: readonly ActiveThread[],
  requestedTaskId: string | null | undefined,
): string | null {
  if (!requestedTaskId) return null;
  return threads.some((thread) => thread.taskId === requestedTaskId) ? requestedTaskId : null;
}

function toThread(
  task: KanbanTask,
  snapshot: WorkflowSnapshotData,
  stepTitles: Map<string, string>,
): (ActiveThread & { bucket: number }) | null {
  if (task.isArchived) return null;
  const session = resolveThreadSession(task);
  const bucket = attentionBucket(session);
  // A thread with no session id has no conversation to render, so a column for
  // it would be an empty promise rather than a view of live work.
  if (bucket === null || !session.id || !session.state) return null;
  return {
    bucket,
    taskId: task.id,
    title: task.title,
    workflowId: snapshot.workflowId,
    workflowName: snapshot.workflowName,
    stepTitle: stepTitles.get(task.workflowStepId) ?? null,
    sessionId: session.id,
    sessionState: session.state,
    pendingAction: session.pendingAction,
    activeSubagentCount: task.statusSummary?.active_subagent_count ?? task.activeSubagentCount ?? 0,
    queuedPromptCount: task.statusSummary?.queued_prompt_count ?? 0,
    lastActivityAt: session.lastActivityAt,
  };
}

function activityRank(thread: ActiveThread): number {
  const parsed = thread.lastActivityAt ? Date.parse(thread.lastActivityAt) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Columns must not reshuffle under the reader between renders, so ordering is
 * total: bucket, then recency, then a task-id tiebreak.
 */
function compareThreads(
  a: ActiveThread & { bucket: number },
  b: ActiveThread & { bucket: number },
): number {
  if (a.bucket !== b.bucket) return a.bucket - b.bucket;
  const recency = activityRank(b) - activityRank(a);
  if (recency !== 0) return recency;
  return a.taskId.localeCompare(b.taskId);
}

export function selectActiveThreads(
  snapshots: Record<string, WorkflowSnapshotData>,
  options: { workflowId?: string | null } = {},
): ActiveThread[] {
  const scoped = Object.values(snapshots).filter(
    (snapshot) => !options.workflowId || snapshot.workflowId === options.workflowId,
  );

  const threads = scoped.flatMap((snapshot) => {
    const stepTitles = new Map(snapshot.steps.map((step) => [step.id, step.title]));
    return snapshot.tasks
      .map((task) => toThread(task, snapshot, stepTitles))
      .filter((thread): thread is ActiveThread & { bucket: number } => thread !== null);
  });

  return threads.sort(compareThreads).map(({ bucket: _bucket, ...thread }) => thread);
}
