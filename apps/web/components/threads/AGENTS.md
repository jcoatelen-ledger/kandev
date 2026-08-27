# Threads deck

`/threads` renders one column per live agent conversation, TweetDeck-style.

`selectActiveThreads` (`lib/threads/active-threads.ts`) derives the columns from
the workflow snapshots the board already keeps in the store, so opening the view
costs no extra request and stays live on the same WebSocket updates the cards
use. Ordering is total (attention bucket, then recency, then task id) because a
column must not shuffle under the reader.

A task reaches the deck only through its **primary** session, matching the
backend's `GetPrimarySessionIDsByTaskIDs`. Sessions created by the E2E seed
harness are never primary, so a spec has to run a real agent turn (create the
task with an agent, open the task page to launch the session, then wait) rather
than seeding a RUNNING row.

Columns mount `TaskChatPanel` with `isVisible={false}`, for the same reason the
kanban preview does: a wall of columns is a glance across running work, and
letting every mounted column advance its own read cursor would mark threads read
that nobody looked at.

## Adding a task-listing view

`kanban`, `pipeline`, `list` and `threads` share one device-local preference in
`lib/task-listing/view-preference.ts`. `resolveTaskListingNavigation`
(`lib/task-listing/view-navigation.ts`) is the single mapping from a toggle pick
to the view to remember and the page to go to; the desktop topbar
(`components/kanban/kanban-header.tsx`) and the phone menu sheet
(`hooks/use-mobile-menu-sheet-state.ts`) both call it, so a new view means one
entry there plus a toggle item on each surface.

A view that owns its own route also needs an entry in
`ROUTED_TASK_LISTING_VIEWS`, so Home hands off to it instead of rendering the
board, and one in `lib/navigation/core-destinations.ts` — a guardrail test fails
when a top-level route has no navigation destination. `currentPage` is
`TaskListingPage` internally; `toPluginTopBarPage` narrows it to the two values
the plugin contract has always published.
