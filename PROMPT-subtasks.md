# Prompt: Implement Subtasks — "Break It Up Into Small, Actionable Tasks"

## Context

MyPilot Todoist is an Electron + React desktop app for task management. Users currently create flat tasks with no hierarchy. This feature adds **subtasks** — the ability to break any task into smaller, actionable steps — so users can decompose large tasks right where they manage them.

**Core UX principle:** Subtasks live inside the parent task's detail panel. They are lightweight (title + checkbox only), inline-editable, and keyboard-driven. A parent task shows a progress indicator wherever it appears in the app.

---

## Tech Stack (existing)

- **Framework**: Electron 33 + React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 3.4 (dark theme, accent `#22C55E`)
- **State**: Custom pub/sub store with localStorage cache + offline sync queue
- **API**: `https://api.mypilot.life` via Electron IPC bridge (`window.api.request`)
- **Drag & Drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Auth**: Bearer token in localStorage, auto-refresh
- **Offline**: Optimistic updates with temp IDs (`temp_*`), queue in localStorage, drain on reconnect

---

## Current Architecture (key files)

### Types (`src/types.ts`)
```typescript
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Category = 'work' | 'personal' | 'family' | 'health' | 'learning';
export type EnergyType = 'deep_focus' | 'quick_win';
export type DelegationStatus = 'delegated' | 'in_progress' | 'done';

export type Todo = {
  id: string;
  title: string;
  content?: string | null;
  priority: Priority;
  priority_score?: number;
  is_completed: boolean;
  is_pinned: boolean;
  created_at: string;
  completed_at?: string | null;
  energy_type?: EnergyType | null;
  category?: Category | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  deadline?: string | null;
  time_block_date?: string | null;
  time_block_start?: string | null;
  time_block_end?: string | null;
  time_block_order?: number | null;
  delegatable?: boolean;
  delegated_to?: string | null;
  delegation_status?: DelegationStatus | null;
  delegated_at?: string | null;
  follow_up_days?: number | null;
};
```

### State Management (`src/store/todos.ts`)
- Module-level `cache: Todo[]` with `listeners` set for pub/sub
- `setCache(next)` → updates cache + localStorage (`mypilot_todos_cache`) + notifies listeners
- `useTodos()` hook returns `{ todos, loading, error, setError, refresh }`
- `createTodo(input)` — optimistic create with temp ID, enqueues on network error
- `updateTodo(id, patch)` — optimistic update, enqueues on network error
- `deleteTodo(id)` — optimistic delete, enqueues on network error
- `toggleComplete(t)` — toggles `is_completed` + sets `completed_at`
- `drainQueue()` — flushes offline queue, remaps temp IDs
- `refreshFromServer()` — background fetch, preserves temp entries

### Offline Queue (`src/lib/sync.ts`)
```typescript
export type QueueOp =
  | { kind: 'create'; tempId: string; body: { title: string; priority?: Todo['priority'] } }
  | { kind: 'update'; id: string; patch: Partial<Todo> }
  | { kind: 'delete'; id: string };
```

### API Client (`src/lib/api.ts`)
```typescript
const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
```
- Server envelope: `{ success?: boolean; data?: T; message?: string; error?: string }`
- `NetworkError` thrown when offline (status 0)
- `ApiError` for server errors
- Auto token refresh on 401

### Task Detail Panel (`src/components/TaskDetail.tsx`)
- Right-side sliding panel (fixed overlay, `max-w-md`)
- Uses `useSelectedId()` from `src/store/selection.ts` to track which task is open
- Sections: title input, notes textarea, priority pills, category pills, energy toggle, delegation, deadline, estimate, comments
- Comments loaded on-demand via `GET /todos/{id}/comments`
- `patch(p)` helper calls `updateTodo(todo.id, p)` on blur/change
- `Field` component for labeled sections
- `Pills` component for selectable pill buttons

### Task Row (`src/components/TodoRow.tsx`)
- Renders: checkbox + title (clickable → opens TaskDetail) + priority badge + delete button
- Props: `{ t: Todo; onError: (msg: string) => void }`

### Views (`src/views/`)
| View | File | Shortcut | Uses TodoRow? |
|------|------|----------|---------------|
| Brain Dump | `BrainDump.tsx` | ⌘1 | No (custom rapid capture) |
| Today | `Today.tsx` | ⌘2 | No (custom Card with drag) |
| Weekly | `Weekly.tsx` | ⌘3 | No (custom Row with sizing) |
| Matrix | `Matrix.tsx` | ⌘4 | No (custom drag cards) |
| Delegation | `Delegation.tsx` | ⌘5 | No (custom kanban cards) |
| Inbox | `Inbox.tsx` | ⌘6 | Yes (TodoRow) |
| Completed | `Completed.tsx` | ⌘7 | Yes (TodoRow) |

