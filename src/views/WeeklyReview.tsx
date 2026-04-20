import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTodos, updateTodo, deleteTodo as removeTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { Todo } from '../types';
import Icon from '../components/Icon';
import api from '../lib/api';

type Phase = 'clear' | 'current' | 'creative';

type Review = {
  id: string;
  phase_clear: boolean;
  phase_current: boolean;
  phase_creative: boolean;
  checklist: Record<string, boolean>;
  mind_dump: string;
  goals: string[];
  rating: number | null;
  reflection: string;
  monday_frog_id: string | null;
  completed_at: string | null;
};

type Analytics = {
  completed_count: number;
  total_hours: number;
  carry_over_count: number;
  delegation_candidates: number;
  quadrant_distribution: Record<string, { count: number; minutes: number }>;
  energy_distribution: Record<string, { count: number; minutes: number }>;
  stress: { level: string; q1_percent: number; q1_count: number };
};

export default function WeeklyReview() {
  const { todos } = useTodos();
  const [review, setReview] = useState<Review | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [streak, setStreak] = useState(0);
  const [completedByDay, setCompletedByDay] = useState<Record<string, any[]>>({});
  const [stale, setStale] = useState<any[]>([]);
  const [activePhase, setActivePhase] = useState<Phase>('clear');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inboxTasks = useMemo(() =>
    todos.filter(t => !t.is_completed && !t.priority && !t.category && !t.parent_id),
    [todos]
  );
  const unplannedTasks = useMemo(() =>
    todos.filter(t => !t.is_completed && !t.time_block_date && !t.deadline && !t.parent_id),
    [todos]
  );
  const somedayTasks = useMemo(() =>
    unplannedTasks.filter(t => t.priority === 'low'),
    [unplannedTasks]
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [rev, anal, str, comp, st] = await Promise.all([
        api.get<Review>('/todos/review/current'),
        api.get<Analytics>('/todos/review/weekly'),
        api.get<number>('/todos/review/streak'),
        api.get<Record<string, any[]>>('/todos/review/completed-tasks'),
        api.get<any[]>('/todos/review/stale'),
      ]);
      setReview(rev);
      setAnalytics(anal);
      setStreak(str);
      setCompletedByDay(comp);
      setStale(st);
      if (!rev.phase_clear) setActivePhase('clear');
      else if (!rev.phase_current) setActivePhase('current');
      else setActivePhase('creative');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }

  async function saveReview(data: Record<string, unknown>) {
    try {
      const updated = await api.put<Review>('/todos/review/current', data);
      setReview(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  const debouncedSave = useDebouncedFn((field: string, value: unknown) => {
    saveReview({ [field]: value });
  }, 500);

  const checklist = review?.checklist || {};

  function toggleChecklist(key: string) {
    saveReview({ checklist: { [key]: !checklist[key] } });
  }

  useEffect(() => {
    if (!review) return;
    const c = review.checklist || {};
    const clearDone = c.process_inbox && c.review_unplanned && c.mind_dump_done;
    const currentDone = c.review_completed && c.review_delegation && c.review_matrix && c.address_stale;
    const creativeDone = c.review_someday && c.set_goals && c.assign_frog && c.rate_week;
    if (clearDone && !review.phase_clear) saveReview({ phase_clear: true });
    if (currentDone && !review.phase_current) saveReview({ phase_current: true });
    if (creativeDone && !review.phase_creative) saveReview({ phase_creative: true });
  }, [review?.checklist]);

  async function completeReview() {
    try {
      const updated = await api.post<Review>('/todos/review/complete');
      setReview(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'All phases must be completed first');
    }
  }

  async function scheduleTodo(id: string) {
    try {
      await updateTodo(id, { time_block_date: getNextMonday() });
    } catch {}
  }

  async function deleteTodo(id: string) {
    try {
      await removeTodo(id);
      setStale(prev => prev.filter(t => t.id !== id));
    } catch {}
  }

  const allDone = review?.phase_clear && review?.phase_current && review?.phase_creative;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-accent">Weekly Review</h1>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">3-phase guided review — clear, reflect, plan ahead</p>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="text-xs text-amber-300 bg-amber-950/60 border border-amber-900 px-2 py-0.5 rounded-full">
                {streak}-week streak
              </span>
            )}
            {review?.completed_at && (
              <span className="text-xs text-green-300 bg-green-950/60 border border-green-900 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Icon name="check" size={12} /> Complete
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center mt-4 gap-1">
          {(['clear', 'current', 'creative'] as Phase[]).map((p, i) => {
            const done = p === 'clear' ? review?.phase_clear : p === 'current' ? review?.phase_current : review?.phase_creative;
            const label = p === 'clear' ? 'Get Clear' : p === 'current' ? 'Get Current' : 'Plan Ahead';
            const color = p === 'clear' ? 'blue' : p === 'current' ? 'amber' : 'green';
            return (
              <div key={p} className="flex items-center flex-1">
                <button
                  onClick={() => setActivePhase(p)}
                  className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium transition ${
                    done ? `text-${color}-400` : activePhase === p ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border-2 ${
                    done ? `bg-${color}-400 border-${color}-400` : activePhase === p ? `border-${color}-400` : 'border-zinc-600'
                  }`} />
                  {label}
                </button>
                {i < 2 && <div className={`flex-1 h-px mx-2 ${done ? `bg-${color}-400` : 'bg-zinc-800'}`} />}
              </div>
            );
          })}
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><Icon name="x" size={14} /></button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT: Phase cards */}
        <div className="flex-[3] overflow-y-auto p-6 space-y-4">
          <PhaseCard
            phase="clear" active={activePhase} onActivate={() => setActivePhase('clear')}
            done={!!review?.phase_clear} title="Get Clear" subtitle="Empty your head. Process everything."
            color="blue"
          >
            <Checkbox label="Process Brain Dump — move all items to quadrants or delete" checked={!!checklist.process_inbox} onChange={() => toggleChecklist('process_inbox')} />
            <div className="ml-6 text-xs text-zinc-500 -mt-1 mb-2">
              <span className="text-white font-medium">{inboxTasks.length}</span> inbox items
            </div>
            <Checkbox label="Review unplanned tasks — schedule or archive" checked={!!checklist.review_unplanned} onChange={() => toggleChecklist('review_unplanned')} />
            <div className="ml-6 text-xs text-zinc-500 -mt-1 mb-2">
              <span className="text-white font-medium">{unplannedTasks.length}</span> unplanned tasks
            </div>
            <Checkbox label="Mind dump — capture anything still in your head" checked={!!checklist.mind_dump_done} onChange={() => toggleChecklist('mind_dump_done')} />
            <textarea
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 min-h-[80px]"
              rows={4}
              placeholder="What's still on your mind? Get it out of your head..."
              defaultValue={review?.mind_dump || ''}
              onChange={(e) => debouncedSave('mind_dump', e.target.value)}
            />
          </PhaseCard>

          <PhaseCard
            phase="current" active={activePhase} onActivate={() => setActivePhase('current')}
            done={!!review?.phase_current} title="Get Current" subtitle="Review what happened. Identify issues."
            color="amber"
          >
            <Checkbox label="Review completed tasks this week" checked={!!checklist.review_completed} onChange={() => toggleChecklist('review_completed')} />
            <Checkbox label="Review delegation board — follow up on overdue items" checked={!!checklist.review_delegation} onChange={() => toggleChecklist('review_delegation')} />
            <Checkbox label="Review Eisenhower Matrix — rebalance quadrants" checked={!!checklist.review_matrix} onChange={() => toggleChecklist('review_matrix')} />
            <Checkbox label="Address stale tasks (>2 weeks without progress)" checked={!!checklist.address_stale} onChange={() => toggleChecklist('address_stale')} />
            {stale.length > 0 && (
              <TaskList
                tasks={stale}
                onSchedule={scheduleTodo}
                onDelete={deleteTodo}
                showAge
              />
            )}
          </PhaseCard>

          <PhaseCard
            phase="creative" active={activePhase} onActivate={() => setActivePhase('creative')}
            done={!!review?.phase_creative} title="Get Creative + Plan Ahead" subtitle="Look forward. Set intentions."
            color="green"
          >
            <Checkbox label="Review Someday list" checked={!!checklist.review_someday} onChange={() => toggleChecklist('review_someday')} />
            <Checkbox label="Set goals for next week" checked={!!checklist.set_goals} onChange={() => toggleChecklist('set_goals')} />
            <GoalsEditor goals={review?.goals || []} onSave={(goals) => saveReview({ goals })} />
            <Checkbox label="Pre-assign Monday's frog" checked={!!checklist.assign_frog} onChange={() => toggleChecklist('assign_frog')} />
            <Checkbox label="Rate this week" checked={!!checklist.rate_week} onChange={() => toggleChecklist('rate_week')} />
            <StarRating
              rating={review?.rating || 0}
              reflection={review?.reflection || ''}
              onRate={(r) => saveReview({ rating: r })}
              onReflect={(s) => debouncedSave('reflection', s)}
            />
          </PhaseCard>

          {/* Complete button */}
          <div className="text-center pb-4">
            <button
              onClick={completeReview}
              disabled={!allDone || !!review?.completed_at}
              className={`px-6 py-2 rounded-lg font-medium text-sm cursor-pointer transition ${
                allDone && !review?.completed_at
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon name="check" size={16} />
                {review?.completed_at ? 'Review Complete' : 'Complete Review'}
              </span>
            </button>
            {!allDone && !review?.completed_at && (
              <p className="text-xs text-zinc-600 mt-1">Complete all phases to finish</p>
            )}
          </div>
        </div>

        {/* RIGHT: Context panel */}
        <div className="flex-[2] border-l border-zinc-800 overflow-y-auto p-6">
          {activePhase === 'clear' && (
            <ClearPanel inbox={inboxTasks} unplanned={unplannedTasks} onSchedule={scheduleTodo} onDelete={deleteTodo} />
          )}
          {activePhase === 'current' && (
            <CurrentPanel analytics={analytics} completedByDay={completedByDay} />
          )}
          {activePhase === 'creative' && (
            <CreativePanel
              review={review} streak={streak} someday={somedayTasks}
              unplanned={unplannedTasks} onPickFrog={(id) => saveReview({ monday_frog_id: id })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Phase Card ============
function PhaseCard({ phase, active, onActivate, done, title, subtitle, color, children }: {
  phase: Phase; active: Phase; onActivate: () => void; done: boolean;
  title: string; subtitle: string; color: string; children: React.ReactNode;
}) {
  const isActive = active === phase;
  const borderColor = done ? `border-${color}-900` : isActive ? `border-${color}-900/50` : 'border-zinc-800';

  return (
    <div className={`rounded-lg border ${borderColor} ${isActive ? `bg-${color}-950/20` : 'bg-zinc-950'} transition`}>
      <button onClick={onActivate} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2">
          {done ? <Icon name="check" size={16} className={`text-${color}-400`} /> :
            <Icon name={phase === 'clear' ? 'inbox' : phase === 'current' ? 'eye' : 'sparkles'} size={16} className={isActive ? `text-${color}-400` : 'text-zinc-500'} />}
          <div className="text-left">
            <span className="text-sm font-medium text-white">{title}</span>
            {isActive && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {done && <span className={`text-[10px] text-${color}-400 bg-${color}-950 border border-${color}-900 px-1.5 py-0.5 rounded-full`}>Done</span>}
          <Icon name="chevron" size={14} className={`text-zinc-600 transition ${isActive ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {isActive && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

// ============ Checkbox ============
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2.5 py-1 cursor-pointer group">
      <input
        type="checkbox" checked={checked} onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-green-500 cursor-pointer accent-green-500"
      />
      <span className={`text-sm transition ${checked ? 'text-zinc-600 line-through' : 'text-zinc-300 group-hover:text-white'}`}>
        {label}
      </span>
    </label>
  );
}

// ============ Goals Editor ============
function GoalsEditor({ goals, onSave }: { goals: string[]; onSave: (g: string[]) => void }) {
  const [local, setLocal] = useState<string[]>(goals.length ? goals : ['']);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { if (goals.length) setLocal(goals); }, [goals.join(',')]);

  function update(i: number, v: string) {
    const next = [...local];
    next[i] = v;
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(next.filter(g => g.trim())), 500);
  }

  return (
    <div className="ml-6 space-y-1.5 mb-2">
      <p className="text-xs text-zinc-500 font-medium">Goals for Next Week</p>
      {local.map((g, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text" value={g} onChange={(e) => update(i, e.target.value)}
            placeholder={`Goal ${i + 1}...`}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {local.length > 1 && (
            <button onClick={() => { const n = local.filter((_, j) => j !== i); setLocal(n.length ? n : ['']); onSave(n.filter(g => g.trim())); }}
              className="text-zinc-600 hover:text-red-400 cursor-pointer"><Icon name="x" size={14} /></button>
          )}
        </div>
      ))}
      {local.length < 3 && (
        <button onClick={() => setLocal([...local, ''])} className="text-xs text-green-400 hover:text-green-300 cursor-pointer flex items-center gap-1">
          <Icon name="plus" size={12} /> Add Goal
        </button>
      )}
    </div>
  );
}

// ============ Star Rating ============
function StarRating({ rating, reflection, onRate, onReflect }: {
  rating: number; reflection: string; onRate: (r: number) => void; onReflect: (s: string) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="ml-6 space-y-2 mb-2">
      <p className="text-xs text-zinc-500 font-medium">Rate This Week</p>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => onRate(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
            className="cursor-pointer p-0.5">
            <Icon name={(hover || rating) >= s ? 'star-filled' : 'star'} size={24}
              className={(hover || rating) >= s ? 'text-amber-400' : 'text-zinc-700'} />
          </button>
        ))}
      </div>
      <input
        type="text" placeholder="One line — how was this week?" defaultValue={reflection}
        onChange={(e) => onReflect(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
      />
    </div>
  );
}

// ============ Task List ============
function TaskList({ tasks, onSchedule, onDelete, showAge }: {
  tasks: any[]; onSchedule: (id: string) => void; onDelete: (id: string) => void; showAge?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tasks : tasks.slice(0, 5);

  return (
    <div className="ml-6 space-y-1 mb-2">
      {shown.map(t => {
        const age = showAge ? Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000) : 0;
        return (
          <div key={t.id} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 group">
            <span onClick={() => openTask(t.id)} className="flex-1 text-sm text-zinc-300 truncate cursor-pointer hover:text-white">{t.title}</span>
            {showAge && <span className="text-[10px] text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded-full">{age}d</span>}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => onSchedule(t.id)} className="p-1 text-zinc-500 hover:text-blue-400 cursor-pointer" title="Schedule">
                <Icon name="calendar" size={13} />
              </button>
              <button onClick={() => onDelete(t.id)} className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer" title="Delete">
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        );
      })}
      {tasks.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">
          {expanded ? 'Show less' : `Show all ${tasks.length}`}
        </button>
      )}
    </div>
  );
}

// ============ Context Panels ============

function ClearPanel({ inbox, unplanned, onSchedule, onDelete }: {
  inbox: Todo[]; unplanned: Todo[]; onSchedule: (id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Section title="Inbox Items" count={inbox.length} color="blue">
        {inbox.length > 0 ? (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {inbox.map(t => (
              <TaskRow key={t.id} task={t} onSchedule={onSchedule} onDelete={onDelete} />
            ))}
          </div>
        ) : <p className="text-xs text-zinc-600 italic">No inbox items</p>}
      </Section>
      <Section title="Unplanned Tasks" count={unplanned.length} color="blue">
        {unplanned.length > 0 ? (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {unplanned.map(t => (
              <TaskRow key={t.id} task={t} onSchedule={onSchedule} onDelete={onDelete} />
            ))}
          </div>
        ) : <p className="text-xs text-zinc-600 italic">No unplanned tasks — you're organized!</p>}
      </Section>
    </div>
  );
}

function CurrentPanel({ analytics, completedByDay }: { analytics: Analytics | null; completedByDay: Record<string, any[]> }) {
  if (!analytics) return null;
  const quadrants = [
    { key: 'urgent', label: 'Q1: Do First', color: 'bg-red-500' },
    { key: 'high', label: 'Q2: Schedule', color: 'bg-amber-500' },
    { key: 'medium', label: 'Q3: Delegate', color: 'bg-blue-500' },
    { key: 'low', label: 'Q4: Eliminate', color: 'bg-zinc-500' },
  ];
  const qTotal = Object.values(analytics.quadrant_distribution).reduce((s, v) => s + v.count, 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Completed" value={analytics.completed_count} color="green" />
        <StatBox label="Hours" value={`${analytics.total_hours}h`} color="blue" />
        <StatBox label="Carry Over" value={analytics.carry_over_count} color="amber" />
        <StatBox label="Delegate?" value={analytics.delegation_candidates} color="cyan" />
      </div>

      {/* Stress */}
      <div className={`rounded-lg border px-3 py-2 text-xs ${
        analytics.stress.level === 'high' ? 'border-red-900 bg-red-950/40 text-red-300' :
        analytics.stress.level === 'moderate' ? 'border-amber-900 bg-amber-950/40 text-amber-300' :
        'border-green-900 bg-green-950/40 text-green-300'
      }`}>
        {analytics.stress.level === 'high' ? 'Too Much Firefighting' :
         analytics.stress.level === 'moderate' ? 'Moderate Workload' : 'Healthy Workload'}
        <span className="text-zinc-500 ml-2">{analytics.stress.q1_percent}% urgent</span>
      </div>

      {/* Quadrant bars */}
      <div className="space-y-2">
        {quadrants.map(q => {
          const data = analytics.quadrant_distribution[q.key] || { count: 0 };
          const pct = qTotal > 0 ? Math.round((data.count / qTotal) * 100) : 0;
          return (
            <div key={q.key} className="space-y-0.5">
              <div className="flex justify-between text-xs"><span className="text-zinc-400">{q.label}</span><span className="text-zinc-300">{data.count} ({pct}%)</span></div>
              <div className="h-1 rounded-full bg-zinc-800"><div className={`h-full rounded-full ${q.color} transition-all`} style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>

      {/* Completed by day */}
      {Object.keys(completedByDay).length > 0 && (
        <Section title="Completed This Week" color="amber">
          {Object.entries(completedByDay).sort(([a], [b]) => b.localeCompare(a)).map(([day, tasks]) => (
            <DayGroup key={day} day={day} tasks={tasks} />
          ))}
        </Section>
      )}
    </div>
  );
}

function CreativePanel({ review, streak, someday, unplanned, onPickFrog }: {
  review: Review | null; streak: number; someday: Todo[]; unplanned: Todo[];
  onPickFrog: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Last week summary */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
        <p className="text-xs text-zinc-500 mb-1">Last week</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Icon key={s} name={(review?.rating || 0) >= s ? 'star-filled' : 'star'} size={14}
                className={(review?.rating || 0) >= s ? 'text-amber-400' : 'text-zinc-700'} />
            ))}
          </div>
          {streak > 0 && <span className="text-xs text-amber-300">{streak}-week streak</span>}
        </div>
        {review?.reflection && <p className="text-xs text-zinc-400 mt-1 italic">"{review.reflection}"</p>}
      </div>

      {/* Monday's Frog */}
      <Section title="Monday's Frog 🐸" color="green">
        <p className="text-xs text-zinc-500 mb-2">Pick your most important task for Monday</p>
        <div className="space-y-1 max-h-[180px] overflow-y-auto">
          {unplanned.slice(0, 20).map(t => (
            <button key={t.id} onClick={() => onPickFrog(t.id)}
              className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer text-sm transition ${
                review?.monday_frog_id === t.id
                  ? 'bg-green-950/60 border border-green-900 text-green-300'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-600'
              }`}>
              {review?.monday_frog_id === t.id && <span>🐸</span>}
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Someday list */}
      <Section title="Someday List" count={someday.length} color="green">
        {someday.length > 0 ? (
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {someday.map(t => (
              <div key={t.id} onClick={() => openTask(t.id)}
                className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-zinc-600">
                <span className="text-sm text-zinc-300 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-zinc-600 italic">No someday tasks</p>}
      </Section>
    </div>
  );
}

// ============ Shared Components ============

function Section({ title, count, color, children }: { title: string; count?: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wider text-${color}-400 mb-2 flex items-center gap-2`}>
        {title}
        {count !== undefined && <span className="text-white bg-zinc-800 px-1.5 py-0.5 rounded-full text-[10px] normal-case">{count}</span>}
      </h4>
      {children}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-lg border border-${color}-900/50 bg-${color}-950/30 p-2.5`}>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-400">{label}</p>
    </div>
  );
}

function TaskRow({ task, onSchedule, onDelete }: { task: Todo; onSchedule: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 group">
      <span onClick={() => openTask(task.id)} className="flex-1 text-sm text-zinc-300 truncate cursor-pointer hover:text-white">{task.title}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={() => onSchedule(task.id)} className="p-1 text-zinc-500 hover:text-blue-400 cursor-pointer"><Icon name="calendar" size={13} /></button>
        <button onClick={() => onDelete(task.id)} className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"><Icon name="trash" size={13} /></button>
      </div>
    </div>
  );
}

function DayGroup({ day, tasks }: { day: string; tasks: any[] }) {
  const [open, setOpen] = useState(false);
  const label = new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer w-full">
        <Icon name="chevron" size={10} className={`transition ${open ? 'rotate-90' : ''}`} />
        <span className="font-medium">{label}</span>
        <span className="text-zinc-600">({tasks.length})</span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5">
          {tasks.map(t => (
            <div key={t.id} className="text-xs text-zinc-400 truncate">• {t.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Helpers ============
function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function useDebouncedFn(fn: (...args: any[]) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: any[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
