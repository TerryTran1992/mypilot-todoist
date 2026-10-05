import { Todo } from '../types';
import { fmtDateKey } from './local';

// The desktop shows one Date per task. The API still has two fields that other clients and
// sync jobs read separately — `deadline` (when it's due) and `time_block_date` (the day its
// time block sits on) — so the desktop reads them as one and writes them together.
//
// A repeating task's deadline is its recurrence anchor (the recurring-tasks job walks forward
// from it), so timeline moves never touch it.

const NO_BLOCK = { time_block_date: null, time_block_start: null, time_block_end: null };

/** Local YYYY-MM-DD of the deadline. */
export function deadlineDay(t: Todo): string | null {
  if (!t.deadline) return null;
  // Timed deadlines are real instants, so take the local day. Date-only ones are stored at a
  // fixed clock time whose UTC date is the day (Outlook sync writes T23:59:59Z).
  return t.deadline_has_time ? fmtDateKey(new Date(t.deadline)) : t.deadline.slice(0, 10);
}

/** The task's one date: the timeline day when it has a time block, else its deadline day. */
export function taskDate(t: Todo): string | null {
  const block = t.time_block_date ? t.time_block_date.slice(0, 10) : null;
  if (block && t.time_block_start) return block;
  return deadlineDay(t) ?? block;
}

/** Fields for a date with no task to compare against; `keepTime` keeps a time block on it. */
export function dateFields(day: string | null, keepTime = false): Partial<Todo> {
  if (!day) return { deadline: null, deadline_has_time: false, ...NO_BLOCK };
  return {
    deadline: new Date(day + 'T23:59:59').toISOString(),
    deadline_has_time: false,
    time_block_date: keepTime ? day : null,
  };
}

/** Fields that move a task to `day`, keeping its time; null clears the date and the time. */
export function setDateFields(t: Todo, day: string | null): Partial<Todo> {
  // A repeating task with a time but no block day shows on every day's timeline; leave it so.
  const dailyAtTime = !!t.recurrence_frequency && !t.time_block_date;
  return dateFields(day, !!t.time_block_start && !dailyAtTime);
}

/** Fields that put a task's time block on `day` (add the start/end yourself). */
export function scheduleFields(t: Todo | undefined, day: string): Partial<Todo> {
  return t?.recurrence_frequency ? { time_block_date: day } : dateFields(day, true);
}

/** Fields that drop a task's time block but keep it on its day. A deadline it already has is
 *  left alone — it may be later than the block day, and that's the date it should fall back to. */
export function unscheduleFields(t: Todo | undefined): Partial<Todo> {
  const day = t ? taskDate(t) : null;
  if (!t || t.deadline || t.recurrence_frequency || !day) return NO_BLOCK;
  return { ...dateFields(day), ...NO_BLOCK };
}