### Layout (`src/pages/Home.tsx`)
- Titlebar with sidebar toggle + online/offline indicator
- Sidebar + main view area
- `QuickCapture` modal (⌘N) and `TaskDetail` overlay rendered at root level

---

## API Endpoints for Subtasks

The API supports subtasks as nested resources under a parent todo:

```
GET    /todos/{id}/subtasks           → Subtask[]
POST   /todos/{id}/subtasks           → Subtask      (body: { title: string })
PUT    /todos/{id}/subtasks/{subId}   → Subtask      (body: { title?: string; is_completed?: boolean; order?: number })
DELETE /todos/{id}/subtasks/{subId}   → void
```

**Subtask response shape:**
```typescript
type Subtask = {
  id: string;
  todo_id: string;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
  completed_at: string | null;
};
```

If the API does not yet support these endpoints (returns 404), implement the feature with **localStorage-only storage** as a fallback, using the same data shape. The UI should work identically in both modes. When the API becomes available, the localStorage data can be migrated.

---

## What to Build

### 1. Subtask Type Definition

**File: `src/types.ts`**

Add the `Subtask` type:

```typescript
export type Subtask = {
  id: string;
  todo_id: string;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
  completed_at: string | null;
};
```

---

### 2. Subtask Store

**File: `src/store/subtasks.ts`** (new file)

Follow the same pub/sub + cache pattern as `todos.ts`. Key behaviors:

- **Cache**: `mypilot_subtasks_cache` in localStorage — a `Record<string, Subtask[]>` keyed by parent todo ID
- **Listener pattern**: per-todo listeners so only the relevant TaskDetail re-renders
- **Optimistic creates/updates/deletes** with temp IDs (same `temp_` prefix pattern)
- **Offline queue**: reuse the existing sync queue pattern, or maintain a separate `mypilot_subtasks_queue`

**Exports:**

```typescript
// Hook: subscribe to subtasks for a specific todo
export function useSubtasks(todoId: string): {
  subtasks: Subtask[];
  loading: boolean;
  error: string | null;
}

// Actions
export async function createSubtask(todoId: string, title: string): Promise<Subtask>
export async function updateSubtask(todoId: string, subId: string, patch: Partial<Subtask>): Promise<Subtask>
export async function deleteSubtask(todoId: string, subId: string): Promise<void>
export async function toggleSubtask(todoId: string, sub: Subtask): Promise<Subtask>
export async function reorderSubtasks(todoId: string, subtaskIds: string[]): Promise<void>
```

**Fetch strategy:** Load subtasks on-demand when TaskDetail opens (same pattern as Comments). Cache per parent ID so re-opening is instant.

**API-first with localStorage fallback:**
```typescript
async function fetchSubtasks(todoId: string): Promise<Subtask[]> {
  try {
    return await api.get<Subtask[]>(`/todos/${todoId}/subtasks`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // API not available yet — use localStorage
      return loadLocalSubtasks(todoId);
    }
    throw err;
  }
}
```

---

### 3. Subtask List Component

**File: `src/components/SubtaskList.tsx`** (new file)

A self-contained component rendered inside `TaskDetail.tsx`, between the existing fields and the Comments section.

**Layout:**
```
┌─ SUBTASKS ─────────────── 2/5 ─┐
│ ✅ Buy groceries              ✕ │
│ ✅ Clean kitchen              ✕ │
│ ○  Call dentist               ✕ │
│ ○  Review budget              ✕ │
│ ○  Book flights               ✕ │
│ ┌─────────────────────────────┐ │
│ │ Add a subtask... (Enter)    │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Props:**
```typescript
type SubtaskListProps = {
  todoId: string;
  isParentTemp: boolean; // true if parent has temp ID (not yet synced)
};
```

**Behaviors:**

1. **Display**: List all subtasks ordered by `order` field. Completed subtasks show strikethrough text but stay in place (don't move to bottom)

2. **Add subtask**: Input field at bottom. Press Enter to create, clear input, keep focus for rapid entry. Disabled if parent is temp ID (show "Save the task first to add subtasks")

3. **Toggle complete**: Click checkbox → `toggleSubtask()`. Completed subtasks get `completed_at` timestamp

4. **Inline edit**: Click subtask title → turns into editable input. Save on blur or Enter. Cancel on Escape (revert to original text)

5. **Delete**: Small `✕` button on hover (same pattern as TodoRow delete button)

6. **Reorder**: Drag handle on the left side using `@dnd-kit/sortable`. Reorder updates the `order` field for all affected subtasks

7. **Progress counter**: Header shows "SUBTASKS · 2/5" (completed/total). If no subtasks exist yet, just show "SUBTASKS"

8. **Keyboard shortcuts** within the subtask input:
   - **Enter**: Create subtask
   - **Escape**: Blur input
   - **Shift+Enter**: Create and close (navigate focus back to parent title)

**Styling (match existing TaskDetail patterns):**
```
Section label:   text-[11px] uppercase tracking-wide text-zinc-500
Subtask row:     flex items-center gap-2 py-1.5 group
Checkbox:        w-4 h-4 rounded-full border (same as TodoRow but smaller)
  unchecked:     border-zinc-600 hover:border-accent
  checked:       bg-accent border-accent + check icon
