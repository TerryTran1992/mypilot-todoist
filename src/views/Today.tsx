import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useTodos, toggleComplete, updateTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { EnergyType, Todo } from '../types';
import { DailyPlan, getPlan, setPlan, todayKey, tomorrowKey } from '../lib/local';
import { byScore } from '../lib/sort';
import { useFuzzyFilter } from '../lib/fuzzy';
import Icon from '../components/Icon';
import SubtaskProgress from '../components/SubtaskProgress';

type Slot = 'big' | 'medium' | 'small';
const POOL_ID = 'planner-pool';
const TIMELINE_ID = 'timeline-drop';
const START_HOUR = 5;
const END_HOUR = 23;
const HOUR_HEIGHT = 72;
const SNAP_MINUTES = 15;
const DEFAULT_DURATION = 60;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const LIMITS: Record<Slot, number> = { big: 1, medium: 3, small: 5 };

type SlotMeta = {
  title: string;
  subtitle: string;
  chip: string;
  defaultMinutes: number;
  energy: EnergyType;
  start: string;
  end: string;
  dot: string;
};

const SLOT_META: Record<Slot, SlotMeta> = {
  big: {
    title: 'The One Big Thing',
    subtitle: '2–4 hours focused work',
    chip: 'Big',
    defaultMinutes: 180,
    energy: 'deep_focus',
    start: '05:00',
    end: '08:00',
    dot: 'bg-purple-500',
  },
  medium: {
    title: '3 Medium Wins',
    subtitle: '30–60 min each',
    chip: 'Med',
    defaultMinutes: 45,
    energy: 'deep_focus',
    start: '08:00',
    end: '11:00',
    dot: 'bg-blue-500',
  },
  small: {
    title: '5 Quick Hits',
    subtitle: '5–15 min each',
    chip: 'Quick',
    defaultMinutes: 10,
    energy: 'quick_win',
    start: '13:00',
    end: '18:00',
    dot: 'bg-yellow-500',
  },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

function timeToY(time: string): number {
  return ((timeToMinutes(time) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function durationToHeight(start: string, end: string): number {
  return Math.max(((timeToMinutes(end) - timeToMinutes(start)) / 60) * HOUR_HEIGHT, 28);
}

function fmtTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${pad(m)} ${ampm}`;
}

function formatDate(key: string) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function normalizeDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

function getOrganizer(content?: string | null): string | null {
  if (!content) return null;
  const match = content.match(/^Organizer: (.+)$/m);
  return match ? match[1] : null;
}

function suggestedSlot(minutes: number | null | undefined): Slot {
  const m = minutes ?? 0;
  if (m >= 90) return 'big';
  if (m >= 30) return 'medium';
  return 'small';
}

function snapMinutes(raw: number): number {
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(START_HOUR * 60, Math.min((END_HOUR - 1) * 60, snapped));
}

type LayoutItem = {
  todo: Todo;
  start: number;
  end: number;
  column: number;
  totalColumns: number;
};

function layoutEvents(todos: Todo[]): LayoutItem[] {
  const items = todos
    .map((t) => ({
      todo: t,
      start: timeToMinutes(t.time_block_start!),
      end: timeToMinutes(t.time_block_end!),
      column: 0,
      totalColumns: 1,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const groups: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let groupEnd = 0;

  for (const item of items) {
    if (current.length === 0 || item.start < groupEnd) {
      current.push(item);
      groupEnd = Math.max(groupEnd, item.end);
    } else {
      groups.push(current);
      current = [item];
      groupEnd = item.end;
    }
  }
  if (current.length > 0) groups.push(current);

  const result: LayoutItem[] = [];
  for (const group of groups) {
    const cols: number[] = [];
    for (const item of group) {
      let col = cols.findIndex((e) => e <= item.start);
      if (col === -1) {
        col = cols.length;
        cols.push(0);
      }
      cols[col] = item.end;
      result.push({ ...item, column: col, totalColumns: 0 });
    }
    const maxCols = cols.length;
    for (let i = result.length - group.length; i < result.length; i++) {
      result[i].totalColumns = maxCols;
    }
  }

  return result;
}

function EstimateBadge({ minutes }: { minutes?: number | null }) {
  if (!minutes) return null;
  const label =
    minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h` : `${minutes}m`;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
      {label}
    </span>
  );
}

function TimelineEvent({
  item,
  onToggle,
  onUnschedule,
}: {
  item: LayoutItem;
  onToggle: (t: Todo) => void;
  onUnschedule: (id: string) => void;
}) {
  const t = item.todo;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const isMeeting = (t.category as string) === 'meeting';
  const top = timeToY(t.time_block_start!);
  const height = durationToHeight(t.time_block_start!, t.time_block_end!);
  const gap = 2;
  const colWidth =
    item.totalColumns > 1
      ? (100 - gap * (item.totalColumns - 1)) / item.totalColumns
      : 100;
  const left = item.column * (colWidth + gap);
  const organizer = isMeeting ? getOrganizer(t.content) : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group absolute rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-30' : ''
      } ${
        isMeeting
          ? 'bg-teal-950/70 border-l-[3px] border-l-teal-500 border-t-teal-900/60 border-r-teal-900/60 border-b-teal-900/60'
          : t.is_completed
          ? 'bg-zinc-900/60 border-l-[3px] border-l-zinc-600 border-t-zinc-800/40 border-r-zinc-800/40 border-b-zinc-800/40'
          : 'bg-emerald-950/40 border-l-[3px] border-l-accent border-t-emerald-900/30 border-r-emerald-900/30 border-b-emerald-900/30'
      }`}
      style={{
        top,
        height: Math.max(height, 28),
        left: `${left}%`,
        width: `${colWidth}%`,
        zIndex: 10,
      }}
    >
      <div className="flex flex-col h-full px-2.5 py-1.5 min-w-0">
        <div className="flex items-start gap-1.5 min-w-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onToggle(t)}
            className={`w-3.5 h-3.5 mt-0.5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition ${
              t.is_completed ? 'bg-accent border-accent' : 'border-zinc-500 hover:border-accent'
            }`}
          >
            {t.is_completed && <Icon name="check" size={8} className="text-black" />}
          </button>
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openTask(t.id)}
            className={`flex-1 truncate cursor-pointer leading-tight text-xs font-medium ${
              t.is_completed
                ? 'line-through text-zinc-500'
                : isMeeting
                ? 'text-teal-100'
                : 'text-zinc-100'
            }`}
          >
            {t.title}
          </span>
          {!isMeeting && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onUnschedule(t.id)}
              title="Remove from calendar"
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-white shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="x" size={10} />
            </button>
          )}
        </div>
        {height >= 44 && organizer && (
          <span className="text-[10px] text-teal-400/70 truncate mt-0.5">{organizer}</span>
        )}
        {height >= 56 && (
          <div className="flex items-center gap-2 mt-auto">
            <span
              className={`text-[10px] ${isMeeting ? 'text-teal-400/60' : 'text-zinc-500'}`}
            >
              {fmtTime12(t.time_block_start!)} – {fmtTime12(t.time_block_end!)}
            </span>
            <SubtaskProgress todoId={t.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function PoolCard({
  t,
  onAssign,
  capacity,
}: {
  t: Todo;
  onAssign: (slot: Slot) => void;
  capacity: Record<Slot, boolean>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const suggested = suggestedSlot(t.estimated_minutes);
  return (
    <div
      ref={setNodeRef}
      className={`bg-zinc-900 border border-zinc-800 rounded-lg text-sm overflow-hidden ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          {...listeners}
          {...attributes}
          onClick={() => openTask(t.id)}
          className="flex-1 truncate cursor-grab select-none text-zinc-100 hover:text-accent transition"
        >
          {t.title}
        </span>
        <SubtaskProgress todoId={t.id} />
        <EstimateBadge minutes={t.estimated_minutes} />
      </div>
      <div className="flex border-t border-zinc-800 divide-x divide-zinc-800">
        {(['big', 'medium', 'small'] as Slot[]).map((slot) => {
          const isSuggested = slot === suggested;
          const enabled = capacity[slot];
          return (
            <button
              key={slot}
              onClick={() => onAssign(slot)}
              disabled={!enabled}
              title={
                enabled
                  ? `Add to ${SLOT_META[slot].title}${isSuggested ? ' (suggested)' : ''}`
                  : `${SLOT_META[slot].title} is full`
              }
              className={`flex-1 text-[10px] py-1 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isSuggested && enabled
                  ? 'bg-accent/15 text-accent hover:bg-accent/25'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {SLOT_META[slot].chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelineDrop({
  contentRef,
  dragId,
  children,
}: {
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  dragId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TIMELINE_ID });
  return (
    <div
      ref={(el) => {
        contentRef.current = el;
        setNodeRef(el);
      }}
      className={`relative ml-2 transition-colors ${
        isOver && dragId ? 'bg-accent/[0.03]' : ''
      }`}
      style={{ height: TOTAL_HOURS * HOUR_HEIGHT + 20 }}
    >
      {children}
    </div>
  );
}

function PoolDrop({
  dragId,
  children,
}: {
  dragId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 border-l border-zinc-900 bg-zinc-950 flex flex-col transition ${
        isOver && dragId ? 'outline outline-2 outline-accent/60' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function Planner() {
  const { todos, loading, error, setError } = useTodos();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [{ date, plan }, setDayState] = useState(() => {
    const d = todayKey();
    return { date: d, plan: getPlan(d) };
  });

  function setLocalPlan(next: DailyPlan | ((prev: DailyPlan) => DailyPlan)) {
    setDayState((s) => ({
      date: s.date,
      plan: typeof next === 'function' ? (next as (p: DailyPlan) => DailyPlan)(s.plan) : next,
    }));
  }

  useEffect(() => {
    const target = day === 'today' ? todayKey() : tomorrowKey();
    setDayState({ date: target, plan: getPlan(target) });
  }, [day]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTime, setDropTime] = useState<string | null>(null);
  const [filterSlot, setFilterSlot] = useState<Slot | null>(null);
  const [search, setSearch] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    setPlan(date, plan);
  }, [date, plan]);

  useEffect(() => {
    const ids = new Set(todos.map((t) => t.id));
    setLocalPlan((p) => ({
      bigTask: p.bigTask && ids.has(p.bigTask) ? p.bigTask : undefined,
      mediumTasks: p.mediumTasks.filter((id) => ids.has(id)),
      smallTasks: p.smallTasks.filter((id) => ids.has(id)),
      reflection: p.reflection,
    }));
  }, [todos]);

  useEffect(() => {
    if (!timelineRef.current || loading) return;
    const now = new Date();
    const y = ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    timelineRef.current.scrollTop = Math.max(0, y - 120);
  }, [loading]);

  // Track pointer position during drag for time calculation
  useEffect(() => {
    if (!dragId) {
      setDropTime(null);
      return;
    }
    function handler(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY };

      const el = contentRef.current;
      const scrollEl = timelineRef.current;
      if (!el || !scrollEl) return;

      const scrollRect = scrollEl.getBoundingClientRect();
      const contentRect = el.getBoundingClientRect();

      // Check if pointer is over the timeline area
      if (
        e.clientX >= scrollRect.left &&
        e.clientX <= scrollRect.right &&
        e.clientY >= scrollRect.top &&
        e.clientY <= scrollRect.bottom
      ) {
        const y = e.clientY - contentRect.top;
        const rawMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
        setDropTime(minutesToTime(snapMinutes(rawMinutes)));
      } else {
        setDropTime(null);
      }
    }
    window.addEventListener('pointermove', handler);
    return () => window.removeEventListener('pointermove', handler);
  }, [dragId]);

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);

  const assignedIds = useMemo(() => {
    const s = new Set<string>();
    if (plan.bigTask) s.add(plan.bigTask);
    plan.mediumTasks.forEach((id) => s.add(id));
    plan.smallTasks.forEach((id) => s.add(id));
    return s;
  }, [plan]);

  const otherDayAssigned = useMemo(() => {
    const otherDate = day === 'today' ? tomorrowKey() : todayKey();
    const other = getPlan(otherDate);
    const s = new Set<string>();
    if (other.bigTask) s.add(other.bigTask);
    other.mediumTasks.forEach((id) => s.add(id));
    other.smallTasks.forEach((id) => s.add(id));
    return s;
  }, [day, plan]);

  const scheduled = useMemo(() => {
    const result: Todo[] = [];
    for (const t of todos) {
      if (!t.time_block_start || t.is_completed) continue;
      const end = t.time_block_end || (t.estimated_minutes ? minutesToTime(timeToMinutes(t.time_block_start) + t.estimated_minutes) : null);
      if (!end) continue;
      const onDate = normalizeDate(t.time_block_date) === date;
      const recurringNoDate = !t.time_block_date && !!t.recurrence_frequency;
      if (onDate || recurringNoDate) {
        result.push(t.time_block_end ? t : { ...t, time_block_end: end, time_block_date: date });
      }
    }
    return result;
  }, [todos, date]);

  const layout = useMemo(() => layoutEvents(scheduled), [scheduled]);

  const scheduledIds = useMemo(() => new Set(scheduled.map((t) => t.id)), [scheduled]);

  const allLabeledPool = useMemo(
    () =>
      todos
        .filter(
          (t) =>
            !t.is_completed &&
            !assignedIds.has(t.id) &&
            !otherDayAssigned.has(t.id) &&
            !scheduledIds.has(t.id) &&
            !!t.estimated_minutes &&
            !t.time_block_date &&
            !t.time_block_start,
        )
        .sort(byScore),
    [todos, assignedIds, otherDayAssigned, scheduledIds],
  );

  const slotFiltered = useMemo(() => {
    if (!filterSlot) return allLabeledPool;
    return allLabeledPool.filter((t) => suggestedSlot(t.estimated_minutes) === filterSlot);
  }, [allLabeledPool, filterSlot]);

  const pool = useFuzzyFilter(slotFiltered, search, ['title', 'content']);

  const unlabeledCount = useMemo(
    () => todos.filter((t) => !t.is_completed && !t.estimated_minutes).length,
    [todos],
  );

  const onToggle = useCallback(
    async (t: Todo) => {
      try {
        await toggleComplete(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
      }
    },
    [setError],
  );

  const onUnschedule = useCallback(
    (id: string) => {
      setLocalPlan(removeFromPlan(id));
      void updateTodo(id, {
        time_block_date: null,
        time_block_start: null,
        time_block_end: null,
      });
    },
    [plan, date],
  );

  const hours = useMemo(() => {
    const result: string[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      result.push(`${pad(h)}:00`);
    }
    return result;
  }, []);

  function removeFromPlan(id: string): DailyPlan {
    return {
      bigTask: plan.bigTask === id ? undefined : plan.bigTask,
      mediumTasks: plan.mediumTasks.filter((x) => x !== id),
      smallTasks: plan.smallTasks.filter((x) => x !== id),
      reflection: plan.reflection,
    };
  }

  function nextAvailableTime(slot: Slot): string {
    const meta = SLOT_META[slot];
    const zoneStart = timeToMinutes(meta.start);
    const zoneEnd = timeToMinutes(meta.end);
    const tasksInZone = scheduled
      .filter((t) => {
        const s = timeToMinutes(t.time_block_start!);
        return s >= zoneStart && s < zoneEnd;
      })
      .sort(
        (a, b) =>
          timeToMinutes(a.time_block_start!) - timeToMinutes(b.time_block_start!),
      );

    if (tasksInZone.length === 0) return meta.start;
    const lastEnd = Math.max(
      ...tasksInZone.map((t) => timeToMinutes(t.time_block_end!)),
    );
    return minutesToTime(Math.min(lastEnd, zoneEnd));
  }

  function assignTo(slot: Slot, todoId: string) {
    const cleaned = removeFromPlan(todoId);
    const todo = byId.get(todoId);
    const duration = todo?.estimated_minutes || SLOT_META[slot].defaultMinutes;
    const startTime = nextAvailableTime(slot);
    const startMins = timeToMinutes(startTime);
    const endMins = Math.min(startMins + duration, END_HOUR * 60);
    const meta = SLOT_META[slot];

    if (slot === 'big') {
      setLocalPlan({ ...cleaned, bigTask: todoId });
    } else if (slot === 'medium') {
      if (cleaned.mediumTasks.length >= LIMITS.medium) return;
      setLocalPlan({ ...cleaned, mediumTasks: [...cleaned.mediumTasks, todoId] });
    } else {
      if (cleaned.smallTasks.length >= LIMITS.small) return;
      setLocalPlan({ ...cleaned, smallTasks: [...cleaned.smallTasks, todoId] });
    }

    void updateTodo(todoId, {
      energy_type: meta.energy,
      time_block_date: date,
      time_block_start: startTime,
      time_block_end: minutesToTime(endMins),
    });
  }

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const currentDropTime = dropTime;
    const lastPointer = pointerRef.current;
    setDragId(null);
    setDropTime(null);

    if (!e.over) {
      // Fallback: compute time from last pointer position if pointer was over timeline
      const el = contentRef.current;
      const scrollEl = timelineRef.current;
      if (el && scrollEl) {
        const scrollRect = scrollEl.getBoundingClientRect();
        if (
          lastPointer.x >= scrollRect.left &&
          lastPointer.x <= scrollRect.right &&
          lastPointer.y >= scrollRect.top &&
          lastPointer.y <= scrollRect.bottom
        ) {
          const contentRect = el.getBoundingClientRect();
          const y = lastPointer.y - contentRect.top;
          const rawMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
          const computedTime = minutesToTime(snapMinutes(rawMinutes));
          const todoId = String(e.active.id);
          const todo = byId.get(todoId);
          const duration = todo?.estimated_minutes || DEFAULT_DURATION;
          const startMins = timeToMinutes(computedTime);
          const endMins = Math.min(startMins + duration, END_HOUR * 60);

          setLocalPlan(removeFromPlan(todoId));
          void updateTodo(todoId, {
            time_block_date: date,
            time_block_start: computedTime,
            time_block_end: minutesToTime(endMins),
          });
          return;
        }
      }
      return;
    }

    const todoId = String(e.active.id);
    const target = String(e.over.id);

    if (target === POOL_ID) {
      setLocalPlan(removeFromPlan(todoId));
      void updateTodo(todoId, {
        time_block_date: null,
        time_block_start: null,
        time_block_end: null,
      });
      return;
    }

    if (target === TIMELINE_ID) {
      const todo = byId.get(todoId);
      const duration = todo?.estimated_minutes || DEFAULT_DURATION;

      // Use dropTime if available, otherwise compute from pointer position
      let finalTime = currentDropTime;
      if (!finalTime) {
        const el = contentRef.current;
        if (el) {
          const contentRect = el.getBoundingClientRect();
          const y = lastPointer.y - contentRect.top;
          const rawMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
          finalTime = minutesToTime(snapMinutes(rawMinutes));
        }
      }

      if (finalTime) {
        const startMins = timeToMinutes(finalTime);
        const endMins = Math.min(startMins + duration, END_HOUR * 60);
        setLocalPlan(removeFromPlan(todoId));
        void updateTodo(todoId, {
          time_block_date: date,
          time_block_start: finalTime,
          time_block_end: minutesToTime(endMins),
        });
      }
    }
  }

  const capacity: Record<Slot, boolean> = {
    big: !plan.bigTask,
    medium: plan.mediumTasks.length < LIMITS.medium,
    small: plan.smallTasks.length < LIMITS.small,
  };

  const dragging = dragId ? byId.get(dragId) : null;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowY = ((nowMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNowLine =
    day === 'today' && nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60;

  function slotProgress(ids: string[]) {
    const items = ids.map((id) => byId.get(id)).filter((t): t is Todo => !!t);
    return items.filter((t) => t.is_completed).length;
  }

  const bigDone = plan.bigTask
    ? byId.get(plan.bigTask)?.is_completed
      ? 1
      : 0
    : 0;
  const medDone = slotProgress(plan.mediumTasks);
  const smallDone = slotProgress(plan.smallTasks);

  // Ghost block height for drop indicator
  const ghostHeight = dragging
    ? Math.max(
        ((dragging.estimated_minutes || DEFAULT_DURATION) / 60) * HOUR_HEIGHT,
        28,
      )
    : 0;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold text-accent">
              {day === 'today' ? 'Today' : 'Tomorrow'}
            </h1>
            <div className="flex items-center bg-surface-raised border border-zinc-800/60 rounded-full p-0.5">
              <button
                onClick={() => setDay('today')}
                className={`px-3 py-1 text-xs font-semibold rounded-full cursor-pointer transition-all duration-200 ${
                  day === 'today'
                    ? 'bg-accent text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDay('tomorrow')}
                className={`px-3 py-1 text-xs font-semibold rounded-full cursor-pointer transition-all duration-200 ${
                  day === 'tomorrow'
                    ? 'bg-accent text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Tomorrow
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {formatDate(date)} · {scheduled.length} scheduled · {allLabeledPool.length}{' '}
            unplanned
          </p>
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="p-6 text-zinc-500 text-sm">Loading…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex-1 flex min-h-0">
            {/* Timeline */}
            <div ref={timelineRef} className="flex-1 overflow-y-auto pt-2">
              <TimelineDrop contentRef={contentRef} dragId={dragId}>
                {/* Planning zone backgrounds */}
                <div className="absolute left-[4.5rem] right-3 top-0 bottom-0 pointer-events-none">
                  <div
                    className="absolute left-0 right-0 bg-purple-950/10 border-l-2 border-purple-500/25 rounded-r"
                    style={{
                      top: timeToY('05:00'),
                      height: durationToHeight('05:00', '11:00'),
                    }}
                  >
                    <div className="px-2 py-1">
                      <span className="text-[10px] font-medium text-purple-400/50">
                        Deep Focus · Morning
                      </span>
                    </div>
                  </div>
                  <div
                    className="absolute left-0 right-0 bg-amber-950/8 border-l-2 border-yellow-500/20 rounded-r"
                    style={{
                      top: timeToY('13:00'),
                      height: durationToHeight('13:00', '18:00'),
                    }}
                  >
                    <div className="px-2 py-1">
                      <span className="text-[10px] font-medium text-yellow-400/40">
                        Quick Wins · Afternoon
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hour grid lines and labels */}
                {hours.map((time) => (
                  <div
                    key={time}
                    className="absolute left-0 right-0 flex items-start"
                    style={{ top: timeToY(time) }}
                  >
                    <span className="w-16 shrink-0 text-[11px] text-zinc-600 text-right pr-3 -mt-2 select-none font-mono">
                      {fmtTime12(time)}
                    </span>
                    <div className="flex-1 border-t border-zinc-800/40" />
                  </div>
                ))}

                {/* Half-hour dashed lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                  const halfTime = `${pad(START_HOUR + i)}:30`;
                  return (
                    <div
                      key={`h-${i}`}
                      className="absolute left-[4.5rem] right-0"
                      style={{ top: timeToY(halfTime) }}
                    >
                      <div className="border-t border-zinc-800/20 border-dashed" />
                    </div>
                  );
                })}

                {/* Scheduled events */}
                <div className="absolute left-[4.5rem] right-3 top-0 bottom-0">
                  {layout.map((item) => (
                    <TimelineEvent
                      key={item.todo.id}
                      item={item}
                      onToggle={onToggle}
                      onUnschedule={onUnschedule}
                    />
                  ))}
                </div>

                {/* Drop indicator */}
                {dragId && dropTime && (
                  <div
                    className="absolute left-[4rem] right-3 z-30 pointer-events-none"
                    style={{ top: timeToY(dropTime) }}
                  >
                    <div className="flex items-center mb-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
                      <div className="flex-1 border-t-2 border-accent border-dashed ml-0.5" />
                      <span className="text-[10px] text-accent font-mono ml-1 bg-zinc-950/80 px-1 rounded">
                        {fmtTime12(dropTime)}
                      </span>
                    </div>
                    <div
                      className="ml-3 bg-accent/8 border border-accent/25 border-dashed rounded-lg"
                      style={{ height: ghostHeight }}
                    />
                  </div>
                )}

                {/* Now indicator */}
                {showNowLine && (
                  <div
                    className="absolute left-14 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowY }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}
              </TimelineDrop>
            </div>

            {/* Sidebar — Unplanned Pool */}
            <PoolDrop dragId={dragId}>
              {/* Slot progress summary */}
              <div className="px-4 py-3 border-b border-zinc-900 space-y-1.5">
                {(['big', 'medium', 'small'] as Slot[]).map((slot) => {
                  const meta = SLOT_META[slot];
                  const limit = LIMITS[slot];
                  const count =
                    slot === 'big'
                      ? plan.bigTask
                        ? 1
                        : 0
                      : slot === 'medium'
                      ? plan.mediumTasks.length
                      : plan.smallTasks.length;
                  const done =
                    slot === 'big' ? bigDone : slot === 'medium' ? medDone : smallDone;
                  const active = filterSlot === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setFilterSlot(active ? null : slot)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left cursor-pointer transition ${
                        active ? 'bg-zinc-800/60' : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                      <span className="text-[11px] text-zinc-300 flex-1 truncate">
                        {meta.title}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {done}/{count}/{limit}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="px-4 py-3 border-b border-zinc-900 space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Unplanned</h3>
                  <span className="text-xs text-zinc-500">
                    {pool.length}
                    {(filterSlot || search) && allLabeledPool.length !== pool.length && (
                      <span className="text-zinc-600"> / {allLabeledPool.length}</span>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <Icon
                    name="search"
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    data-search-input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tasks…"
                    className="w-full pl-7 pr-7 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded focus:border-accent focus:outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer p-0.5"
                      aria-label="Clear search"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </div>
                {filterSlot && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-black">
                      {SLOT_META[filterSlot].chip} only
                    </span>
                    <button
                      onClick={() => setFilterSlot(null)}
                      className="text-[10px] text-zinc-500 hover:text-white cursor-pointer"
                    >
                      clear
                    </button>
                  </div>
                )}
                {unlabeledCount > 0 && (
                  <p className="text-[11px] text-amber-400">
                    {unlabeledCount} task{unlabeledCount === 1 ? '' : 's'} need sizing —
                    open Weekly Review (⌘3).
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {pool.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">
                    {filterSlot || search
                      ? 'No matches.'
                      : unlabeledCount > 0
                      ? 'Nothing sized. Open Weekly Review (⌘3) to estimate tasks.'
                      : 'All scheduled.'}
                  </p>
                ) : (
                  pool.map((t) => (
                    <PoolCard
                      key={t.id}
                      t={t}
                      capacity={capacity}
                      onAssign={(slot) => assignTo(slot, t.id)}
                    />
                  ))
                )}
              </div>
              <div className="px-4 py-3 border-t border-zinc-900">
                <label className="text-xs font-semibold block mb-1.5 text-zinc-400">
                  Daily notes
                </label>
                <textarea
                  value={plan.reflection ?? ''}
                  onChange={(e) => setLocalPlan({ ...plan, reflection: e.target.value })}
                  placeholder="One note to future you…"
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:border-accent focus:outline-none resize-none"
                />
              </div>
            </PoolDrop>
          </div>

          <DragOverlay>
            {dragging && (
              <div className="px-3 py-2 bg-zinc-900 border border-accent rounded-lg text-sm text-white shadow-2xl max-w-64">
                <div className="truncate">{dragging.title}</div>
                {dragging.estimated_minutes && (
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {dragging.estimated_minutes}m
                  </div>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
