import { useCallback, useMemo, useState } from 'react';
import { useTodos, toggleComplete, createTodo, updateTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { Todo } from '../types';
import Icon from '../components/Icon';
import SubtaskProgress from '../components/SubtaskProgress';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  d.setDate(diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekdayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function Upcoming() {
  const { todos, loading, error, setError } = useTodos();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = dateKey(today);
  const tomorrowStr = dateKey(addDays(today, 1));

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(today));

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of todos) {
      if (t.is_completed) continue;
      let ds = t.deadline?.slice(0, 10) || t.time_block_date?.slice(0, 10);
      if (!ds && t.recurrence_frequency) {
        ds = todayStr;
      }
      if (!ds) continue;
      const arr = map.get(ds) || [];
      arr.push(t);
      map.set(ds, arr);
    }
    return map;
  }, [todos, todayStr]);

  const overdueTasks = useMemo(
    () =>
      todos
        .filter((t) => {
          if (t.is_completed) return false;
          const ds = t.deadline?.slice(0, 10);
          return ds ? ds < todayStr : false;
        })
        .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')),
    [todos, todayStr],
  );

  const dateSections = useMemo(() => {
    const sections: { date: Date; key: string; tasks: Todo[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      const key = dateKey(d);
      sections.push({ date: d, key, tasks: tasksByDate.get(key) || [] });
    }
    return sections;
  }, [today, tasksByDate]);

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

  async function handleAddTask(dateStr: string) {
    const title = newTaskTitle.trim();
    if (!title) return;
    try {
      const task = await createTodo({ title });
      await updateTodo(task.id, { deadline: dateStr + 'T00:00:00.000Z' });
      setNewTaskTitle('');
      setAddingForDate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  function formatDateLabel(d: Date, key: string): string {
    const day = d.getDate();
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const weekday = formatWeekday(d);
    if (key === todayStr) return `${day} ${month} · Today · ${weekday}`;
    if (key === tomorrowStr) return `${day} ${month} · Tomorrow · ${weekday}`;
    return `${day} ${month} · ${weekday}`;
  }

  function formatOverdueDate(t: Todo): string {
    if (!t.deadline) return '';
    const d = new Date(t.deadline);
    const day = d.getDate();
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const hasTime = t.deadline.includes('T') && !t.deadline.endsWith('T00:00:00.000Z');
    if (hasTime) {
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${day} ${month} ${time}`;
    }
    return `${day} ${month}`;
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-4 pb-3 border-b border-zinc-800/60">
        <h1 className="font-heading text-3xl font-bold text-accent">Upcoming</h1>

        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-zinc-300 font-medium">{formatMonthYear(weekStart)}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={prevWeek}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-surface-raised rounded-md cursor-pointer transition-all duration-200"
              aria-label="Previous week"
            >
              <Icon name="arrow-left" size={14} />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-surface-raised rounded-md cursor-pointer transition-all duration-200 border border-zinc-800"
            >
              Today
            </button>
            <button
              onClick={nextWeek}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-surface-raised rounded-md cursor-pointer transition-all duration-200"
              aria-label="Next week"
            >
              <Icon name="arrow-right" size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center mt-3 border-b border-zinc-800/40 pb-1">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const isToday = key === todayStr;
            return (
              <button
                key={key}
                onClick={() => {
                  const el = document.getElementById(`upcoming-${key}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex-1 flex flex-col items-center py-2 cursor-pointer transition-all duration-200 ${
                  isToday
                    ? 'text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide">
                  {formatWeekdayShort(d)}
                </span>
                <span
                  className={`text-sm mt-0.5 w-7 h-7 flex items-center justify-center rounded-md ${
                    isToday ? 'bg-accent text-black font-bold' : ''
                  }`}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
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
        <main className="flex-1 overflow-y-auto">
          {overdueTasks.length > 0 && (
            <div className="border-b border-zinc-800/60">
              <div
                className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-surface-raised/30 transition-all duration-200"
                onClick={() => setOverdueOpen(!overdueOpen)}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    name="chevron"
                    size={14}
                    className={`text-zinc-500 transition-transform duration-200 ${
                      overdueOpen ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="text-sm font-semibold text-zinc-200">Overdue</span>
                  <span className="text-[10px] min-w-[18px] text-center px-1 py-0.5 rounded-full bg-red-950/80 text-red-400">
                    {overdueTasks.length}
                  </span>
                </div>
                <span className="text-xs font-semibold text-red-400 hover:text-red-300 transition">
                  Reschedule
                </span>
              </div>
              {overdueOpen && (
                <ul className="animate-fade-in">
                  {overdueTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 px-6 py-2.5 hover:bg-surface-raised/50 transition-all duration-200 group"
                    >
                      <button
                        onClick={() => onToggle(t)}
                        className="w-[18px] h-[18px] rounded-full border-2 border-zinc-600 hover:border-accent flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200"
                      />
                      <button
                        onClick={() => openTask(t.id)}
                        className="flex-1 text-left text-sm text-zinc-200 hover:text-accent cursor-pointer transition-colors duration-200 truncate"
                      >
                        {t.title}
                      </button>
                      <SubtaskProgress todoId={t.id} todo={t} />
                      <span className="text-[11px] text-red-400 shrink-0 flex items-center gap-1">
                        <Icon name="calendar" size={11} />
                        {formatOverdueDate(t)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {dateSections.map(({ date, key, tasks }) => (
            <div key={key} id={`upcoming-${key}`} className="border-b border-zinc-800/60">
              <div className="px-6 py-3">
                <h3
                  className={`text-sm font-semibold ${
                    key === todayStr ? 'text-accent' : key === tomorrowStr ? 'text-zinc-200' : 'text-zinc-400'
                  }`}
                >
                  {formatDateLabel(date, key)}
                </h3>
              </div>

              {tasks.length > 0 && (
                <ul>
                  {tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 px-6 py-2.5 hover:bg-surface-raised/50 transition-all duration-200 group"
                    >
                      <button
                        onClick={() => onToggle(t)}
                        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${
                          t.is_completed
                            ? 'bg-accent border-accent'
                            : 'border-zinc-600 hover:border-accent'
                        }`}
                      >
                        {t.is_completed && (
                          <Icon name="check" size={10} className="text-black" />
                        )}
                      </button>
                      <button
                        onClick={() => openTask(t.id)}
                        className={`flex-1 text-left text-sm cursor-pointer transition-colors duration-200 truncate ${
                          t.is_completed
                            ? 'line-through text-zinc-600'
                            : 'text-zinc-200 hover:text-accent'
                        }`}
                      >
                        {t.title}
                      </button>
                      <SubtaskProgress todoId={t.id} todo={t} />
                      {t.priority !== 'medium' && (
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full tracking-wide ${
                            t.priority === 'urgent'
                              ? 'bg-red-950/80 text-red-300 border border-red-900/40'
                              : t.priority === 'high'
                              ? 'bg-orange-950/80 text-orange-300 border border-orange-900/40'
                              : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/40'
                          }`}
                        >
                          {t.priority}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {addingForDate === key ? (
                <div className="px-6 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddTask(key);
                        if (e.key === 'Escape') {
                          setAddingForDate(null);
                          setNewTaskTitle('');
                        }
                      }}
                      placeholder="Task name"
                      className="flex-1 text-sm bg-surface-raised border border-zinc-800 rounded-lg px-3 py-1.5 focus:border-accent focus:outline-none"
                    />
                    <button
                      onClick={() => void handleAddTask(key)}
                      className="text-xs px-3 py-1.5 bg-accent text-black rounded-lg font-semibold cursor-pointer hover:bg-accent/80 transition"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingForDate(null);
                        setNewTaskTitle('');
                      }}
                      className="text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddingForDate(key);
                    setNewTaskTitle('');
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm text-zinc-600 hover:text-accent cursor-pointer transition-colors duration-200 w-full"
                >
                  <Icon name="plus" size={14} className="text-accent" />
                  <span>Add task</span>
                </button>
              )}
            </div>
          ))}
        </main>
      )}
    </div>
  );
}