Title:           text-sm text-zinc-100 (completed: line-through text-zinc-500)
Delete button:   text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100
Input field:     bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm
                 focus:border-accent focus:outline-none
Drag handle:     text-zinc-700 hover:text-zinc-400 cursor-grab
```

---

### 4. Progress Indicator on Parent Tasks

Show subtask progress wherever the parent task appears in the app.

**Approach:** Extend the `Todo` type with optional client-side subtask metadata, OR compute progress from the subtask cache.

**Option A (recommended) — Compute from cache:**

Create a helper that reads from the subtask cache:

```typescript
// src/store/subtasks.ts
export function getSubtaskProgress(todoId: string): { done: number; total: number } | null
```

Returns `null` if no subtasks are cached for this todo (don't show indicator). Returns `{ done, total }` if subtasks exist.

**Where to show progress:**

1. **TodoRow** (`src/components/TodoRow.tsx`): Add a small pill after the title showing `2/5` with a mini progress bar or fraction text

   ```
   ○  Prepare dinner party  [███░░ 3/5]  high  🗑
   ```

   Styling: `text-[10px] text-zinc-500` with a tiny inline bar using `bg-accent` for filled portion

2. **Today view cards** (`src/views/Today.tsx`): Add progress indicator below the card title

3. **Matrix view cards** (`src/views/Matrix.tsx`): Show fraction in card corner

4. **Inbox/Completed** (via TodoRow): Automatic since TodoRow handles it

**Progress bar micro-component:**
```typescript
function SubtaskProgress({ todoId }: { todoId: string }) {
  const progress = getSubtaskProgress(todoId);
  if (!progress || progress.total === 0) return null;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
      <span className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <span
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </span>
      {progress.done}/{progress.total}
    </span>
  );
}
```

---

### 5. Auto-Complete Parent When All Subtasks Done

When the last subtask is checked off (all subtasks completed), prompt the user:

```
┌──────────────────────────────────┐
│ All subtasks done! ✓             │
│ Complete the parent task too?    │
│                                  │
│   [Not yet]     [Complete ✓]     │
└──────────────────────────────────┘
```

**Implementation:** After `toggleSubtask()`, check if all subtasks are now completed. If yes, show a small inline banner within the SubtaskList component (not a modal). Auto-dismiss after 5 seconds if no action taken.

Do NOT auto-complete the parent — always ask. The user might have subtasks as a checklist within a larger ongoing task.

---

### 6. Preload Subtask Counts on Refresh

To show progress indicators without loading every subtask list, extend the main todo fetch.

**Option A (if API supports it):** The `GET /todos?limit=200` response includes `subtask_count` and `subtask_completed_count` fields on each todo. Add these optional fields to the `Todo` type:

```typescript
// Add to Todo type
subtask_count?: number;
subtask_completed_count?: number;
```

**Option B (localStorage only):** On app startup, scan the `mypilot_subtasks_cache` localStorage and build a count map. This is instant since it reads from local storage.

Use whichever the API supports. The progress indicator should work with either source.

---

### 7. Integration Points (modify existing files)

**`src/components/TaskDetail.tsx`:**
- Import and render `<SubtaskList todoId={todo.id} isParentTemp={isTempId(todo.id)} />` between the Estimate field and the Comments section
- Add a `border-t border-zinc-900 pt-4` separator above it (same pattern as Comments)

**`src/components/TodoRow.tsx`:**
- Import `SubtaskProgress` component
- Render it between the title and the priority badge:
  ```tsx
  <button onClick={() => openTask(t.id)} className="...">
    {t.title}
  </button>
  <SubtaskProgress todoId={t.id} />  {/* NEW */}
  {t.priority !== 'medium' && <span>...</span>}
  ```

**`src/views/Today.tsx`** (inside the Card component):
- Add `<SubtaskProgress todoId={t.id} />` below the task title text

**`src/views/Matrix.tsx`** (inside the drag card):
- Add `<SubtaskProgress todoId={t.id} />` in the card body

**`src/store/todos.ts`:**
- When `toggleComplete` marks a parent as completed, also mark all its incomplete subtasks as completed (cascade complete)
- When a parent is deleted via `deleteTodo`, clear its subtasks from the cache

---

## Implementation Priority

| # | What | Effort | Files |
|---|------|--------|-------|
| 1 | Subtask type + store | 2 hrs | `types.ts`, `store/subtasks.ts` (new) |
| 2 | SubtaskList component | 3 hrs | `components/SubtaskList.tsx` (new) |
| 3 | Integrate into TaskDetail | 30 min | `components/TaskDetail.tsx` |
| 4 | Progress indicator | 1 hr | `components/SubtaskProgress.tsx` (new) |
| 5 | Add progress to TodoRow | 30 min | `components/TodoRow.tsx` |
| 6 | Add progress to view cards | 1 hr | `views/Today.tsx`, `views/Matrix.tsx` |
| 7 | Drag-to-reorder subtasks | 1 hr | `components/SubtaskList.tsx` |
| 8 | Auto-complete prompt | 30 min | `components/SubtaskList.tsx` |
| 9 | Cascade behaviors | 30 min | `store/todos.ts` |

**Total: ~10 hours**

---

## Interaction Flows

### Creating subtasks
1. User clicks a task → TaskDetail opens
2. Scrolls to "SUBTASKS" section
3. Types in "Add a subtask..." input → Enter
4. Subtask appears above the input with checkbox unchecked
5. Input clears, stays focused — user can type the next one immediately
6. Each creation fires an optimistic update (instant UI) + API call

### Checking off subtasks
1. User clicks subtask checkbox → strikethrough + accent check
2. Progress indicator updates everywhere (TodoRow, view cards)
3. If all subtasks are now done → inline prompt appears: "Complete parent task too?"
4. User clicks "Complete" or "Not yet"

### Editing subtasks
1. User clicks subtask title text → text becomes editable input
2. User edits → blur or Enter saves
3. Escape reverts to original text

### Reordering subtasks
1. User grabs the drag handle (left side grip dots)
2. Drags subtask up or down within the list
3. On drop, `reorderSubtasks()` sends new order to API

### Offline behavior
1. All subtask operations work offline (optimistic + queue)
2. Subtask cache persists in localStorage
3. On reconnect, subtask queue drains alongside main todo queue

---

## Design Tokens Reference

```
Backgrounds:     zinc-950 (darkest), zinc-900, zinc-800
Text:            white, zinc-100, zinc-300, zinc-500, zinc-600
Accent:          #22C55E (green) — used for active states, checkmarks, progress bars
Priority colors: urgent=red-900, high=orange-900, medium=zinc-700, low=zinc-800
Borders:         border-zinc-800 (main), border-zinc-900 (subtle)
Labels:          text-[11px] uppercase tracking-wide text-zinc-500
Inputs:          bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-accent
Buttons:         cursor-pointer transition
Hover reveal:    opacity-0 group-hover:opacity-100
```

---

## Testing Checklist

- [ ] Create a subtask from TaskDetail — appears in list immediately
- [ ] Create multiple subtasks rapidly (Enter → type → Enter → type)
- [ ] Toggle subtask complete/incomplete — checkbox + strikethrough toggle
- [ ] Progress indicator shows in TodoRow (Inbox view)
- [ ] Progress indicator shows in Today view cards
- [ ] Progress indicator shows in Matrix view cards
- [ ] Progress updates live when subtask toggled (no refresh needed)
- [ ] Inline edit subtask title — blur saves, Escape reverts
- [ ] Delete subtask — removed from list immediately
- [ ] Drag to reorder subtasks — order persists
- [ ] All subtasks done → "Complete parent?" prompt appears
- [ ] Complete parent → cascades to mark remaining subtasks done
- [ ] Delete parent → subtask cache cleared
- [ ] Subtask with temp parent ID shows "Save the task first" message
- [ ] Offline: create subtask → works optimistically → syncs on reconnect
- [ ] Refresh page → subtask cache loads from localStorage → no flash
- [ ] Open TaskDetail for task with subtasks → subtasks load from API (or cache)
